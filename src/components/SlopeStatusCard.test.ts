import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import type { SlopeBoard } from '../data/slopeStatus'
import SlopeStatusCard from './SlopeStatusCard.vue'

const board: SlopeBoard = {
  openCount: 1,
  total: 3,
  groups: [
    { level: '초급', chips: [{ name: '옐로우', status: 'upcoming', nightOnly: false }] },
    {
      level: '상급',
      chips: [
        { name: '뉴레드', status: 'open', nightOnly: true },
        { name: '레드', status: 'closed', nightOnly: false },
      ],
    },
  ],
  hours: [
    { label: '주간', value: '08:30~16:30', off: false },
    { label: '야간', value: '19:00~23:00', off: true },
  ],
  preseason: false,
}

test('shows open/total count, level labels, status chips with text labels, legend and hours', () => {
  const card = mount(SlopeStatusCard, { props: { board, upcomingLines: [] } })

  expect(card.get('.slope-count').text()).toBe('1 / 3개 개방')
  expect(card.findAll('.level').map((l) => l.text())).toEqual(['초급', '상급'])
  expect(card.findAll('.chips .chip').map((c) => c.classes()[1])).toEqual(['upcoming', 'open', 'closed'])
  expect(card.get('.chip.open').text()).toContain('개방') // 색 말고 글자로도 상태를 알 수 있다
  expect(card.get('.chip.open').text()).toContain('🌙')
  expect(card.findAll('.legend li')).toHaveLength(4)
  expect(card.findAll('.hours > div').map((h) => h.text())).toEqual(['주간08:30~16:30', '야간19:00~23:00미운영'])
})

test('all slopes open says so instead of a fraction', () => {
  const card = mount(SlopeStatusCard, { props: { board: { ...board, openCount: 3 }, upcomingLines: [] } })
  expect(card.get('.slope-count').text()).toBe('전 슬로프 개방')
})

test('starts collapsed (count, bar and hours only); one toggle shows chips and legend; re-entering starts collapsed again', async () => {
  const card = mount(SlopeStatusCard, { props: { board, upcomingLines: [] }, attachTo: document.body }) // isVisible은 문서에 붙어야 판정된다
  const head = card.get('button.slope-head')
  expect(head.attributes('aria-expanded')).toBe('false') // 들어올 때마다 접힌 상태
  expect(card.get('.slope-list').isVisible()).toBe(false)
  expect(card.get('.slope-count').isVisible()).toBe(true)
  expect(card.get('.progress').isVisible()).toBe(true)
  expect(card.get('.hours').isVisible()).toBe(true)

  await head.trigger('click')

  expect(head.attributes('aria-expanded')).toBe('true')
  expect(card.get('.slope-list').isVisible()).toBe(true)
  card.unmount() // 뒤로 가기

  const again = mount(SlopeStatusCard, { props: { board, upcomingLines: [] } }) // 다시 들어오기
  expect(again.get('button.slope-head').attributes('aria-expanded')).toBe('false')
})

test('without board data shows the placeholder and still shows upcoming lines', () => {
  const card = mount(SlopeStatusCard, { props: { board: null, upcomingLines: ['옐로우 11월 27일 08:30 오픈 예정'] } })
  expect(card.classes()).toContain('empty')
  expect(card.text()).toContain('정보가 없어요')
  expect(card.get('.slope-upcoming').text()).toContain('11월 27일')
})

test('pre-season board says the season has not opened and has no hours', () => {
  const card = mount(SlopeStatusCard, { props: { board: { ...board, openCount: 0, hours: [], preseason: true }, upcomingLines: [] } })
  expect(card.get('.slope-count').text()).toBe('0 / 3개 개방')
  expect(card.get('.preseason').text()).toContain('시즌 오픈 전')
  expect(card.find('.hours').exists()).toBe(false)
})
