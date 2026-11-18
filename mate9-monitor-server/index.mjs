import { exec } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'

const PORT = Number(process.env.PORT || 3100)
const INTERVAL = Number(process.env.INTERVAL || 2000)

const execAsync = (cmd, timeout = 2000) =>
  new Promise((resolve) => {
    exec(cmd, { timeout }, (err, stdout) => resolve(err ? '' : stdout))
  })

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d

let prevStat = null
let prevNet = null
let prevNetAt = 0

const device = { host: '', model: '' }
const deviceReady = (async () => {
  const getprop = async (key) => (await execAsync(`getprop ${key}`, 1500)).trim()
  device.host = (await getprop('net.hostname')) || os.hostname()
  device.model = (await getprop('ro.product.model')) || ''
})()

function parseProcStat(raw) {
  const line = raw.split('\n').find((l) => l.startsWith('cpu '))
  if (!line) return null
  const nums = line.trim().split(/\s+/).slice(1).map(Number)
  if (nums.length < 4) return null
  return {
    idle: nums[3] + (nums[4] ?? 0),
    total: nums.slice(0, 8).reduce((a, b) => a + b, 0),
  }
}

async function collectCpu() {
  const cpuinfo = await readFile('/proc/cpuinfo', 'utf8').catch(() => '')
  const cores = (cpuinfo.match(/^processor\s*:/gm) ?? []).length || os.cpus().length
  const load = os.loadavg().map((n) => round(n, 2))

  // Android 9 起普通应用读不到 /proc/stat，这时 usage 返回 null，前端改用负载展示
  const raw = await readFile('/proc/stat', 'utf8').catch(() => '')
  const stat = raw ? parseProcStat(raw) : null
  let usage = null
  if (stat) {
    if (prevStat && stat.total > prevStat.total) {
      usage = round((1 - (stat.idle - prevStat.idle) / (stat.total - prevStat.total)) * 100)
    }
    prevStat = stat
  }

  return { usage, cores, model: device.model, load }
}

async function collectMem() {
  const total = os.totalmem()
  let available = os.freemem()
  let swap = null
  const raw = await readFile('/proc/meminfo', 'utf8').catch(() => '')
  if (raw) {
    const read = (key) => {
      const m = raw.match(new RegExp(`^${key}:\\s+(\\d+) kB`, 'm'))
      return m ? Number(m[1]) * 1024 : null
    }
    available = read('MemAvailable') ?? available
    const swapTotal = read('SwapTotal')
    const swapFree = read('SwapFree')
    if (swapTotal && swapFree !== null) {
      swap = { total: swapTotal, free: swapFree, used: swapTotal - swapFree }
    }
  }
  const used = total - available
  return {
    total,
    used,
    available,
    percent: round((used / total) * 100),
    swap,
  }
}

async function collectDisks() {
  const out = await execAsync('df -kP')
  if (!out) return []
  const lines = out.trim().split('\n')
  // Termux 自带的 df 来自 toybox，-k 也可能按 512 字节块输出，必须按表头判断单位
  const header = lines[0] ?? ''
  const blockSize = /512-blocks/.test(header) ? 512 : /1M-blocks/.test(header) ? 1048576 : 1024
  const disks = []
  const seen = new Set()
  for (const line of lines.slice(1)) {
    const parts = line.split(/\s+/)
    if (parts.length < 6) continue
    const [, totalBlocks, usedBlocks, availBlocks, , ...mountParts] = parts
    const mount = mountParts.join(' ')
    const total = Number(totalBlocks) * blockSize
    if (!total || seen.has(mount)) continue
    // /storage/emulated 是 /data 的 sdcardfs 视图，二者是同一分区，只保留 /data；
    // 外置 SD 卡形如 /storage/1234-ABCD，需要保留
    const relevant =
      mount === '/data' ||
      (mount.startsWith('/storage/') && !mount.startsWith('/storage/emulated')) ||
      (mount === '/' && os.platform() !== 'android') ||
      mount.startsWith('/home') ||
      mount.startsWith('/Users')
    if (!relevant) continue
    seen.add(mount)
    disks.push({
      mount,
      total,
      used: Number(usedBlocks) * blockSize,
      available: Number(availBlocks) * blockSize,
      percent: round((Number(usedBlocks) / Number(totalBlocks)) * 100),
    })
  }
  return disks.sort((a, b) => b.total - a.total).slice(0, 5)
}

async function collectNet() {
  const raw = await readFile('/proc/net/dev', 'utf8').catch(() => '')
  if (!raw) return null
  const line = raw
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('wlan0:'))
  if (!line) return null
  const fields = line.split(':')[1].trim().split(/\s+/)
  const rx = Number(fields[0])
  const tx = Number(fields[8])
  const now = Date.now()
  let rxRate = 0
  let txRate = 0
  if (prevNet && prevNetAt) {
    const seconds = (now - prevNetAt) / 1000
    rxRate = Math.max(0, (rx - prevNet.rx) / seconds)
    txRate = Math.max(0, (tx - prevNet.tx) / seconds)
  }
  prevNet = { rx, tx }
  prevNetAt = now
  return { iface: 'wlan0', rx, tx, rxRate: Math.round(rxRate), txRate: Math.round(txRate) }
}

async function collectTemp() {
  const base = '/sys/class/thermal'
  const dirs = await readdir(base).catch(() => [])
  const values = await Promise.all(
    dirs
      .filter((d) => d.startsWith('thermal_zone'))
      .map(async (d) => {
        const raw = await readFile(`${base}/${d}/temp`, 'utf8').catch(() => '')
        const n = Number(raw.trim())
        return Number.isFinite(n) && n > 0 ? (n > 1000 ? n / 1000 : n) : null
      }),
  )
  const valid = values.filter((v) => v !== null)
  return valid.length ? round(Math.max(...valid)) : null
}

async function collectBattery() {
  const out = await execAsync('termux-battery-status', 2500)
  if (!out) return null
  try {
    const b = JSON.parse(out)
    return {
      percentage: b.percentage ?? 0,
      status: b.status ?? 'UNKNOWN',
      plugged: b.plugged ?? 'UNKNOWN',
      temperature: b.temperature ?? null,
    }
  } catch {
    return null
  }
}

const checkPort = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    const done = (ok) => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(800)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })

async function collectServices() {
  const services = []
  const out = await execAsync('pm2 jlist --silent', 3000)
  if (out) {
    try {
      for (const p of JSON.parse(out)) {
        services.push({
          name: p.name,
          source: 'pm2',
          status: p.pm2_env?.status ?? 'unknown',
          pid: p.pid ?? null,
          cpu: p.monit?.cpu ?? null,
          mem: p.monit?.memory ?? null,
          restarts: p.pm2_env?.restart_time ?? 0,
          uptime: p.pm2_env?.pm_uptime ?? null,
        })
      }
    } catch {
      // pm2 输出异常时忽略，继续用端口探测
    }
  }
  const ports = [
    { name: 'caddy', port: 8080 },
    { name: 'sshd', port: 8022 },
  ]
  const probes = await Promise.all(
    ports.map(async ({ name, port }) => ({
      name,
      port,
      source: 'port',
      status: (await checkPort(port)) ? 'online' : 'offline',
    })),
  )
  for (const probe of probes) {
    if (!services.some((s) => s.name === probe.name)) services.push(probe)
  }
  return services
}

async function collect() {
  const [mem, disks, netInfo, temp, battery, services] = await Promise.all([
    collectMem(),
    collectDisks(),
    collectNet(),
    collectTemp(),
    collectBattery(),
    collectServices(),
  ])
  await deviceReady
  return {
    time: Date.now(),
    host: device.host,
    platform: `${os.platform()} ${os.release()}`,
    uptime: os.uptime(),
    cpu: await collectCpu(),
    mem,
    disks,
    net: netInfo,
    temp,
    battery,
    services,
  }
}

const clients = new Set()
let last = null

async function tick() {
  try {
    last = await collect()
    const payload = `data: ${JSON.stringify(last)}\n\n`
    for (const res of clients) res.write(payload)
  } catch (err) {
    console.error('[collect] failed:', err)
  }
}

setInterval(tick, INTERVAL)
tick()

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (url.pathname === '/api/status') {
    const data = last ?? (await collect())
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(data))
    return
  }

  if (url.pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.write('retry: 3000\n\n')
    if (last) res.write(`data: ${JSON.stringify(last)}\n\n`)
    clients.add(res)
    req.on('close', () => clients.delete(res))
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ error: 'not found' }))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`mate9 monitor listening on http://0.0.0.0:${PORT}`)
})
