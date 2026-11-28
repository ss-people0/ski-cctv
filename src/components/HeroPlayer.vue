<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import type { Resort } from '../data/cams'
import { playingCamId } from '../playingCam'
import HlsPlayer from './HlsPlayer.vue'

// 상세 상단 일러스트 위에 겹쳐 뜨는 플레이어. 아래 CCTV 목록에서 고른 캠을 여기서 튼다.
const props = defineProps<{ resort: Resort }>()

const cam = computed(() => props.resort.cams.find((c) => c.id === playingCamId.value) ?? null)
const title = computed(() => (cam.value ? `${props.resort.name} ${cam.value.name}` : ''))
const notice = shallowRef('') // 오류가 났을 때 일러스트 위에 남기는 안내

watch(playingCamId, (id) => {
  if (id) notice.value = ''
})

// 화면을 끄거나 다른 앱·탭으로 가면 멈춘다(보이지 않는 채 계속 받아오지 않게).
const stopWhenHidden = () => {
  if (document.hidden) playingCamId.value = null
}
onMounted(() => document.addEventListener('visibilitychange', stopWhenHidden))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', stopWhenHidden))

const NOTICES = {
  error: '지금은 영상을 볼 수 없어요. 잠시 후 다시 눌러 주세요.',
  ended: '미리보기가 끝났어요. 이름을 다시 누르면 이어서 볼 수 있어요.',
  closed: '',
}
function stop(outcome: keyof typeof NOTICES) {
  notice.value = NOTICES[outcome]
  playingCamId.value = null
}
</script>

<template>
  <Transition name="hero-fade">
    <div v-if="cam" class="hero-player">
      <HlsPlayer
        v-if="cam.type === 'hls'"
        :key="cam.id"
        :url="cam.url"
        :play-limit-sec="cam.playLimitSec"
        :label="title"
        :continuous="!cam.previewOnly"
        @end="stop('ended')"
        @error="stop('error')"
      />
      <iframe
        v-else-if="cam.type === 'youtube'"
        :key="cam.id"
        :src="`https://www.youtube.com/embed/${cam.videoId}?autoplay=1&mute=1&playsinline=1`"
        :title="title"
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      />
      <span v-if="cam.type !== 'youtube'" class="now-name">{{ cam.name }}</span><!-- 유튜브는 자체 제목이 있어 겹치지 않게 뺀다 -->
      <button class="close" type="button" :aria-label="`${title} 닫기`" @click="stop('closed')">✕</button>
    </div>
  </Transition>
  <p v-if="!cam && notice" class="hero-notice" role="status">{{ notice }}</p>
</template>

<style scoped>
.hero-player { position: absolute; inset: 0; z-index: 3; background: #000; }
.hero-player :deep(video), .hero-player iframe { display: block; width: 100%; height: 100%; border: 0; object-fit: contain; }
/* 왼쪽 위 = 캠 이름, 오른쪽 위 = LIVE + 닫기 */
.hero-player :deep(.countdown) { top: 20px; left: auto; right: 66px; }
.now-name { position: absolute; top: 20px; left: 14px; max-width: calc(100% - 160px); padding: 3px 10px; overflow: hidden; border-radius: 999px; background: #0009; color: #fff; font-size: 0.75rem; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; }
.close { position: absolute; top: 10px; right: 12px; display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 999px; background: #000a; color: #fff; font-size: 1.25rem; font-weight: 700; cursor: pointer; }
.hero-notice { position: absolute; right: 12px; bottom: 12px; left: 12px; z-index: 2; margin: 0; padding: 8px 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.9); color: var(--blue-dark); font-size: 0.82rem; font-weight: 700; text-align: center; }
.hero-fade-enter-active, .hero-fade-leave-active { transition: opacity 0.35s ease; }
.hero-fade-enter-from, .hero-fade-leave-to { opacity: 0; }
</style>
