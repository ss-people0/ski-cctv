// 오투리조트 웹캠 중계 규칙.
// 원본이 http:8080이라 https 사이트에서 막힌다. 채널 번호와 파일 이름이 순서대로 맞지 않아
// (ch4~7 → cam20~23) 채널의 플레이어 페이지를 받아 실제 파일 이름을 먼저 확인한다.
import { rewriteTo } from './lib.js'

export const O2_ORIGIN = 'http://118.46.149.144:8080'
export const O2_PAGE = (ch) => `${O2_ORIGIN}/streaming/streamhls2.jsp?ch=${ch}`

const CH = /^[0-7]$/ // 오투 채널 0~7
const FILE = /^cam\d+\.m3u8$|^cam\d+\.ts$/ // cam0.m3u8 → cam0783.ts 처럼 조각 이름도 cam+숫자다

export const isChannel = (ch) => typeof ch === 'string' && CH.test(ch)
export const isFile = (f) => typeof f === 'string' && FILE.test(f)

/** 채널 플레이어 페이지(streamhls2.jsp)에서 그 채널이 쓰는 m3u8 파일 이름을 뽑는다. 없으면 null. */
export function extractCamFile(html) {
  const match = /\/ramdisk\/(cam\d+\.m3u8)/.exec(String(html ?? ''))
  return match ? match[1] : null
}

/** 파일 이름이 허용 값이면 오투 원본 주소, 아니면 null */
export function upstreamUrl(f) {
  if (!isFile(f)) return null
  return `${O2_ORIGIN}/ramdisk/${f}`
}

/** m3u8 안의 조각 이름 줄을 다시 이 중계 주소(o2?ch=..&f=..)로 바꾼다. */
export function rewritePlaylist(text, ch) {
  return rewriteTo(text, (name) => (isFile(name) ? `o2?ch=${ch}&f=${encodeURIComponent(name)}` : null))
}
