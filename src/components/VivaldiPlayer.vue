<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

// 비발디파크 온라인캠 전용 플레이어.
// 소노호텔리조트가 쓰는 Wisenet WESP SDK(WespJSSDKEncV4)를 불러와 WebSocket 영상을 그린다.
// SDK는 우리가 넘긴 id의 <div> 안에 직접 캔버스를 넣고, 영상 크기·비율은 그쪽이 정한다.
// hls.js로는 재생할 수 없는 형식이라 이 컴포넌트만 따로 둔다.
const props = defineProps<{ channel: number; serial: string; token: string; label: string; playLimitSec: number; fallbackUrl: string }>()
// 오류는 이 안에서 안내와 '다시 시도' 버튼으로 처리한다(상단 플레이어를 닫지 않는다).
const emit = defineEmits<{ end: [] }>()

const SDK_URL = 'https://www.sonohotelsresorts.com/wespJSSDKEncV4.min.js'
const LOAD_TIMEOUT_MS = 12000
// 재생이 시작됐는데도 화면이 안 들어오면(장비·회선 문제) '다시 시도' 안내로 바꾼다.
const FRAME_WAIT_MS = 8000

type VivaldiController = {
  init(onReady: () => void, onFail?: (error: unknown) => void): void
  changeLayout(count: number, firstChannel: number): void
  dispose(): void
}
type VivaldiSdk = {
  Logger?: { useDefaults?: () => void }
  MonitorUIController: new (id: string, siteInfo: Record<string, unknown>) => VivaldiController
}

declare global {
  interface Window {
    WespJSSDK?: VivaldiSdk
  }
}

const host = shallowRef<HTMLDivElement>()
const status = ref<'loading' | 'playing' | 'error'>('loading')
const remaining = ref(props.playLimitSec)

let controller: VivaldiController | undefined
let disposed = false
let loadTimer: ReturnType<typeof setTimeout> | undefined
let limitTimer: ReturnType<typeof setInterval> | undefined
let frameTimer: ReturnType<typeof setInterval> | undefined

// 같은 페이지에서 여러 번 켜도 id가 겹치지 않게 센다.
let playerSeq = 0
const playerId = `vivaldi-player-${++playerSeq}`

// SDK 스크립트는 한 번만 받아 두고, 여러 캠이 같은 약속을 나눠 쓴다.
let sdkPromise: Promise<VivaldiSdk> | undefined
function loadSdk(): Promise<VivaldiSdk> {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise<VivaldiSdk>((resolve, reject) => {
    if (window.WespJSSDK) {
      resolve(window.WespJSSDK)
      return
    }
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.onload = () => (window.WespJSSDK ? resolve(window.WespJSSDK) : reject(new Error('SDK empty')))
    script.onerror = () => reject(new Error('SDK load failed'))
    document.head.appendChild(script)
  }).catch((error) => {
    // 실패한 약속을 남겨 두면 다음 캠도 곧바로 실패한다. 다시 시도할 수 있게 지운다.
    sdkPromise = undefined
    throw error
  })
  return sdkPromise
}

function clearTimers() {
  clearTimeout(loadTimer)
  clearInterval(limitTimer)
  clearInterval(frameTimer)
}

// SDK는 로그인이 끝나면 콜백을 부른다. 하지만 그때는 아직 영상이 안 올 수 있어서,
// 실제로 프레임이 들어오는지 잠깐 지켜보고 안 들어오면 실패로 본다.
function watchFrames() {
  const from = Date.now()
  clearInterval(frameTimer)
  frameTimer = setInterval(() => {
    const video = host.value?.querySelector('video, canvas')
    const playing = video instanceof HTMLVideoElement ? video.readyState >= 2 || video.videoWidth > 0 : !!video
    if (playing) {
      clearInterval(frameTimer)
      return
    }
    if (Date.now() - from > FRAME_WAIT_MS) {
      clearInterval(frameTimer)
      fail()
    }
  }, 500)
}

function fail() {
  if (disposed) return
  clearTimers()
  status.value = 'error'
}

// 재생이 시작되면 미리보기 시간을 세고, 끝나면 멈춘다(사이트의 다른 캠과 같은 규칙).
function startLimit() {
  clearInterval(limitTimer)
  remaining.value = props.playLimitSec
  limitTimer = setInterval(() => {
    remaining.value -= 1
    if (remaining.value > 0) return
    clearInterval(limitTimer)
    if (!disposed) emit('end')
  }, 1000)
}

async function start() {
  if (disposed) return
  clearTimers()
  status.value = 'loading'
  remaining.value = props.playLimitSec
  loadTimer = setTimeout(fail, LOAD_TIMEOUT_MS)

  let sdk: VivaldiSdk
  try {
    sdk = await loadSdk()
  } catch (error) {
    console.error('[vivaldi] SDK를 불러오지 못했습니다', error)
    fail()
    return
  }
  if (disposed || !host.value) return

  const siteInfo = { channel: props.channel, serial: props.serial, stream: 'sub', text: props.token }
  try {
    sdk.Logger?.useDefaults?.()
    const created = new sdk.MonitorUIController(playerId, siteInfo)
    controller = created
    created.init(
      () => {
        if (disposed) {
          created.dispose()
          return
        }
        clearTimeout(loadTimer)
        // 한 채널만 보여 준다(SDK 기본은 여러 칸 격자다).
        created.changeLayout(1, siteInfo.channel - 1)
        status.value = 'playing'
        startLimit()
        watchFrames()
      },
      (error) => {
        console.error('[vivaldi] 재생을 시작하지 못했습니다', error)
        fail()
      },
    )
  } catch (error) {
    console.error('[vivaldi] 플레이어를 만들지 못했습니다', error)
    fail()
  }
}

function retry() {
  controller?.dispose()
  controller = undefined
  start()
}

onMounted(start)
onBeforeUnmount(() => {
  disposed = true
  clearTimers()
  controller?.dispose()
  controller = undefined
})
</script>

<template>
  <div class="vivaldi" role="group" :aria-label="label">
    <div :id="playerId" ref="host" class="wesp" />
    <p v-if="status === 'loading'" class="note" role="status">영상을 불러오는 중이에요…</p>
    <div v-else-if="status === 'error'" class="note error" role="status">
      <span>지금은 영상을 볼 수 없어요.</span>
      <div class="fallback">
        <button type="button" @click="retry">다시 시도</button>
        <a :href="fallbackUrl" target="_blank" rel="noopener noreferrer" :aria-label="`${label} 공식 페이지에서 보기, 새 창`">공식 페이지 ↗</a>
      </div>
    </div>
    <span v-if="status === 'playing'" class="countdown" aria-hidden="true">미리보기 {{ remaining }}초</span>
  </div>
</template>

<style scoped>
.vivaldi { position: absolute; inset: 0; overflow: hidden; background: #000; }
/* SDK가 넣는 표·영상은 장비가 알려 준 크기(예: 640x360)로 만들어지므로 우리 칸에 맞춰 늘린다. */
.wesp { position: absolute; inset: 0; overflow: hidden; }
.wesp :deep(table) { width: 100% !important; height: 100% !important; margin: 0 !important; border: 0 !important; }
.wesp :deep(tbody), .wesp :deep(tr), .wesp :deep(td) { width: 100% !important; height: 100% !important; border: 0 !important; }
.wesp :deep(.embed-responsive) { width: 100% !important; height: 100% !important; padding: 0 !important; }
.wesp :deep(video),
.wesp :deep(canvas),
.wesp :deep(iframe) {
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  object-fit: contain;
}
/* SDK는 문서 좌표로 캡션·시각·JPEG 사본·투명 판을 따로 그린다. 칸 안에서는 위치가 어툋나고
   내용도 우리 화면(이름·미리보기 시간)과 겹처서 숨긴다. */
.wesp :deep(.video-caption),
.wesp :deep(.video-timestamp),
.wesp :deep(.video-jpeg-image),
.wesp :deep(.transparent-panel) {
  display: none !important;
}
.note {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 16px;
  border-radius: 12px;
  background: #0009;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
  text-align: center;
  transform: translate(-50%, -50%);
}
.note.error { background: rgba(255, 255, 255, 0.92); color: var(--blue-dark); }
.note button {
  padding: 8px 16px;
  border: 1px solid var(--blue);
  border-radius: 999px;
  background: var(--surface);
  color: var(--blue-dark);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 800;
  cursor: pointer;
}
.fallback { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
.note a {
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 999px;
  color: var(--blue-dark);
  font-size: 0.85rem;
  font-weight: 800;
  text-decoration: none;
}
.countdown { position: absolute; top: 8px; left: 8px; padding: 3px 10px; border-radius: 999px; background: #0009; color: #fff; font-size: 0.75rem; font-weight: 700; pointer-events: none; }
</style>
