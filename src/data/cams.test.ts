import { expect, test } from 'vitest'
import { resorts } from './cams'
import { formatUpcoming } from './slopeStatus'

// 손으로 넣는 오픈 예정 데이터가 화면 문구까지 제대로 이어지는지 확인한다.
test('용평 레드 12월 2일 오픈 예정은 08:30 시각까지 함께 보여준다', () => {
  const yongpyong = resorts.find((r) => r.id === 'yongpyong')
  expect(formatUpcoming(yongpyong?.upcoming, '2026-11-28')).toContain('레드 12월 2일 08:30 오픈 예정')
})

test('오픈 예정 시각은 HH:MM 형식으로만 적는다', () => {
  const times = resorts.flatMap((r) => (r.upcoming ?? []).map((u) => u.time).filter((t): t is string => t != null))
  expect(times.length).toBeGreaterThan(0)
  for (const time of times) expect(time).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
})

test('오픈 예정 날짜는 YYYY-MM-DD 형식으로만 적는다', () => {
  const dates = resorts.flatMap((r) => (r.upcoming ?? []).map((u) => u.date))
  expect(dates.length).toBeGreaterThan(0)
  for (const date of dates) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('알펜시아 11월 28일 개장은 시각 없이 날짜만 보여준다', () => {
  const alpensia = resorts.find((r) => r.id === 'alpensia')
  expect(formatUpcoming(alpensia?.upcoming, '2026-11-27')).toContain('스키장 11월 28일 오픈 예정')
})
