<script setup lang="ts">
import { computed } from 'vue'
import type { Cam, Resort } from '../data/cams'
import { isPlayable } from '../data/sortResorts'
import { playingCamId } from '../playingCam'

// 상세 CCTV 목록: 이름만 눌러도 위쪽 플레이어(HeroPlayer)에서 바로 재생된다. cam.group 순서대로 묶는다.
const props = defineProps<{ resort: Resort }>()

const groups = computed(() =>
  props.resort.cams.reduce<{ name: string; cams: Cam[] }[]>((acc, cam) => {
    const name = cam.group ?? ''
    const found = acc.find((g) => g.name === name)
    return found
      ? acc.map((g) => (g === found ? { name, cams: [...g.cams, cam] } : g))
      : [...acc, { name, cams: [cam] }]
  }, []),
)

const play = (cam: Cam) => {
  playingCamId.value = cam.id
}

// 하이원: https에서는 http 스트림이 막혀 공식 팝업(같은 크기)으로 연다.
function openPopup(url: string) {
  window.open(url, '_blank', 'popup,noopener,noreferrer,width=680,height=550')
}
const linkUrl = (cam: Cam) => (cam.type === 'link' && cam.url) || props.resort.officialPage
</script>

<template>
  <div class="cam-picks">
    <section v-for="group in groups" :key="group.name" class="pick-group">
      <h4 v-if="group.name" class="pick-title">{{ group.name }}</h4>
      <ul class="picks">
        <li v-for="cam in group.cams" :key="cam.id">
          <button
            v-if="isPlayable(cam)"
            type="button"
            class="pick"
            :class="{ on: playingCamId === cam.id }"
            :aria-pressed="playingCamId === cam.id"
            @click="play(cam)"
          >
            <span class="dot" aria-hidden="true" />
            <span class="pick-name">{{ cam.name }}</span>
            <span v-if="playingCamId === cam.id" class="live">보는 중</span>
          </button>
          <span v-else-if="cam.status !== 'active'" class="pick off">
            <span class="pick-name">{{ cam.name }}</span>
            <span class="live">{{ cam.status === 'pending' ? '오픈 준비 중' : '지금은 안 나와요' }}</span>
          </span>
          <a
            v-else-if="cam.type === 'hls' && cam.popupUrl"
            class="pick"
            :href="cam.popupUrl"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`${resort.name} ${cam.name} 영상 보기, 새 창`"
            @click.prevent="openPopup(cam.popupUrl)"
          >
            <span class="dot" aria-hidden="true" />
            <span class="pick-name">{{ cam.name }}</span>
            <span class="live">새 창 ↗</span>
          </a>
          <a
            v-else
            class="pick"
            :href="linkUrl(cam)"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`${resort.name} ${cam.name} 공식 페이지에서 보기, 새 창`"
          >
            <span class="dot" aria-hidden="true" />
            <span class="pick-name">{{ cam.name }}</span>
            <span class="live">공식 페이지 ↗</span>
          </a>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.cam-picks { display: flex; flex-direction: column; gap: 14px; }
.pick-title { margin: 0 4px 6px; color: var(--muted); font-size: 0.8rem; font-weight: 800; }
.picks { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr)); gap: 6px; margin: 0; padding: 0; list-style: none; }
.pick { display: flex; align-items: center; gap: 10px; box-sizing: border-box; width: 100%; min-height: 48px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); color: var(--text); font: inherit; font-size: 0.95rem; font-weight: 700; text-align: left; text-decoration: none; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.pick:not(.off):hover { border-color: var(--blue); }
.pick.on { border-color: var(--blue); background: #efecfd; color: var(--blue-dark); }
.pick.off { color: var(--muted); cursor: default; }
.dot { flex: none; width: 8px; height: 8px; border-radius: 999px; background: #c9c6dc; }
.pick.on .dot { background: var(--alert); box-shadow: 0 0 0 3px #d94a4f33; }
.pick-name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.live { flex: none; font-size: 0.75rem; font-weight: 700; }
</style>
