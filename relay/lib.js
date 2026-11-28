// 하이원 웹캠 중계 규칙. https 사이트에서 막히는 http 스트림(:1935)을 https로 넘겨주기 위한 것.
// 공개 프록시가 되지 않도록 하이원 캠 1~18번의 정해진 파일 이름만 통과시킨다.

export const ORIGIN = 'http://59.30.12.195:1935/live'

// 우리 사이트(배포·로컬 개발)에서만 브라우저가 읽을 수 있게 한다.
export const ALLOWED_ORIGINS = [/^https:\/\/ss-people0\.github\.io$/, /^http:\/\/localhost:\d+$/, /^http:\/\/192\.168\.\d+\.\d+:\d+$/]

const CHANNEL = /^([1-9]|1[0-8])$/ // 하이원 캠 ch1~ch18
const FILE = /^(playlist|chunklist_w\d+)\.m3u8$|^media_w\d+_\d+\.ts$/

/** ch·f가 허용된 값이면 하이원 원본 주소, 아니면 null */
export function upstreamUrl(ch, f) {
  if (typeof ch !== 'string' || typeof f !== 'string') return null
  if (!CHANNEL.test(ch) || !FILE.test(f)) return null
  return `${ORIGIN}/ch${ch}.stream/${f}`
}

/** m3u8 안의 파일 이름 줄을 다시 이 중계 주소(high1?ch=..&f=..)로 바꾼다. 허용 안 되는 줄은 지운다. */
export function rewritePlaylist(text, ch) {
  return text
    .split('\n')
    .map((line) => {
      const name = line.trim()
      if (!name || name.startsWith('#')) return line
      return upstreamUrl(ch, name) ? `high1?ch=${ch}&f=${encodeURIComponent(name)}` : ''
    })
    .join('\n')
}

export function allowOrigin(origin) {
  return typeof origin === 'string' && ALLOWED_ORIGINS.some((re) => re.test(origin)) ? origin : null
}
