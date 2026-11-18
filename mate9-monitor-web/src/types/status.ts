export interface CpuInfo {
  /** Android 9+ 普通应用读不到 /proc/stat 时为 null */
  usage: number | null
  cores: number
  model: string
  load: number[]
}

export interface SwapInfo {
  total: number
  free: number
  used: number
}

export interface MemInfo {
  total: number
  used: number
  available: number
  percent: number
  swap: SwapInfo | null
}

export interface DiskInfo {
  mount: string
  total: number
  used: number
  available: number
  percent: number
}

export interface NetInfo {
  iface: string
  rx: number
  tx: number
  rxRate: number
  txRate: number
}

export interface BatteryInfo {
  percentage: number
  status: string
  plugged: string
  temperature: number | null
}

export interface ServiceInfo {
  name: string
  source: 'pm2' | 'port'
  status: string
  pid?: number | null
  cpu?: number | null
  mem?: number | null
  restarts?: number
  uptime?: number | null
  port?: number
}

export interface StatusSnapshot {
  time: number
  host: string
  platform: string
  uptime: number
  cpu: CpuInfo
  mem: MemInfo
  disks: DiskInfo[]
  net: NetInfo | null
  temp: number | null
  battery: BatteryInfo | null
  services: ServiceInfo[]
}
