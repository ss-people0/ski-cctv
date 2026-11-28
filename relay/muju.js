// 무주덕유산리조트 웹캠 중계 규칙.
// 원본이 http(80)이고, master playlist 주소에 9시간짜리 서명 토큰(?e=만료시각&h=해시)이 붙어 온다.
// 토큰은 팝업 페이지(http://www.mdysresort.com/guide/webcam_popup_jh.asp?cam_num=NN)를 받아 뽑는다.
import { rewriteTo } from './lib.js'

export const MUJU_ORIGIN = 'http://muju.cache.cdn.cloudn.co.kr/mujuresort/_definst_'
export const MUJU_PAGE = (cam) => `http://www.mdysresort.com/guide/webcam_popup_jh.asp?cam_num=${cam}`

const CAM = /^(0[1-9]|1[01])$/ // 무주 캠 01~11
const FILE = /^(playlist|chunklist_w\d+)\.m3u8$|^media_w\d+_\d+\.ts$/

export const isCam = (cam) => typeof cam === 'string' && CAM.test(cam)
export const isFile = (f) => typeof f === 'string' && FILE.test(f)

/** 팝업 페이지 HTML에서 캠 번호와 서명 토큰(e·h)을 뽑는다. 없으면 null. */
export function extractStream(html) {
  const match = /https?:\/\/muju\.cache\.cdn\.cloudn\.co\.kr\/mujuresort\/[a-z_]+\/cam(\d{2})\.stream\/playlist\.m3u8\?[^"'\s<>]+/.exec(
    String(html ?? ''),
  )
  if (!match) return null
  const params = new URL(match[0]).searchParams
  const e = params.get('e')
  const h = params.get('h')
  if (!e || !h) return null
  return { cam: match[1], e, h }
}

/** cam·f·토큰이 모두 있으면 무주 원본 주소, 아니면 null */
export function upstreamUrl(cam, f, token) {
  if (!isCam(cam) || !isFile(f)) return null
  if (!token || !token.e || !token.h) return null
  const query = `e=${encodeURIComponent(token.e)}&h=${encodeURIComponent(token.h)}`
  return `${MUJU_ORIGIN}/cam${cam}.stream/${f}?${query}`
}

/** m3u8 안의 파일 이름 줄을 다시 이 중계 주소(muju?cam=..&f=..)로 바꾼다. 토큰은 중계가 다시 붙인다. */
export function rewritePlaylist(text, cam) {
  return rewriteTo(text, (name) => (isFile(name) ? `muju?cam=${cam}&f=${encodeURIComponent(name)}` : null))
}
