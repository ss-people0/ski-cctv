// 웹캠 중계 규칙. https 사이트에서 막히는 http 스트림을 https로 넘겨주기 위한 것.
// 공개 프록시가 되지 않도록 리조트별로 정해진 채널·파일 이름만 통과시킨다.

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

/** 응답 헤더용 CORS. 허용 목록에 없는 출처에는 우리 사이트 주소만 적어 준다(브라우저가 막는다). */
export function corsHeaders(origin) {
  return { 'Access-Control-Allow-Origin': allowOrigin(origin) ?? 'https://ss-people0.github.io', Vary: 'Origin' }
}

/** m3u8 목록의 한 줄에서 실제 파일 이름만 뽑는다. 무주는 줄 끝에 ?e=..&h=.. 토큰이 붙어 온다. */
export function playlistName(line) {
  const trimmed = typeof line === 'string' ? line.trim() : ''
  if (!trimmed || trimmed.startsWith('#')) return null
  return trimmed.split('?')[0]
}

/** m3u8 안의 파일 이름 줄을 toRelay가 돌려주는 중계 주소로 바꾼다. null이면 그 줄을 지운다. */
export function rewriteTo(text, toRelay) {
  return text
    .split('\n')
    .map((line) => {
      if (!line.trim() || line.trim().startsWith('#')) return line
      return toRelay(playlistName(line)) ?? ''
    })
    .join('\n')
}

/** 중계가 원본을 받아올 때 쓰는 공통 설정(원본이 브라우저 User-Agent를 요구하는 곳이 있다). */
export const FETCH_OPTS = {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' },
  redirect: 'follow',
  signal: AbortSignal.timeout(10000),
}
