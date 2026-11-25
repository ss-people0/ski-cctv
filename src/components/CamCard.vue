<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { Cam, Resort } from '../data/cams'
import { isPlayable } from '../data/sortResorts'
import { playingCamId } from '../playingCam'
import HlsPlayer from './HlsPlayer.vue'

const props = defineProps<{ resort: Resort; cam: Cam }>()

const isPlaying = computed(() => playingCamId.value === props.cam.id)
const hasError = ref(false)
const ended = ref(false) // 미리보기 시간이 다 돼서 끝난 상태
const card = ref<HTMLElement>()
const screen = ref<HTMLElement>()
const title = computed(() => `${props.resort.name} ${props.cam.name}`)

async function play() {
  hasError.value = false
  ended.value = false
  playingCamId.value = props.cam.id
  await nextTick()
  screen.value?.querySelector<HTMLElement>('video, iframe')?.focus()
}

// 하이원 공식 팝업과 같은 크기다.
function openPopup(url: string) {
  window.open(url, '_blank', 'popup,noopener,noreferrer,width=680,height=550')
}

async function stop(outcome: 'ended' | 'error' | 'closed') {
  if (!isPlaying.value) return // 이미 꺼진 카드의 늦은 이벤트가 다른 영상을 끄지 않게 한다.
  const hadFocus = screen.value?.contains(document.activeElement)
  playingCamId.value = null
  hasError.value = outcome === 'error'
  ended.value = outcome === 'ended'
  await nextTick()
  if (hadFocus) card.value?.querySelector<HTMLElement>('.play')?.focus()
}
</script>

<template>
  <article ref="card" class="card">
    <h4>{{ cam.name }}</h4>
    <div v-if="!isPlaying" class="info">
      <p v-if="hasError" class="error" role="alert">지금은 영상을 볼 수 없어요. 잠시 후 다시 눌러 주세요.</p>
      <p v-else-if="ended" class="done">{{ cam.type === 'hls' ? cam.playLimitSec : 0 }}초 미리보기가 끝났어요.</p>
      <div class="actions">
        <button v-if="isPlayable(cam)" class="play" type="button" :aria-label="`${title} 재생`" @click="play">
          {{ ended ? '▶ 다시 보기' : '▶ 재생' }}<span v-if="cam.type === 'hls'">&nbsp;({{ cam.playLimitSec }}초)</span>
        </button>
        <span v-else-if="cam.status === 'pending'" class="status">오픈 준비 중</span>
        <span v-else-if="cam.status === 'investigate'" class="status">지금은 영상이 나오지 않아요</span>
        <a
          v-else-if="cam.type === 'hls' && cam.popupUrl"
          class="popup"
          :href="cam.popupUrl"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`${title} 영상 보기, 새 창`"
          @click.prevent="openPopup(cam.popupUrl)"
        >▶ 영상 보기 (새 창)</a>
        <span v-else class="status">공식 페이지에서 볼 수 있어요</span>
      </div>
    </div>
    <div v-show="isPlaying" class="slot">
      <div ref="screen" class="screen">
        <template v-if="isPlaying">
          <HlsPlayer
            v-if="cam.type === 'hls'"
            :url="cam.url"
            :play-limit-sec="cam.playLimitSec"
            :label="title"
            @end="stop('ended')"
            @error="stop('error')"
          />
          <iframe
            v-else-if="cam.type === 'youtube'"
            :src="`https://www.youtube.com/embed/${cam.videoId}?autoplay=1&mute=1&playsinline=1`"
            :title="title"
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen
          />
          <button class="close" type="button" :aria-label="`${title} 닫기`" @click="stop('closed')">✕</button>
        </template>
      </div>
    </div>
  </article>
</template>

<style scoped>
.card { position: relative; padding: 12px; border-radius: 20px; background: var(--surface); box-shadow: 0 4px 16px #1d4f7014; }
.card h4 { margin: 4px 4px 10px; font-size: 1.05rem; letter-spacing: -0.02em; }
.slot { aspect-ratio: 16 / 9; }
.screen { position: relative; display: grid; place-items: center; box-sizing: border-box; width: 100%; height: 100%; overflow: hidden; border-radius: 16px; background: linear-gradient(160deg, var(--ice-light), #c4deee); color: var(--blue-dark); font-weight: 600; }
.screen :deep(video), .screen iframe { width: 100%; height: 100%; border: 0; background: #000; }
.close { position: absolute; top: 8px; right: 8px; display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 999px; background: #0009; color: #fff; font-size: 0.8rem; line-height: 1; cursor: pointer; opacity: 0.55; transition: opacity 0.15s; }
.close:hover, .close:focus-visible { opacity: 1; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.status { flex: 1 1 100%; padding: 4px; color: var(--muted); font-size: 0.9rem; }
.actions button, .actions a { display: inline-flex; flex: 1 1 auto; align-items: center; justify-content: center; min-height: 44px; padding: 0 12px; border: 0; border-radius: 999px; font: inherit; font-size: 0.85rem; font-weight: 700; white-space: nowrap; text-decoration: none; cursor: pointer; }
.actions .play, .actions .popup { background: var(--blue); color: #fff; }
.actions .play:hover, .actions .popup:hover { background: var(--blue-dark); }
.error { margin: 0 0 8px; padding: 6px 10px; border-radius: 12px; background: #fff; color: #9a1f1f; font-size: 0.85rem; text-align: center; }
.done { margin: 0 0 8px; padding: 6px 10px; border-radius: 12px; background: var(--ice-light); color: var(--blue-dark); font-size: 0.85rem; text-align: center; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
