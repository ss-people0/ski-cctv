// 곤지암리조트 웹캠 중계 규칙. 원본이 http(80)라 https 사이트에서 막힌다.
// 하이원과 파일 이름 규칙이 같다(playlist.m3u8 → chunklist_wNNN.m3u8 → media_wNNN_NNN.ts).
import { rewriteTo } from './lib.js'

export const KONJIAM_ORIGIN = 'http://konjiam.live.cdn.cloudn.co.kr/konjiam'

const CAM = /^cam0[1-5]$/ // 곤지암 캠 5대
const FILE = /^(playlist|chunklist_w\d+)\.m3u8$|^media_w\d+_\d+\.ts$/

export const isCam = (cam) => typeof cam === 'string' && CAM.test(cam)
export const isFile = (f) => typeof f === 'string' && FILE.test(f)

/** cam·f가 허용된 값이면 곤지암 원본 주소, 아니면 null */
export function upstreamUrl(cam, f) {
  if (!isCam(cam) || !isFile(f)) return null
  return `${KONJIAM_ORIGIN}/${cam}.stream/${f}`
}

/** m3u8 안의 파일 이름 줄을 다시 이 중계 주소(konjiam?cam=..&f=..)로 바꾼다. */
export function rewritePlaylist(text, cam) {
  return rewriteTo(text, (name) => (isFile(name) ? `konjiam?cam=${cam}&f=${encodeURIComponent(name)}` : null))
}
