<script setup lang="ts">
import { computed, useId } from 'vue'
import { mixHex, type ResortTheme } from '../data/themes'

// 스키장 테마색 하나로 하늘·산 명암을 만들어 그리는 파스텔 설산 일러스트.
const props = defineProps<{ theme: ResortTheme }>()

const WHITE = '#FFFFFF'
const p = computed(() => {
  const { background: bg, foreground: fg } = props.theme
  return {
    sky: [mixHex(bg, WHITE, 0.78), mixHex(bg, WHITE, 0.9)],
    m: [mixHex(bg, WHITE, 0.3), bg, mixHex(bg, fg, 0.3)], // 뒤 → 앞으로 갈수록 진하게
    sun: '#FFE6B8',
  }
})
const uid = useId()
</script>

<template>
  <svg class="scene" viewBox="0 0 360 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient :id="`sky-${uid}`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" :stop-color="p.sky[0]" />
        <stop offset="1" :stop-color="p.sky[1]" />
      </linearGradient>
    </defs>
    <rect width="360" height="220" :fill="`url(#sky-${uid})`" />
    <circle cx="286" cy="58" r="30" :fill="p.sun" opacity="0.85" />
    <!-- 뒤 산 -->
    <polygon points="0,150 60,92 120,132 192,72 260,122 322,82 360,112 360,220 0,220" :fill="p.m[0]" />
    <!-- 중간 산 -->
    <polygon points="0,176 82,120 152,162 222,112 302,152 360,122 360,220 0,220" :fill="p.m[1]" />
    <!-- 앞 산 + 눈 덮인 봉우리 -->
    <polygon points="0,200 72,150 142,186 212,146 292,186 360,152 360,220 0,220" :fill="p.m[2]" />
    <polygon points="72,150 58,160 72,163 86,160" fill="#ffffff" opacity="0.92" />
    <polygon points="212,146 198,157 212,160 226,157" fill="#ffffff" opacity="0.92" />
    <!-- 여정 선 -->
    <path d="M 26,204 C 86,188 92,158 150,156 S 238,126 300,104" fill="none" stroke="#ffffff" stroke-width="2.4"
      stroke-linecap="round" stroke-dasharray="1 9" opacity="0.8" />
    <circle cx="26" cy="204" r="4.5" fill="#ffffff" />
    <circle cx="150" cy="156" r="4.5" fill="#ffffff" />
    <circle cx="300" cy="104" r="4.5" fill="#ffffff" />
    <!-- 전나무 -->
    <g :fill="p.m[2]" opacity="0.9">
      <polygon points="30,214 40,196 50,214" />
      <polygon points="33,206 40,192 47,206" />
      <polygon points="320,216 332,194 344,216" />
      <polygon points="324,206 332,190 340,206" />
    </g>
  </svg>
</template>

<style scoped>
.scene { display: block; width: 100%; height: 100%; }
</style>
