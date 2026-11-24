<script setup lang="ts">
import CamCard from './components/CamCard.vue'
import { resorts, type Resort } from './data/cams'
import { isPlayable, sortResorts } from './data/sortResorts'
import { playingCamId } from './playingCam'

const sortedResorts = sortResorts(resorts)

function summaryText(resort: Resort) {
  const playableCount = resort.cams.filter(isPlayable).length
  if (playableCount > 0) return `영상 ${playableCount}개`
  return resort.cams.every((cam) => cam.status === 'pending') ? '오픈 준비 중' : '새 창으로 보기'
}

// 접힌 스키장의 영상이 보이지 않는 채로 계속 재생되지 않게 한다.
function onToggle(event: Event, resort: Resort) {
  const isOpen = (event.currentTarget as HTMLDetailsElement).open
  if (!isOpen && resort.cams.some((cam) => cam.id === playingCamId.value)) playingCamId.value = null
}
</script>

<template>
  <main>
    <h1>스키장 CCTV</h1>
    <details v-for="resort in sortedResorts" :key="resort.id" class="resort" name="resort" @toggle.self="onToggle($event, resort)">
      <summary>
        <h2>{{ resort.name }}</h2>
        <span class="region">{{ resort.region }}</span>
        <span class="count">{{ summaryText(resort) }}</span>
      </summary>
      <div class="cams">
        <CamCard v-for="cam in resort.cams" :key="cam.id" :resort="resort" :cam="cam" />
      </div>
    </details>
  </main>
</template>
