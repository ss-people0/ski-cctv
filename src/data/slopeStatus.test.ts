import { expect, test } from 'vitest'
import { buildSlopeBoard, formatNightStart, formatSlopeBadge, formatUpcoming, levelColor, type ResortSlopeStatus } from './slopeStatus'

const TODAY = '2026-11-25'

const make = (over: Partial<ResortSlopeStatus>): ResortSlopeStatus => ({
  id: 'r',
  status: 'ok',
  sourceDate: null,
  fetchedAt: '2026-11-25T16:30:12+09:00',
  hours: [],
  slopes: [],
  note: null,
  ...over,
})

test('today ok lists the open slope names and keeps hours as separate lines', () => {
  const badge = formatSlopeBadge(
    make({
      status: 'ok',
      sourceDate: TODAY,
      hours: [
        { label: '주간', value: '08:30~16:30' },
        { label: '정설', value: '16:30~18:00' },
      ],
      slopes: [
        { name: '핑크', day: 'OPEN', night: 'CLOSE' },
        { name: '뉴레드', day: 'OPEN', night: 'CLOSE' },
        { name: '블루', day: 'CLOSE', night: 'CLOSE' },
      ],
    }),
    TODAY,
  )
  expect(badge).toEqual({
    summary: '핑크, 뉴레드 운영 중',
    hours: [
      { label: '주간', value: '08:30~16:30', off: false },
      { label: '정설', value: '16:30~18:00', off: false },
    ],
  })
})

test('marks the 야간 line as off when night is not operating', () => {
  const badge = formatSlopeBadge(
    make({
      status: 'ok',
      sourceDate: TODAY,
      nightOpen: false,
      hours: [
        { label: '주간', value: '09:00~16:00' },
        { label: '야간', value: '18:00~22:00' },
      ],
      slopes: [{ name: '핑크', day: 'OPEN', night: 'CLOSE' }],
    }),
    TODAY,
  )
  expect(badge!.hours).toEqual([
    { label: '주간', value: '09:00~16:00', off: false },
    { label: '야간', value: '18:00~22:00', off: true },
  ])
})

test('no source date (하이원/휘닉스) still lists open slope names', () => {
  const badge = formatSlopeBadge(
    make({ sourceDate: null, slopes: [{ name: '제우스Ⅲ-1', day: 'OPEN', night: null }] }),
    TODAY,
  )
  expect(badge).toEqual({ summary: '제우스Ⅲ-1 운영 중', hours: [] })
})

test('past-season source date is hidden until this season opens', () => {
  const badge = formatSlopeBadge(
    make({ status: 'ok', sourceDate: '2026-03-01', slopes: [{ name: '1', day: 'OPEN', night: null }] }),
    TODAY,
  )
  expect(badge).toBeNull()
})

test('stale status is hidden', () => {
  const badge = formatSlopeBadge(
    make({ status: 'stale', sourceDate: '2026-03-03', slopes: [{ name: '알파', day: 'CLOSE', night: 'CLOSE' }] }),
    TODAY,
  )
  expect(badge).toBeNull()
})

test('empty data (강촌) is hidden, not shown as all-closed', () => {
  expect(formatSlopeBadge(make({ status: 'partial', sourceDate: TODAY, slopes: [] }), TODAY)).toBeNull()
})

test('lists open slopes from the state field and de-dupes by name (휘팍)', () => {
  const badge = formatSlopeBadge(
    make({
      sourceDate: null,
      hours: [{ label: '주간', value: '09:00~16:00' }],
      slopes: [
        { name: '도도', state: 'OPEN' }, // 주간 레코드
        { name: '도도', state: 'OPEN' }, // 야간 레코드 → 같은 슬로프라 한 번만
        { name: '호크', state: 'OPEN' },
        { name: '펭귄', state: 'CLOSE' },
      ],
    }),
    TODAY,
  )
  expect(badge).toEqual({ summary: '도도, 호크 운영 중', hours: [{ label: '주간', value: '09:00~16:00', off: false }] })
})

test('error and skipped hide the line entirely', () => {
  expect(formatSlopeBadge(make({ status: 'error' }), TODAY)).toBeNull()
  expect(formatSlopeBadge(make({ status: 'skipped' }), TODAY)).toBeNull()
  expect(formatSlopeBadge(undefined, TODAY)).toBeNull()
})

test('upcoming opening shows the absolute date (no D-day) and is removed from the opening day', () => {
  const yellow = [{ name: '옐로우', date: '2026-11-27', time: '08:30' }]
  // '내일/오늘/D-n'은 자정을 넘기면 헷갈리므로 날짜만 쓴다.
  expect(formatUpcoming(yellow, '2026-11-26')).toEqual(['옐로우 11월 27일 08:30 오픈 예정'])
  expect(formatUpcoming(yellow, '2026-11-27')).toEqual([]) // 오픈 당일부터 지운다
  expect(formatUpcoming(undefined, '2026-11-26')).toEqual([])
  // 공지에 시각이 없으면 날짜만(강촌).
  expect(formatUpcoming([{ name: '스키장', date: '2026-11-28' }], '2026-11-26')).toEqual(['스키장 11월 28일 오픈 예정'])
})

test('upcoming line is removed early once the official feed shows it open', () => {
  const today = '2026-11-26'
  const yellow = [{ name: '옐로우', date: '2026-11-27', time: '08:30' }]
  const resort = [{ name: '스키장', date: '2026-11-28' }]
  const board = (rows: { name: string; day: string }[]) => buildSlopeBoard(make({ sourceDate: today, slopes: rows }), today)

  // 슬로프 단위: 그 슬로프가 개방으로 잡히면 지운다.
  expect(formatUpcoming(yellow, today, board([{ name: '옐로우', day: 'OPEN' }]))).toEqual([])
  expect(formatUpcoming(yellow, today, board([{ name: '옐로우', day: 'CLOSE' }, { name: '핑크', day: 'OPEN' }]))).toHaveLength(1)
  // 스키장 단위: 개방 슬로프가 하나라도 잡히면 지운다.
  expect(formatUpcoming(resort, today, board([{ name: '래빗', day: 'OPEN' }]))).toEqual([])
  expect(formatUpcoming(resort, today, board([{ name: '래빗', day: 'CLOSE' }]))).toHaveLength(1)
  // 지난 시즌 값(개장 전)의 OPEN은 무시한다.
  const lastSeason = buildSlopeBoard(make({ status: 'stale', sourceDate: '2026-03-03', slopes: [{ name: '래빗', day: 'OPEN' }] }), today)
  expect(formatUpcoming(resort, today, lastSeason)).toHaveLength(1)
})

test('night operation start line shows the date, then disappears from that day or once night slopes open', () => {
  const night = { date: '2026-12-04' }
  expect(formatNightStart(night, '2026-11-27')).toBe('야간 운영 12월 4일 시작')
  expect(formatNightStart(night, '2026-12-03')).toBe('야간 운영 12월 4일 시작')
  expect(formatNightStart(night, '2026-12-04')).toBeNull() // 시작일부터는 안 띄운다
  expect(formatNightStart(night, '2026-12-10', true)).toBeNull() // 공식 현황에서 야간이 열렸으면 바로 빠진다
  expect(formatNightStart(undefined, '2026-11-27')).toBeNull()
})

test('slope board groups every slope by official level in source order with status per slope', () => {
  const board = buildSlopeBoard(
    make({
      sourceDate: TODAY,
      hours: [{ label: '주간', value: '08:30~16:30' }],
      slopes: [
        { name: '옐로우', level: '초급', day: 'CLOSE', night: 'CLOSE' },
        { name: '핑크', level: '초중급', day: 'OPEN', night: 'CLOSE' },
        { name: '레드', level: '최상급', day: 'CLOSE', night: 'OPEN' },
        { name: '실버', level: '최상급', day: null, night: null },
      ],
    }),
    TODAY,
  )
  expect(board?.openCount).toBe(2)
  expect(board?.total).toBe(4)
  expect(board?.groups).toEqual([
    { level: '초급', chips: [{ name: '옐로우', status: 'closed', nightOnly: false }] },
    { level: '초중급', chips: [{ name: '핑크', status: 'open', nightOnly: false }] },
    {
      level: '최상급',
      chips: [
        { name: '레드', status: 'open', nightOnly: true },
        { name: '실버', status: 'unknown', nightOnly: false }, // 상태값 없음 ≠ 미개방
      ],
    },
  ])
  expect(board?.hours).toEqual([{ label: '주간', value: '08:30~16:30', off: false }])
})

test('slope board merges day/night slot rows of the same slope (phoenix)', () => {
  const board = buildSlopeBoard(
    make({
      slopes: [
        { name: '호크', level: '중급', slot: '주간', state: 'CLOSE' },
        { name: '호크', level: '중급', slot: '야간', state: 'OPEN' },
        { name: '키위', level: '중급', state: 'CLOSE' },
      ],
    }),
    TODAY,
  )
  expect(board?.total).toBe(2)
  expect(board?.groups[0].chips).toEqual([
    { name: '호크', status: 'open', nightOnly: true },
    { name: '키위', status: 'closed', nightOnly: false },
  ])
})

test('upcoming slope shows as upcoming only while still closed (no duplicate when already open)', () => {
  const upcoming = [{ name: '옐로우', date: '2026-11-26', time: '08:30' }] // TODAY(11-25) 다음 날 오픈
  const slopes = (state: string) => [{ name: '옐로우', level: '초급', day: state, night: 'CLOSE' }]
  expect(buildSlopeBoard(make({ slopes: slopes('CLOSE') }), TODAY, upcoming)?.groups[0].chips[0].status).toBe('upcoming')
  expect(buildSlopeBoard(make({ slopes: slopes('OPEN') }), TODAY, upcoming)?.groups[0].chips[0].status).toBe('open')
  // 오픈 당일엔 실제로 열리기 전까지 칩은 '개방 예정'(문구는 당일에 빠짐), 다음 날부터는 실제 상태.
  const onTheDay = make({ sourceDate: '2026-11-26', slopes: slopes('CLOSE') })
  expect(buildSlopeBoard(onTheDay, '2026-11-26', upcoming)?.groups[0].chips[0].status).toBe('upcoming')
  expect(formatUpcoming(upcoming, '2026-11-26')).toEqual([])
  const dayAfter = make({ sourceDate: '2026-11-27', slopes: slopes('CLOSE') })
  expect(buildSlopeBoard(dayAfter, '2026-11-27', upcoming)?.groups[0].chips[0].status).toBe('closed')
})

test('last-season data (pre-season) shows the official list all closed, ignoring old states and old hours', () => {
  const lastSeason = make({
    status: 'ok',
    sourceDate: '2026-03-01', // 지산: 지난 시즌 마지막 안내가 그대로 걸려 있음
    hours: [{ label: '운영시간', value: '09:00~17:00' }],
    slopes: [
      { name: '1', slot: '주간', state: 'OPEN' },
      { name: '1', slot: '야간', state: 'CLOSE' },
      { name: '2', slot: '주간', state: 'CLOSE' },
    ],
  })
  const board = buildSlopeBoard(lastSeason, TODAY)
  expect(board).toEqual({
    openCount: 0,
    total: 2,
    preseason: true,
    groups: [{ level: '', chips: [{ name: '1', status: 'closed', nightOnly: false }, { name: '2', status: 'closed', nightOnly: false }] }],
    hours: [],
  })
  expect(buildSlopeBoard(make({ status: 'stale', sourceDate: '2026-03-03', slopes: [{ name: 'a', day: 'OPEN' }] }), TODAY)?.openCount).toBe(0)
})

test('slope board is hidden when there is no official slope list or the fetch failed', () => {
  expect(buildSlopeBoard(undefined, TODAY)).toBeNull()
  expect(buildSlopeBoard(make({ status: 'partial', sourceDate: TODAY, slopes: [] }), TODAY)).toBeNull() // 강촌: 빈 응답
  expect(buildSlopeBoard(make({ status: 'error', slopes: [{ name: 'a', day: 'OPEN' }] }), TODAY)).toBeNull()
})

test('level colors follow the design guide and blend for in-between levels', () => {
  expect(levelColor('초급')).toBe('#399165')
  expect(levelColor('최상급')).toBe('#505160')
  expect(levelColor('초심')).toMatch(/^#[0-9A-F]{6}$/) // 비발디파크 공식 등급
  expect(levelColor('초심')).not.toBe(levelColor('초급'))
  expect(levelColor('초중급')).toMatch(/^#[0-9A-F]{6}$/)
  expect(levelColor('초중급')).not.toBe(levelColor('초급'))
  expect(levelColor('알 수 없는 등급')).toBe('#64748B')
})

test('levels are grouped once each in difficulty order even when the official table interleaves them (high1)', () => {
  const board = buildSlopeBoard(
    make({
      slopes: [
        { name: '제우스Ⅰ', level: '초급', day: 'OPEN' },
        { name: '빅토리아Ⅰ', level: '상급', day: 'CLOSE' },
        { name: '헤라Ⅰ', level: '중급', day: 'CLOSE' },
        { name: '아폴로Ⅵ', level: '상급', day: 'OPEN' },
        { name: '익스트림', level: '파크', day: 'CLOSE' },
        { name: '아테나Ⅲ', level: '초급', day: 'CLOSE' },
      ],
    }),
    TODAY,
  )
  expect(board?.groups.map((g) => [g.level, g.chips.map((c) => c.name)])).toEqual([
    ['초급', ['제우스Ⅰ', '아테나Ⅲ']],
    ['중급', ['헤라Ⅰ']],
    ['상급', ['빅토리아Ⅰ', '아폴로Ⅵ']],
    ['파크', ['익스트림']], // 모르는 등급은 정해진 등급 뒤에, 처음 나온 순서대로
  ])
})

test('resort with no collected entry shows the official course list as 0 / N all closed, like the other resorts', () => {
  const catalog = [
    { name: 'G', level: '중급' },
    { name: 'I', level: '초급' },
    { name: '블루스', level: '초심' },
  ]
  const board = buildSlopeBoard(undefined, TODAY, undefined, catalog)
  expect(board).toEqual({
    openCount: 0,
    total: 3,
    preseason: true,
    groups: [
      { level: '초심', chips: [{ name: '블루스', status: 'closed', nightOnly: false }] }, // 초심은 초급보다 앞
      { level: '초급', chips: [{ name: 'I', status: 'closed', nightOnly: false }] },
      { level: '중급', chips: [{ name: 'G', status: 'closed', nightOnly: false }] },
    ],
    hours: [],
  })
  // 수집값이라도 지난 시즌 값이면 '개방 전 → 전부 미개방'으로 본다(강촌 개장 전과 같은 표시).
  const emptyFeed = make({ status: 'partial', sourceDate: TODAY, slopes: [] })
  expect(buildSlopeBoard(emptyFeed, TODAY, undefined, catalog)?.preseason).toBe(true)
  expect(buildSlopeBoard(emptyFeed, TODAY, undefined, catalog)?.openCount).toBe(0)
})

test('slopes listed without any state value stay 정보 미확인, not 미개방 (missing keys / old file)', () => {
  const board = buildSlopeBoard(
    make({
      status: 'partial',
      slopes: [{ name: '블루스', level: '초심' }, { name: '발라드', level: '초급' }],
    }),
    TODAY,
  )
  expect(board?.preseason).toBe(false) // 개장한 곳이라 '올 시즌 오픈 전'이 아니다
  expect(board?.openCount).toBe(0)
  expect(board?.total).toBe(2)
  expect(board?.groups.flatMap((g) => g.chips).map((c) => c.status)).toEqual(['unknown', 'unknown'])
})

test('a failed fetch still shows the official course list all closed when there is one', () => {
  const catalog = [{ name: 'I', level: '초급' }]
  const failed = make({ status: 'error', slopes: [] })
  expect(buildSlopeBoard(failed, TODAY, undefined, catalog)?.groups[0].chips[0]).toEqual({ name: 'I', status: 'closed', nightOnly: false })
  expect(buildSlopeBoard(failed, TODAY)).toBeNull()
})

test('catalog levels fill live rows that have no level of their own (jisan)', () => {
  const catalog = [{ name: '2', level: '중급' }, { name: '7', level: '중상급' }]
  const board = buildSlopeBoard(
    make({ sourceDate: '2026-03-01', slopes: [{ name: '2', slot: '주간', state: 'OPEN' }, { name: '7', slot: '주간', state: 'OPEN' }] }),
    TODAY,
    undefined,
    catalog,
  )
  expect(board?.groups.map((g) => [g.level, g.chips.map((c) => c.name)])).toEqual([
    ['중급', ['2']],
    ['중상급', ['7']],
  ])
})

test('official slope catalog fills in when the live feed has no list yet (gangchon pre-season)', () => {
  const catalog = [
    { name: '래빗', level: '초급' },
    { name: '재규어', level: '최상급' },
  ]
  const empty = make({ status: 'partial', sourceDate: TODAY, slopes: [] })
  expect(buildSlopeBoard(empty, TODAY, undefined, catalog)).toEqual({
    openCount: 0,
    total: 2,
    preseason: true,
    groups: [
      { level: '초급', chips: [{ name: '래빗', status: 'closed', nightOnly: false }] },
      { level: '최상급', chips: [{ name: '재규어', status: 'closed', nightOnly: false }] },
    ],
    hours: [],
  })
  expect(buildSlopeBoard(undefined, TODAY, undefined, catalog)?.total).toBe(2) // 수집 안 하는 곳도 목록은 보인다
  // 실시간 목록이 들어오면 그걸 쓴다(카탈로그는 비어 있을 때만).
  const live = make({ sourceDate: TODAY, slopes: [{ name: '래빗', level: '초급', day: 'OPEN' }] })
  expect(buildSlopeBoard(live, TODAY, undefined, catalog)?.total).toBe(1)
})

test('yesterday data (before the morning collection) keeps the real state and shows its date, not "preseason"', () => {
  // 2026-11-27 새벽: 용평 값이 11-26 기준이라 "올 시즌 오픈 전 + 전부 미개방"으로 잘못 보였다.
  const yesterday = make({ sourceDate: '2026-11-24', slopes: [{ name: '핑크', day: 'OPEN' }, { name: '옐로우', day: 'CLOSE' }] })
  const board = buildSlopeBoard(yesterday, TODAY)
  expect(board?.preseason).toBe(false)
  expect(board?.openCount).toBe(1)
  expect(board?.asOf).toBe('2026-11-24')
  expect(buildSlopeBoard(make({ sourceDate: TODAY, slopes: [{ name: 'a', day: 'OPEN' }] }), TODAY)?.asOf).toBeUndefined()
})
