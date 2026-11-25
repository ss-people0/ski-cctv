<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import CamCard from './components/CamCard.vue'
import { resorts } from './data/cams'
import { isPlayable, sortResorts } from './data/sortResorts'
import {
  formatSlopeBadge,
  loadSlopeStatus,
  todayKst,
  type ResortSlopeStatus,
} from './data/slopeStatus'
import { playingCamId } from './playingCam'

const sortedResorts = sortResorts(resorts)
const playableTotal = resorts.flatMap((resort) => resort.cams).filter(isPlayable).length

const slopeStatus = shallowRef<Map<string, ResortSlopeStatus>>(new Map())
const slopeBadges = computed(() => {
  const today = todayKst()
  return new Map(
    resorts.map((resort) => [resort.id, formatSlopeBadge(slopeStatus.value.get(resort.id), today)]),
  )
})
onMounted(async () => {
  slopeStatus.value = await loadSlopeStatus(import.meta.env.BASE_URL)
})

// null = 스키장 목록 화면, 값이 있으면 그 스키장 상세 화면
const selectedId = shallowRef<string | null>(null)
const currentResort = computed(() => sortedResorts.find((resort) => resort.id === selectedId.value) ?? null)

// 화면을 옮길 때는 재생 중인 영상을 멈춘다(보이지 않는 채 재생 방지).
function openResort(id: string) {
  playingCamId.value = null
  selectedId.value = id
}
function goBack() {
  playingCamId.value = null
  selectedId.value = null
}

// "033-330-3126~7, 033-330-6373"처럼 여러 번호가 있으면 첫 번호로 전화를 건다.
const firstTel = (tel: string) => tel.match(/[\d-]+/)?.[0] ?? tel

const photo = (id: string) => `${import.meta.env.BASE_URL}photos/${id}.jpg`
// 목록 카드의 작은 설명: 슬로프 현황이 있으면 그걸, 없으면 지역을 보여준다.
function cardSub(id: string, region: string): string {
  return slopeBadges.value.get(id)?.summary ?? region
}
</script>

<template>
  <main>
    <header class="topbar">
      <span class="brand">스키장 CCTV</span>
      <span class="count">바로 볼 수 있는 영상 {{ playableTotal }}개</span>
    </header>

    <nav v-if="!currentResort" class="resort-list" aria-label="스키장 목록">
      <p class="lead">지금 슬로프는 어떨까</p>
      <button
        v-for="resort in sortedResorts"
        :key="resort.id"
        type="button"
        class="resort-row"
        :style="{ backgroundImage: `url(${photo(resort.id)})` }"
        @click="openResort(resort.id)"
      >
        <span class="row-label">
          <span class="resort-name">{{ resort.name }}</span>
          <span class="row-sub">{{ cardSub(resort.id, resort.region) }}</span>
        </span>
      </button>
    </nav>

    <section v-if="currentResort" class="resort-detail">
      <div class="detail-hero" :style="{ backgroundImage: `url(${photo(currentResort.id)})` }">
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
        <div class="hero-label">
          <h2>{{ currentResort.name }}</h2>
          <span class="region">{{ currentResort.region }}</span>
        </div>
      </div>

      <div class="detail-body">
        <div class="slope-info" :class="{ empty: !slopeBadges.get(currentResort.id) }">
          <template v-if="slopeBadges.get(currentResort.id)">
            <span class="slope-summary">{{ slopeBadges.get(currentResort.id)!.summary }}</span>
            <span
              v-for="hour in slopeBadges.get(currentResort.id)!.hours"
              :key="hour.label"
              class="slope-hour"
              :class="{ off: hour.off }"
            >{{ hour.label }} {{ hour.value }}<template v-if="hour.off"> · 현재 미운영</template></span>
          </template>
          <span v-else>아직 오픈 현황 정보가 없어요.</span>
        </div>

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
      슬로프 사진: <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a> (CC0, 크기 변경) — 실제 해당 스키장이 아닐 수 있습니다.
      심볼은 각 리조트의 상표이며, 이 페이지는 리조트와 관련이 없는 개인 페이지입니다.
    </footer>
  </main>
</template>
