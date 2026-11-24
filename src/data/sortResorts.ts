import type { Cam, Resort } from './cams'

export const isPlayable = (cam: Cam) => cam.status === 'active' && cam.type !== 'link'

const STATUS_RANK = { active: 1, investigate: 2, pending: 3 } as const

const camRank = (cam: Cam) => (isPlayable(cam) ? 0 : STATUS_RANK[cam.status])
const resortRank = (resort: Resort) => Math.min(...resort.cams.map(camRank))

// 바로 재생 → 링크 → 확인 필요 → 오픈 전 순서. 같은 순위는 데이터 순서를 유지한다.
export const sortResorts = (resorts: readonly Resort[]): Resort[] =>
  resorts
    .map((resort) => ({ ...resort, cams: [...resort.cams].sort((a, b) => camRank(a) - camRank(b)) }))
    .sort((a, b) => resortRank(a) - resortRank(b))
