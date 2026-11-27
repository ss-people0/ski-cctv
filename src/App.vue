<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue'
import CamCard from './components/CamCard.vue'
import SlopeStatusCard from './components/SlopeStatusCard.vue'
import { resorts } from './data/cams'
import { isPlayable, sortResorts } from './data/sortResorts'
import { buildSlopeBoard, formatUpcoming, loadSlopeStatus, todayKst, type ResortSlopeStatus } from './data/slopeStatus'
import { themeOf } from './data/themes'
import { fetchWeather, type Weather } from './data/weather'
import { playingCamId } from './playingCam'

const sortedResorts = sortResorts(resorts)
const playableTotal = resorts.flatMap((resort) => resort.cams).filter(isPlayable).length

const slopeStatus = shallowRef<Map<string, ResortSlopeStatus>>(new Map())
onMounted(async () => {
  slopeStatus.value = await loadSlopeStatus(import.meta.env.BASE_URL)
})

// 목록 카드에 보여줄 스키장별 현재 날씨(한 번에 받아둔다).
const cardWeather = shallowRef<Map<string, Weather>>(new Map())
onMounted(async () => {
  const entries = await Promise.all(
    sortedResorts.map(
      async (r) => [r.id, r.coord ? await fetchWeather(r.coord.lat, r.coord.lon) : null] as const,
    ),
  )
  cardWeather.value = new Map(entries.filter((e): e is [string, Weather] => e[1] !== null))
})

// 상세 화면에서 스크롤을 내리면 상단 고정 헤더(뒤로가기)를 보여준다.
const scrolled = shallowRef(false)
const onScroll = () => {
  scrolled.value = window.scrollY > 150
}
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

// null = 스키장 목록 화면, 값이 있으면 그 스키장 상세 화면
const selectedId = shallowRef<string | null>(null)
const currentResort = computed(() => sortedResorts.find((resort) => resort.id === selectedId.value) ?? null)

// 상세 슬로프 현황과, 그 현황으로 걸러낸 오픈 예정 안내(이미 열렸거나 당일이 된 건 빠진다).
const currentSlopes = computed(() => {
  const resort = currentResort.value
  if (!resort) return null
  const today = todayKst()
  const board = buildSlopeBoard(slopeStatus.value.get(resort.id), today, resort.upcoming, resort.slopeCatalog)
  return { board, upcomingLines: formatUpcoming(resort.upcoming, today, board) }
})

// 스키장을 열 때마다 그 위치의 현재 날씨를 실시간으로 받아온다(Open-Meteo).
const weather = shallowRef<Weather | null>(null)

// 화면을 옮길 때는 재생 중인 영상을 멈춘다(보이지 않는 채 재생 방지).
async function openResort(id: string) {
  playingCamId.value = null
  selectedId.value = id
  weather.value = null
  scrolled.value = false
  window.scrollTo({ top: 0 })
  const resort = sortedResorts.find((r) => r.id === id)
  if (!resort?.coord) return
  const result = await fetchWeather(resort.coord.lat, resort.coord.lon)
  if (selectedId.value === id) weather.value = result // 늦게 온 응답이 다른 스키장에 안 뜨게
}
function goBack() {
  playingCamId.value = null
  selectedId.value = null
  weather.value = null
  scrolled.value = false
  window.scrollTo({ top: 0 })
}

// "033-330-3126~7, 033-330-6373"처럼 여러 번호가 있으면 첫 번호로 전화를 건다.
const firstTel = (tel: string) => tel.match(/[\d-]+/)?.[0] ?? tel

// 카드 이름 영역에 스키장 테마색(배경/글자)을 CSS 변수로 넘긴다.
const themeVars = (id: string) => ({ '--theme-bg': themeOf(id).background, '--theme-fg': themeOf(id).foreground })
</script>

<template>
  <main>
    <header class="topbar">
      <div class="brand-lockup">
        <!-- 라이트는 윤곽선형(B), 다크는 채움형(A). 사이트는 지금 라이트 테마 전용이라 보통은 윤곽선형이 보인다. -->
        <picture class="brand-mark">
          <source media="(prefers-color-scheme: dark)" :srcset="'brand/logo-solid-78.png'" />
          <img :src="'brand/logo-outline-78.png'" alt="" width="25" height="26" decoding="async" />
        </picture>
        <span class="brand">스키장 CCTV</span>
      </div>
      <span class="count">바로 볼 수 있는 영상 {{ playableTotal }}개</span>
    </header>

    <nav v-if="!currentResort" class="resort-list" aria-label="스키장 목록">
      <p class="lead">지금 슬로프는 어떨까</p>
      <button
        v-for="resort in sortedResorts"
        :key="resort.id"
        type="button"
        class="resort-row"
        @click="openResort(resort.id)"
      >
        <span class="row-art"><img :src="`illustrations/${resort.id}.jpg`" alt="" loading="lazy" decoding="async" /></span>
        <span class="row-label" :style="themeVars(resort.id)">
          <span class="row-text">
            <span class="resort-name">{{ resort.name }}</span>
            <span class="row-sub">{{ resort.region }}</span>
          </span>
          <span v-if="cardWeather.get(resort.id)" class="card-weather"
            >{{ cardWeather.get(resort.id)!.icon }} {{ cardWeather.get(resort.id)!.temp }}°</span
          >
        </span>
      </button>
    </nav>

    <section v-if="currentResort" class="resort-detail">
      <header class="detail-topbar" :class="{ show: scrolled }">
        <button type="button" class="topbar-back" aria-label="스키장 목록으로" @click="goBack">←</button>
        <span class="topbar-name">{{ currentResort.name }}</span>
      </header>
      <div class="detail-hero">
        <img class="hero-art" :src="`illustrations/${currentResort.id}.jpg`" alt="" />
        <button type="button" class="back" aria-label="스키장 목록으로" @click="goBack">←</button>
        <a
          class="symbol-link"
          :href="currentResort.officialPage"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`${currentResort.name} 공식 웹캠 바로가기, 새 창`"
        >
          <img class="symbol" :src="`symbols/${currentResort.id}.png`" alt="" />
        </a>
        <span v-if="weather" class="weather-chip" :title="weather.label">{{ weather.icon }} {{ weather.temp }}°</span>
      </div>
      <div class="detail-head">
        <h2>{{ currentResort.name }}</h2>
        <span class="region">{{ currentResort.region }}</span>
      </div>

      <div class="detail-body">
        <SlopeStatusCard
          v-if="currentSlopes"
          :board="currentSlopes.board"
          :upcoming-lines="currentSlopes.upcomingLines"
        />

        <div v-if="currentResort.emergency?.length" class="emergency">
          <span class="emergency-title">🚨 사고 시 연락처</span>
          <div v-for="contact in currentResort.emergency" :key="contact.label" class="emergency-row">
            <span class="e-label">{{ contact.label }}</span>
            <span class="e-tels">
              <a v-for="tel in contact.tels" :key="tel" class="e-tel" :href="`tel:${firstTel(tel)}`">{{ tel }}</a>
            </span>
          </div>
        </div>

        <h3 class="cams-title">라이브 캠</h3>
        <div class="cams">
          <CamCard v-for="cam in currentResort.cams" :key="cam.id" :resort="currentResort" :cam="cam" />
        </div>
      </div>
    </section>

    <footer class="credit">
      날씨: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> · 배경은 직접 그린 일러스트입니다.
      심볼은 각 리조트의 상표이며, 이 페이지는 리조트와 관련이 없는 개인 페이지입니다.
    </footer>
  </main>
</template>
