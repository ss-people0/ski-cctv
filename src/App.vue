<script setup lang="ts">
import { computed, ref } from 'vue'
import CamCard from './components/CamCard.vue'
import { resorts, type Resort } from './data/cams'
import { isPlayable, sortResorts } from './data/sortResorts'
import { playingCamId } from './playingCam'

const ALL = 'all'
const sortedResorts = sortResorts(resorts)
const playableTotal = resorts.flatMap((resort) => resort.cams).filter(isPlayable).length

const selectedId = ref(ALL)
const visibleResorts = computed(() =>
  sortedResorts.filter((resort) => selectedId.value === ALL || resort.id === selectedId.value),
)

const isPlayingIn = (resort: Resort) => resort.cams.some((cam) => cam.id === playingCamId.value)

// 화면에서 사라진 스키장의 영상이 계속 재생되지 않게 한다.
function onSelect() {
  if (!visibleResorts.value.some(isPlayingIn)) playingCamId.value = null
}

// 접힌 스키장의 영상이 보이지 않는 채로 계속 재생되지 않게 한다.
function onToggle(event: Event, resort: Resort) {
  const isOpen = (event.currentTarget as HTMLDetailsElement).open
  if (!isOpen && isPlayingIn(resort)) playingCamId.value = null
}
</script>

<template>
  <main>
    <header class="hero">
      <img class="rider" src="/hero.jpg" alt="" />
      <p>지금 슬로프는 어떨까?</p>
      <h1>스키장 CCTV</h1>
      <span class="badge">바로 볼 수 있는 영상 {{ playableTotal }}개</span>
    </header>

    <div class="toolbar">
      <h2>스키장</h2>
      <select v-model="selectedId" class="dropdown" aria-label="스키장 선택" @change="onSelect">
        <option :value="ALL">전체 스키장</option>
        <option v-for="resort in sortedResorts" :key="resort.id" :value="resort.id">{{ resort.name }}</option>
      </select>
    </div>

    <details
      v-for="resort in visibleResorts"
      :key="resort.id"
      class="resort"
      name="resort"
      :open="resort.id === selectedId"
      @toggle.self="onToggle($event, resort)"
    >
      <summary>
        <div class="names">
          <h3>{{ resort.name }}</h3>
          <span class="region">{{ resort.region }}</span>
        </div>
        <a
          class="webcam-link"
          :href="resort.officialPage"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`${resort.name} 공식 웹캠 바로가기, 새 창`"
          @click.stop
        >웹캠 바로가기</a>
        <img class="symbol" :src="`symbols/${resort.id}.png`" alt="" />
      </summary>
      <div class="cams">
        <CamCard v-for="cam in resort.cams" :key="cam.id" :resort="resort" :cam="cam" />
      </div>
    </details>

    <footer class="credit">
      사진: <a href="https://commons.wikimedia.org/wiki/File:Ariane_Lavigne_FIS_World_Cup_Parallel_Slalom_Jauerling_2012b.jpg" target="_blank" rel="noopener noreferrer">Christian Jansky</a>,
      <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a> (크기 변경, 일부만 표시).
      심볼은 각 리조트의 상표이며, 이 페이지는 리조트와 관련이 없는 개인 페이지입니다.
    </footer>
  </main>
</template>
