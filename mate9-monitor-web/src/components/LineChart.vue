<script setup lang="ts">
import { LineChart as ELineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import type { EChartsCoreOption, EChartsType } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

echarts.use([ELineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

interface Series {
  name: string
  data: (number | null)[]
  color: string
}

const props = withDefaults(
  defineProps<{
    labels: string[]
    series: Series[]
    unit?: string
    max?: number
  }>(),
  { unit: '', max: undefined },
)

const el = ref<HTMLDivElement>()
let chart: EChartsType | null = null
let observer: ResizeObserver | null = null

const buildOption = (): EChartsCoreOption => ({
  animation: false,
  grid: {
    left: 4,
    right: 8,
    top: props.series.length > 1 ? 26 : 8,
    bottom: 0,
    containLabel: true,
  },
  tooltip: {
    trigger: 'axis',
    confine: true,
    formatter: (params: unknown) => {
      const list = params as { axisValue: string; seriesName: string; value: number; color: string }[]
      if (!list?.length) return ''
      const lines = list.map(
        (p) => `<span style="color:${p.color}">●</span> ${p.seriesName}: ${p.value}${props.unit}`,
      )
      return `${list[0].axisValue}<br/>${lines.join('<br/>')}`
    },
  },
  legend:
    props.series.length > 1
      ? {
          top: 0,
          right: 0,
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { fontSize: 11, color: '#64748b' },
        }
      : undefined,
  xAxis: {
    type: 'category',
    data: props.labels,
    show: false,
    boundaryGap: false,
  },
  yAxis: {
    type: 'value',
    min: 0,
    max: props.max,
    splitNumber: 3,
    axisLabel: { fontSize: 10, color: '#94a3b8' },
    splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
  },
  series: props.series.map((s) => ({
    name: s.name,
    type: 'line',
    smooth: true,
    showSymbol: false,
    lineStyle: { width: 2, color: s.color },
    areaStyle: { color: s.color, opacity: 0.12 },
    data: s.data,
  })),
})

const render = () => chart?.setOption(buildOption())

onMounted(() => {
  if (!el.value) return
  chart = echarts.init(el.value)
  render()
  observer = new ResizeObserver(() => chart?.resize())
  observer.observe(el.value)
})

watch(() => [props.labels, props.series], render, { deep: true })

onBeforeUnmount(() => {
  observer?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="el" class="h-36 w-full sm:h-40"></div>
</template>
