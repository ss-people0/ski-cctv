<script setup lang="ts">
import { computed, useId } from 'vue'

// 스키장마다 다른 파스텔 색조로 그리는 설산 일러스트.
const props = defineProps<{ tint: number }>()

type Palette = { sky: [string, string]; m: [string, string, string]; sun: string }
const palettes: Palette[] = [
  { sky: ['#ece4fb', '#fce7f0'], m: ['#cbb9f2', '#ab93e6', '#9174da'], sun: '#ffe1b0' }, // 라벤더
  { sky: ['#e2eefb', '#eafaf3'], m: ['#bcd8f3', '#93bbe9', '#6f9bda'], sun: '#fff1b5' }, // 아침 블루
  { sky: ['#fdeede', '#fde3ea'], m: ['#f3c9ad', '#eaa98f', '#d98f86'], sun: '#ffd79e' }, // 피치
  { sky: ['#e3f6ee', '#eafaf6'], m: ['#b6e6cf', '#8fd1b4', '#6fc3a0'], sun: '#fdf0c0' }, // 민트
  { sky: ['#e6e9fb', '#f0e9fb'], m: ['#c2c6f2', '#9fa6e6', '#8183d8'], sun: '#ffe3c0' }, // 페리윙클
  { sky: ['#fce7ee', '#fdeede'], m: ['#f2c2d2', '#e69fb3', '#d98f9f'], sun: '#ffe0b8' }, // 로즈
  { sky: ['#e0f2fb', '#eafaf7'], m: ['#b2ddf0', '#8fc6e6', '#6facd6'], sun: '#fff0b8' }, // 아쿠아
]
const p = computed(() => palettes[((props.tint % palettes.length) + palettes.length) % palettes.length])
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
