// 슬로프 현황 JSON(public/data/slopes.json)을 읽어 카드에 보일 한 줄 배지로 만든다.
// 수집은 scripts/collect_slopes.py가 GitHub Actions에서 담당한다.
import { mixHex } from './themes'


export interface SlopeRow {
  name: string
  day?: string | null
  night?: string | null
  state?: string | null // 휘팍처럼 주간/야간을 한 칸(state)으로 주는 경우
  slot?: string | null // 휘팍: 같은 슬로프가 주간/야간 행으로 나뉠 때의 구분
  level?: string | null // 스키장 공식 난이도(초급·초중급·중급·…·파크·익스트림)
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

export interface UpcomingOpening {
  name: string // 슬로프 이름
  date: string // 오픈일 YYYY-MM-DD (KST)
  time?: string // 오픈 시각 HH:MM(공지에 없으면 생략)
}

// 이 이름이면 슬로프 하나가 아니라 스키장 전체 개장 안내다.
export const RESORT_OPENING = '스키장'

// 오픈 예정 안내 문구. 손으로 넣은 데이터를 안 지워도 화면에서 저절로 빠진다:
// - 오픈 당일부터(date <= today)
// - 그 전이라도 공식 현황(board)에서 그 슬로프가 개방으로 잡히면 / '스키장'은 개방 슬로프가 하나라도 잡히면
// '내일/오늘/D-n'은 자정을 넘기면 헷갈리므로 날짜만 쓴다. YYYY-MM-DD 문자열 비교로 충분하다.
export function formatUpcoming(
  items: readonly UpcomingOpening[] | undefined,
  today: string,
  board?: SlopeBoard | null,
): string[] {
  const live = board && !board.preseason ? board : null // 지난 시즌 값의 OPEN은 믿지 않는다
  const openNames = new Set(live?.groups.flatMap((g) => g.chips).filter((c) => c.status === 'open').map((c) => c.name))
  const isOpenNow = (name: string) => (name === RESORT_OPENING ? (live?.openCount ?? 0) > 0 : openNames.has(name))
  return (items ?? [])
    .filter(({ name, date }) => date > today && !isOpenNow(name))
    .map(({ name, date, time }) => {
      const when = `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일${time ? ` ${time}` : ''}`
      return `${name} ${when} 오픈 예정`
    })
}

// ───────── 상세 화면 슬로프 운영 현황(난이도별 칩) ─────────

export type ChipStatus = 'open' | 'closed' | 'upcoming' | 'unknown'

export interface SlopeChip {
  name: string
  status: ChipStatus
  nightOnly: boolean // 야간에만 열림(🌙 표시)
}

export interface LevelGroup {
  level: string // 공식 난이도. 데이터에 없으면 ''(이름표 없이 표시)
  chips: SlopeChip[]
}

export interface SlopeBoard {
  openCount: number
  total: number // 공식 표에 있는 전체 슬로프 수(같은 이름의 주간/야간 행은 하나로 셈)
  groups: LevelGroup[]
  hours: SlopeHourLine[]
  preseason: boolean // 사이트에 지난 시즌 값만 있음 → 올 시즌 오픈 전으로 보고 전부 미개방
}

const LEVEL_ORDER = ['초급', '초중급', '중급', '중상급', '상급', '최상급']

const isKnown = (row: SlopeRow) => [row.day, row.night, row.state].some((v) => v != null)
const isNightRow = (row: SlopeRow) => row.night === 'OPEN' || (row.slot?.includes('야간') && row.state === 'OPEN')
const isDayRow = (row: SlopeRow) => row.day === 'OPEN' || (!row.slot?.includes('야간') && row.state === 'OPEN')

function toChip(name: string, rows: SlopeRow[], upcomingNames: ReadonlySet<string>): SlopeChip {
  const open = rows.some(isOpen)
  const nightOnly = open && rows.some(isNightRow) && !rows.some(isDayRow)
  if (open) return { name, status: 'open', nightOnly }
  if (upcomingNames.has(name)) return { name, status: 'upcoming', nightOnly: false }
  return { name, status: rows.some(isKnown) ? 'closed' : 'unknown', nightOnly: false }
}

// 공식 슬로프 안내(맵)에서 옮긴 고정 목록. 실시간 목록이 비어 있을 때만 쓴다(cams.ts slopeCatalog).
export interface CatalogSlope {
  name: string
  level: string
}

// 공식 표 전체를 난이도별 칩으로. 수집 실패·목록 없음이면 null.
// 지난 시즌 값만 걸린 곳(지산·알펜시아)은 목록만 쓰고 옛 OPEN/CLOSE·운영시간은 버린다(전부 미개방).
// 실시간 목록이 아직 없는 곳(강촌 개장 전)은 공식 고정 목록(catalog)으로 전부 미개방을 보여준다.
export function buildSlopeBoard(
  entry: ResortSlopeStatus | undefined,
  today: string,
  upcoming?: readonly UpcomingOpening[],
  catalog?: readonly CatalogSlope[],
): SlopeBoard | null {
  if (entry?.status === 'error' || entry?.status === 'skipped') return null // 실패를 '미개방'으로 보이면 안 된다
  const live = entry && entry.slopes.length > 0 ? entry : undefined
  if (!live && !catalog?.length) return null
  const slopes: readonly SlopeRow[] = live?.slopes ?? catalog!.map(({ name, level }) => ({ name, level }))
  const badge = live ? formatSlopeBadge(live, today) : null
  const preseason = badge === null
  const toBoardChip = (name: string, rows: SlopeRow[], upcomingNames: ReadonlySet<string>): SlopeChip =>
    preseason
      ? { name, status: upcomingNames.has(name) ? 'upcoming' : 'closed', nightOnly: false }
      : toChip(name, rows, upcomingNames)

  const byName = new Map<string, SlopeRow[]>()
  for (const row of slopes) byName.set(row.name, [...(byName.get(row.name) ?? []), row])
  const upcomingNames = new Set((upcoming ?? []).filter((u) => u.date > today).map((u) => u.name))

  // 같은 난이도는 한 줄로 모은다(하이원은 공식 표가 구역 순이라 난이도가 섞여 나온다). 줄 안은 공식 표 순서.
  const byLevel = new Map<string, SlopeChip[]>()
  for (const [name, rows] of byName) {
    const level = rows[0].level ?? ''
    byLevel.set(level, [...(byLevel.get(level) ?? []), toBoardChip(name, rows, upcomingNames)])
  }
  const rank = (level: string) => (LEVEL_ORDER.includes(level) ? LEVEL_ORDER.indexOf(level) : LEVEL_ORDER.length)
  const groups = [...byLevel] // sort는 안정 정렬이라 모르는 등급끼리는 처음 나온 순서가 유지된다
    .map(([level, chips]) => ({ level, chips }))
    .sort((a, b) => rank(a.level) - rank(b.level))
  const chips = groups.flatMap((g) => g.chips)
  return {
    openCount: chips.filter((c) => c.status === 'open').length,
    total: chips.length,
    groups,
    hours: badge?.hours ?? [],
    preseason,
  }
}

// 난이도 이름 색(디자인 가이드). 사이 등급은 앞뒤 색을 섞고, 파크·익스트림 같은 특수 구역은 별도 색.
const LEVEL_BASE: Readonly<Record<string, string>> = {
  초급: '#399165',
  중급: '#467DBB',
  상급: '#CB625E',
  최상급: '#505160',
}
const SPECIAL_LEVEL = '#7A6F9B'
const UNKNOWN_LEVEL = '#64748B'

export function levelColor(level: string): string {
  if (LEVEL_BASE[level]) return LEVEL_BASE[level]
  if (level === '초중급') return mixHex(LEVEL_BASE.초급, LEVEL_BASE.중급, 0.5)
  if (level === '중상급') return mixHex(LEVEL_BASE.중급, LEVEL_BASE.상급, 0.5)
  if (/파크|익스트림|하프|모글/.test(level)) return SPECIAL_LEVEL
  return UNKNOWN_LEVEL
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
