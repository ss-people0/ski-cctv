<script setup lang="ts">
import Hls from 'hls.js'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ url: string; playLimitSec: number; label: string }>()
const emit = defineEmits<{ end: []; error: [] }>()

const video = ref<HTMLVideoElement>()
let hls: Hls | undefined
let limitTimer: ReturnType<typeof setTimeout> | undefined

function startLimit() {
  clearTimeout(limitTimer)
  limitTimer = setTimeout(() => emit('end'), props.playLimitSec * 1000)
}

onMounted(() => {
  const el = video.value!
  // 로딩이 멈춰도 요청이 계속되지 않게 같은 시간 안에 끊는다.
  limitTimer = setTimeout(() => emit('error'), props.playLimitSec * 1000)
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
  clearTimeout(limitTimer)
  hls?.destroy()
  // 네이티브 재생은 src를 비워야 네트워크 요청이 멈춘다.
  video.value?.removeAttribute('src')
  video.value?.load()
})
</script>

<template>
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
</template>
