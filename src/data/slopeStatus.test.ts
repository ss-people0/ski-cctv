import { expect, test } from 'vitest'
import { formatSlopeBadge, type ResortSlopeStatus } from './slopeStatus'

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
