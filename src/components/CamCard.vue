<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { Cam, Resort } from '../data/cams'
import { isPlayable } from '../data/sortResorts'
import { playingCamId } from '../playingCam'
import HlsPlayer from './HlsPlayer.vue'

const props = defineProps<{ resort: Resort; cam: Cam }>()

const isPlaying = computed(() => playingCamId.value === props.cam.id)
const hasError = ref(false)
const screen = ref<HTMLElement>()
const isLarge = ref(false)
// Popover를 지원하지 않는 구형 브라우저에서는 크게 보기를 숨긴다.
const canEnlarge = computed(() => isPlayable(props.cam) && 'showPopover' in HTMLElement.prototype)
const title = computed(() => `${props.resort.name} ${props.cam.name}`)
const href = computed(() => (props.cam.type === 'link' && props.cam.url) || props.resort.officialPage)

async function play() {
  hasError.value = false
  playingCamId.value = props.cam.id
  await nextTick()
  screen.value?.querySelector<HTMLElement>('video, iframe')?.focus()
}

// 하이원 공식 팝업과 같은 크기다.
function openPopup(url: string) {
  window.open(url, '_blank', 'popup,noopener,noreferrer,width=680,height=550')
}

function enlarge() {
  screen.value?.showPopover()
  if (!isPlaying.value) play()
}

async function stop(failed: boolean) {
  if (!isPlaying.value) return // 이미 꺼진 카드의 늦은 이벤트가 다른 영상을 끄지 않게 한다.
  const hadFocus = screen.value?.contains(document.activeElement)
  playingCamId.value = null
  hasError.value = failed
  await nextTick()
  if (hadFocus) screen.value?.querySelector<HTMLElement>('.play')?.focus()
}
</script>

<template>
  <article class="card">
    <div class="slot">
      <div
        ref="screen"
        class="screen"
        popover="auto"
        :role="isLarge ? 'dialog' : undefined"
        :aria-label="isLarge ? title : undefined"
        @toggle="isLarge = ($event as ToggleEvent).newState === 'open'"
      >
        <template v-if="isPlaying">
          <HlsPlayer
            v-if="cam.type === 'hls'"
            :url="cam.url"
            :play-limit-sec="cam.playLimitSec"
            :label="title"
            @end="stop(false)"
            @error="stop(true)"
          />
          <iframe
            v-else-if="cam.type === 'youtube'"
            :src="`https://www.youtube.com/embed/${cam.videoId}?autoplay=1&mute=1&playsinline=1`"
            :title="title"
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen
          />
        </template>
        <button v-else-if="isPlayable(cam)" class="play" type="button" :aria-label="`${title} 재생`" @click="play">
          ▶ 재생<span v-if="cam.type === 'hls'"> ({{ cam.playLimitSec }}초)</span>
        </button>
        <span v-else-if="cam.status === 'pending'">오픈 준비 중</span>
        <span v-else-if="cam.status === 'investigate'">지금은 영상이 나오지 않아요</span>
        <a
          v-else-if="cam.type === 'hls' && cam.popupUrl"
          class="popup"
          :href="cam.popupUrl"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`${title} 영상 보기, 새 창`"
          @click.prevent="openPopup(cam.popupUrl)"
        >▶ 영상 보기 (새 창)</a>
        <span v-else>공식 페이지에서 볼 수 있어요</span>
        <p v-if="hasError" class="error" role="alert">지금은 영상을 볼 수 없어요. 잠시 후 다시 눌러 주세요.</p>
        <button v-if="isLarge" class="close" type="button" @click="screen?.hidePopover()">✕ 닫기</button>
      </div>
    </div>
    <h3>{{ cam.name }}</h3>
    <div class="actions">
      <button v-if="canEnlarge" class="enlarge" type="button" @click="enlarge">
        <span class="for-pc">팝업으로 보기</span><span class="for-mobile">큰 화면 보기</span><span class="sr-only"> ({{ title }})</span>
      </button>
      <a :href="href" target="_blank" rel="noopener noreferrer">공식 웹캠 열기<span class="sr-only"> ({{ title }}, 새 창)</span></a>
    </div>
  </article>
</template>

<style scoped>
.card { position: relative; padding: 12px; border: 1px solid #8886; border-radius: 12px; }
.card h3 { margin: 12px 0 4px; font-size: 1.1rem; }
.slot { aspect-ratio: 16 / 9; }
.screen { position: relative; inset: auto; display: grid; place-items: center; box-sizing: border-box; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; overflow: hidden; border-radius: 8px; background: #111; color: #eee; }
.screen :deep(video), .screen iframe, .play { width: 100%; height: 100%; border: 0; }
.play { background: transparent; color: inherit; font: inherit; cursor: pointer; }
.popup { display: grid; place-items: center; width: 100%; height: 100%; color: inherit; text-decoration: none; }
.error { position: absolute; inset: auto 8px 8px; margin: 0; text-align: center; pointer-events: none; }
.close { position: absolute; top: 8px; right: 8px; min-height: 44px; padding: 0 14px; border: 0; border-radius: 8px; background: #000c; color: #fff; font: inherit; cursor: pointer; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.enlarge { min-height: 44px; padding: 0 14px; font: inherit; cursor: pointer; }
.for-mobile { display: none; }
.screen:popover-open { position: fixed; inset: 0; width: min(92vw, calc(88dvh * 16 / 9)); height: auto; aspect-ratio: 16 / 9; margin: auto; }
.screen::backdrop { background: #000b; }
@media (max-width: 767px), (pointer: coarse) {
  .for-pc { display: none; }
  .for-mobile { display: inline; }
  .screen:popover-open { width: 100vw; max-width: none; height: 100dvh; max-height: none; aspect-ratio: auto; border-radius: 0; }
}
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
