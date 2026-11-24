import type { Cam, Resort } from './cams'

// https 페이지에서는 브라우저가 http 스트림을 막는다(하이원).
const isBlockedByHttps = (cam: Cam) =>
  location.protocol === 'https:' && cam.type === 'hls' && cam.url.startsWith('http:')

export const isPlayable = (cam: Cam) => cam.status === 'active' && cam.type !== 'link' && !isBlockedByHttps(cam)

const STATUS_RANK = { active: 1, investigate: 2, pending: 3 } as const

const camRank = (cam: Cam) => (isPlayable(cam) ? 0 : STATUS_RANK[cam.status])

// 스키장은 데이터 순서를 유지하고, 캠만 바로 재생 → 링크 → 확인 필요 → 오픈 전 순서로 둔다.
export const sortResorts = (resorts: readonly Resort[]): Resort[] =>
  resorts.map((resort) => ({ ...resort, cams: [...resort.cams].sort((a, b) => camRank(a) - camRank(b)) }))
