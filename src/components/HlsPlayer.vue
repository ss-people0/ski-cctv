<script setup lang="ts">
import Hls from 'hls.js'
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'

const props = defineProps<{ url: string; playLimitSec: number; label: string }>()
const emit = defineEmits<{ end: []; error: [] }>()

const video = shallowRef<HTMLVideoElement>()
const remaining = shallowRef(props.playLimitSec)
const started = shallowRef(false)
let hls: Hls | undefined
let timer: ReturnType<typeof setInterval> | undefined

// clearTimeout과 clearInterval은 같은 id 목록을 공유하므로 둘 다 호출해도 안전하다.
function clearTimer() {
  clearTimeout(timer)
  clearInterval(timer)
}

// 메타데이터가 오면 시청 제한 카운트다운을 시작한다.
function startLimit() {
  clearTimer()
  started.value = true
  remaining.value = props.playLimitSec
  timer = setInterval(() => {
    remaining.value -= 1
    if (remaining.value <= 0) {
      clearTimer()
      emit('end')
    }
  }, 1000)
}

onMounted(() => {
  const el = video.value!
  // 로딩이 멈춰도 요청이 계속되지 않게 같은 시간 안에 끊는다.
  timer = setTimeout(() => emit('error'), props.playLimitSec * 1000)
  if (Hls.isSupported()) {
    hls = new Hls()
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) emit('error')
    })
    hls.loadSource(props.url)
    hls.attachMedia(el)
  } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
    el.src = props.url
  } else {
    emit('error')
  }
})

onBeforeUnmount(() => {
  clearTimer()
  hls?.destroy()
  // 네이티브 재생은 src를 비워야 네트워크 요청이 멈춘다.
  video.value?.removeAttribute('src')
  video.value?.load()
})
</script>

<template>
  <div class="player">
    <video
      ref="video"
      tabindex="0"
      :aria-label="label"
      autoplay
      muted
      playsinline
      controls
      @loadedmetadata="startLimit"
      @error="emit('error')"
    />
    <span v-if="started" class="countdown" aria-hidden="true">미리보기 {{ remaining }}초</span>
  </div>
</template>

<style scoped>
.player { display: contents; }
.countdown { position: absolute; top: 8px; left: 8px; padding: 3px 10px; border-radius: 999px; background: #0009; color: #fff; font-size: 0.75rem; font-weight: 700; pointer-events: none; }
</style>
