// 슬로프 현황 JSON(public/data/slopes.json)을 읽어 카드에 보일 한 줄 배지로 만든다.
// 수집은 scripts/collect_slopes.py가 GitHub Actions에서 담당한다.

export interface SlopeRow {
  name: string
  day?: string | null
  night?: string | null
  state?: string | null // 휘팍처럼 주간/야간을 한 칸(state)으로 주는 경우
}

export interface SlopeHour {
  label: string
  value: string
}

export type SlopeStatusCode = 'ok' | 'partial' | 'stale' | 'error' | 'skipped'

export interface ResortSlopeStatus {
  id: string
  status: SlopeStatusCode
  sourceDate: string | null // 사이트가 밝힌 기준일 (YYYY-MM-DD), 없으면 null
  fetchedAt: string | null // 조회 시각 ISO (+09:00)
  hours: SlopeHour[]
  slopes: SlopeRow[]
  note: string | null
  nightOpen?: boolean // 오늘 야간 슬로프가 열렸는지 (평일 미운영·주말 운영이 섞임)
}

export interface SlopesFile {
  generatedAt: string
  timezone: string
  resorts: ResortSlopeStatus[]
}

const isOpen = (row: SlopeRow) => row.day === 'OPEN' || row.night === 'OPEN' || row.state === 'OPEN'

// 지금 열린 슬로프 이름들. 휘팍은 한 슬로프가 주간/야간 레코드로 나뉘므로 이름으로 중복을 없앤다.
const openNamesOf = (slopes: SlopeRow[]): string[] =>
  [...new Set(slopes.filter(isOpen).map((s) => s.name))]

export interface SlopeHourLine extends SlopeHour {
  off?: boolean // 지금 그 시간대가 미운영(예: 평일 야간)
}

export interface SlopeSummary {
  summary: string // 지금 운영 중인 슬로프 (예: "핑크, 뉴레드 운영 중")
  hours: SlopeHourLine[] // 주간/정설/야간 — 화면에서 줄마다 하나씩 표시
}

// 슬로프 현황. 보여 줄 게 없으면 null → 설명란에 안내 문구를 대신 띄운다.
export function formatSlopeBadge(entry: ResortSlopeStatus | undefined, todayKst: string): SlopeSummary | null {
  if (!entry || entry.status === 'error' || entry.status === 'skipped') return null

  // 아직 올 시즌 오픈 예정일이 안 나온 곳(지난 시즌 값 그대로거나 데이터 비어 있음)은 당분간 숨긴다.
  // 리조트가 올 시즌 값을 올리면(status ok + 오늘 기준일) 자동으로 다시 표시된다.
  if (entry.status === 'stale') return null
  if (entry.sourceDate !== null && entry.sourceDate !== todayKst) return null
  if (entry.slopes.length === 0) return null

  const openNames = openNamesOf(entry.slopes)
  const summary = openNames.length ? `${openNames.join(', ')} 운영 중` : '운영 중인 슬로프 없음'
  // 야간 줄은 오늘 야간 슬로프가 안 열렸으면 미운영으로 표시한다.
  const hours = entry.hours.map((h) => ({
    ...h,
    off: h.label === '야간' && entry.nightOpen === false,
  }))
  return { summary, hours }
}

// 오늘 날짜(KST) YYYY-MM-DD
export function todayKst(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

// 정적 JSON을 읽어 리조트 id → 상태 맵으로. 파일이 없거나 실패하면 빈 맵(페이지는 그대로 동작).
export async function loadSlopeStatus(baseUrl: string): Promise<Map<string, ResortSlopeStatus>> {
  const result = new Map<string, ResortSlopeStatus>()
  if (typeof fetch !== 'function') return result
  try {
    const res = await fetch(`${baseUrl}data/slopes.json`, { cache: 'no-store' })
    if (!res.ok) return result
    const data = (await res.json()) as SlopesFile
    for (const resort of data.resorts) result.set(resort.id, resort)
  } catch {
    // 네트워크 실패·파일 없음 → 슬로프 줄만 안 보이게 두고 넘어간다.
  }
  return result
}
