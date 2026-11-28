/// <reference types="node" />
import { existsSync } from 'node:fs'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { resorts } from './data/cams'
import { playingCamId } from './playingCam'

enableAutoUnmount(afterEach)
beforeEach(() => {
  playingCamId.value = null
})

const ORDER = [
  '모나용평',
  '지산리조트',
  '휘닉스 평창',
  '하이원리조트',
  '웰리힐리파크',
  '알펜시아',
  '엘리시안강촌',
  '비발디파크',
  '무주 덕유산',
  '오투',
  '곤지암',
  '오크밸리',
  '에덴밸리',
]

test('the main screen lists every resort as a symbol + name row, in the chosen order', () => {
  const app = mount(App)
  const rows = app.findAll('.resort-row')

  expect(rows).toHaveLength(resorts.length)
  expect(rows.map((r) => r.get('.resort-name').text())).toEqual(ORDER)
  expect(app.find('.resort-detail').exists()).toBe(false)
  expect(app.find('.cam-picks').exists()).toBe(false) // 목록에서는 CCTV를 깔지 않는다
})

test('every resort has an illustration, and a symbol file where one is registered', () => {
  const app = mount(App)

  resorts.forEach((resort) => {
    expect(existsSync(`public/illustrations/${resort.id}.jpg`), `illustration ${resort.id}`).toBe(true)
    if (resort.symbol) expect(existsSync(`public/${resort.symbol}`), `symbol ${resort.id}`).toBe(true)
  })
  // 스키장 순서는 데이터 순서 그대로다(sortResorts는 캠만 정렬).
  expect(app.findAll('.row-art img').map((img) => img.attributes('src'))).toEqual(
    resorts.map((resort) => `illustrations/${resort.id}.jpg`),
  )
})

test('clicking a resort opens only its detail: name, slope info, cams, and a back button', async () => {
  const app = mount(App)

  await app.findAll('.resort-row')[0].trigger('click') // 모나용평

  expect(app.find('.resort-list').exists()).toBe(false)
  const detail = app.get('.resort-detail')
  expect(detail.get('h2').text()).toBe('모나용평')
  expect(app.find('.topbar .topbar-back').exists()).toBe(true)
  expect(detail.find('.slope-info').exists()).toBe(true)
  const yongpyong = resorts.find((r) => r.id === 'yongpyong')!
  expect(detail.findAll('.pick')).toHaveLength(yongpyong.cams.length) // 카드 대신 이름 목록
})

test('yongpyong: tapping a cam name plays it in the hero (pinned under the header), closing brings the illustration back', async () => {
  const app = mount(App, { global: { stubs: { HlsPlayer: true } } })
  await app.findAll('.resort-row')[0].trigger('click') // 모나용평
  const hero = () => app.get('.detail-hero')
  expect(hero().classes()).not.toContain('playing') // 영상 전에는 그냥 일러스트(스크롤하면 같이 올라감)
  expect(app.find('.play').exists()).toBe(false) // 재생 버튼 없음
  expect(hero().find('.hero-player').exists()).toBe(false)

  await app.findAll('.pick')[1].trigger('click') // 핑크 슬로프
  expect(playingCamId.value).toBe('yongpyong-cam10')
  expect(hero().get('.now-name').text()).toBe('핑크 슬로프')
  expect(hero().classes()).toContain('playing') // 헤더 + 영상 둘 다 고정
  expect(app.findAll('.pick')[1].classes()).toContain('on')

  await app.findAll('.pick')[2].trigger('click') // 다른 이름을 누르면 바로 바뀐다
  expect(hero().get('.now-name').text()).toBe('옐로우 슬로프')

  await hero().get('.close').trigger('click')
  expect(playingCamId.value).toBeNull()
  expect(hero().find('.hero-player').exists()).toBe(false)
  expect(hero().find('.hero-art').exists()).toBe(true)
  expect(hero().classes()).not.toContain('playing')
})

test('yongpyong: the hero plays continuously (live) and stops when the screen is hidden', async () => {
  const app = mount(App, { global: { stubs: { HlsPlayer: true } } }) // jsdom엔 HLS 재생이 없어 진짜 플레이어는 바로 오류를 낸다
  await app.findAll('.resort-row')[0].trigger('click')
  await app.findAll('.pick')[0].trigger('click')

  expect(app.getComponent({ name: 'HlsPlayer' }).props('continuous')).toBe(true)

  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
  document.dispatchEvent(new Event('visibilitychange'))
  await app.vm.$nextTick()
  expect(playingCamId.value).toBeNull()
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
})

test('high1: the hero stops after the 30s preview instead of looping (relay traffic)', async () => {
  const app = mount(App, { global: { stubs: { HlsPlayer: true } } })
  await app.findAll('.resort-row').find((r) => r.text().includes('하이원'))!.trigger('click')
  await app.findAll('.pick')[0].trigger('click')

  const player = app.getComponent({ name: 'HlsPlayer' })
  expect(player.props('continuous')).toBe(false)
  expect(player.props('playLimitSec')).toBe(30)
  expect(player.props('url')).toMatch(/^https:\/\/.*\/api\/high1\?ch=1&f=playlist\.m3u8$/)

  player.vm.$emit('end')
  await app.vm.$nextTick()
  expect(playingCamId.value).toBeNull()
  expect(app.find('.hero-notice').text()).toContain('미리보기가 끝났어요')
})

test('yongpyong: a stream error shows a notice until the next tap', async () => {
  const app = mount(App, { global: { stubs: { HlsPlayer: true } } })
  await app.findAll('.resort-row')[0].trigger('click')
  await app.findAll('.pick')[0].trigger('click')

  app.getComponent({ name: 'HlsPlayer' }).vm.$emit('error')
  await app.vm.$nextTick()

  expect(playingCamId.value).toBeNull()
  expect(app.get('.hero-notice').text()).toContain('볼 수 없어요')
  await app.findAll('.pick')[0].trigger('click')
  expect(app.find('.hero-notice').exists()).toBe(false)
})

test('every resort with cams uses the same name list + top player as 용평', async () => {
  const app = mount(App)

  for (const [index, resort] of resorts.entries()) {
    if (!resort.cams.length) continue
    await app.findAll('.resort-row')[index].trigger('click')
    expect(app.findAll('.pick'), resort.id).toHaveLength(resort.cams.length)
    expect(app.find('.card').exists(), resort.id).toBe(false) // 예전 카드(▶재생 버튼)는 없다
    await app.get('.topbar-back').trigger('click')
  }
})

test('a cam that cannot play here links out instead of playing (하이원 popup or official page)', async () => {
  const app = mount(App)
  const index = resorts.findIndex((r) => r.cams.some((c) => c.status === 'active' && c.type === 'link'))
  if (index < 0) return // 지금 데이터에 링크 전용 캠이 없으면 건너뜀
  await app.findAll('.resort-row')[index].trigger('click')

  const link = app.findAll('a.pick')[0]
  expect(link.attributes('target')).toBe('_blank')
  expect(link.attributes('rel')).toContain('noopener')
})

test('the detail symbol links to the official page in a new tab', async () => {
  const app = mount(App)

  await app.findAll('.resort-row')[0].trigger('click')

  const link = app.get('.topbar a.bar-symbol') // 상세 헤더: ← · 이름 · 로고
  expect(link.attributes('href')).toBe(resorts.find((r) => r.id === 'yongpyong')!.officialPage)
  expect(link.attributes('target')).toBe('_blank')
  expect(link.attributes('rel')).toContain('noopener')
  expect(link.find('img.symbol').exists()).toBe(true)
})

test('a resort without a symbol shows no symbol link', async () => {
  const app = mount(App)

  const index = resorts.findIndex((r) => r.id === 'konjiam')
  await app.findAll('.resort-row')[index].trigger('click')

  expect(app.find('.topbar a.bar-symbol').exists()).toBe(false)
  expect(app.find('.resort-detail a.symbol-link').exists()).toBe(false)
})

test('a resort with no cam yet shows the 준비 중 notice instead of an empty cam list', async () => {
  const app = mount(App)

  const index = resorts.findIndex((r) => r.id === 'muju')
  await app.findAll('.resort-row')[index].trigger('click')

  expect(app.find('.cam-picks').exists()).toBe(false)
  const notice = app.get('.cams-soon')
  expect(notice.text()).toContain('최대한 빨리 작업중입니다!!')
  expect(notice.get('a').attributes('href')).toBe(resorts.find((r) => r.id === 'muju')!.officialPage)
})

test('a resort without cam points out on the list card that its cam is coming', () => {
  const app = mount(App)

  const rows = app.findAll('.resort-row')
  const index = resorts.findIndex((r) => r.id === 'edenvalley')
  expect(rows[index].get('.row-sub').text()).toContain('캠 준비 중')
  expect(rows[0].get('.row-sub').text()).not.toContain('캠 준비 중')
})

test('the back button returns to the list', async () => {
  const app = mount(App)
  await app.findAll('.resort-row')[1].trigger('click')

  await app.get('.topbar-back').trigger('click')

  expect(app.find('.resort-detail').exists()).toBe(false)
  expect(app.findAll('.resort-row')).toHaveLength(resorts.length)
})

test('navigating stops any cam that was playing', async () => {
  const app = mount(App, { global: { stubs: { HeroPlayer: true } } })

  playingCamId.value = 'yongpyong-cam08'
  await app.findAll('.resort-row')[3].trigger('click') // 다른 스키장으로 이동
  expect(playingCamId.value).toBeNull()

  playingCamId.value = 'anything'
  await app.get('.topbar-back').trigger('click')
  expect(playingCamId.value).toBeNull()
})

test('detail shows a placeholder when slope data is unavailable', async () => {
  const app = mount(App, { global: { stubs: { HeroPlayer: true } } }) // jsdom엔 fetch가 없어 슬로프 데이터가 비어 있다

  await app.findAll('.resort-row')[0].trigger('click')

  const info = app.get('.slope-info')
  expect(info.classes()).toContain('empty')
  expect(info.text()).toContain('정보가 없어요')
})

test('a resort without collected slope data still shows its official hours and season note', async () => {
  const app = mount(App, { global: { stubs: { HeroPlayer: true } } })

  const index = resorts.findIndex((r) => r.id === 'vivaldi')
  await app.findAll('.resort-row')[index].trigger('click')

  const info = app.get('.slope-info')
  expect(info.get('.season-note').text()).toContain('11월 27일')
  const hours = info.findAll('.hours > div').map((row) => row.text())
  expect(hours).toContain('주간09:00~17:30')
})

test('detail shows the resort emergency contact as a tap-to-call link', async () => {
  const app = mount(App, { global: { stubs: { HeroPlayer: true } } })

  await app.findAll('.resort-row')[0].trigger('click') // 모나용평

  const emergency = app.get('.emergency')
  expect(emergency.text()).toContain('사고 시 연락처')
  const yongpyong = resorts.find((r) => r.id === 'yongpyong')!
  const rows = emergency.findAll('.emergency-row')
  expect(rows).toHaveLength(yongpyong.emergency!.length)
  const firstTel = yongpyong.emergency![0].tels[0]
  expect(rows[0].text()).toContain(firstTel)
  expect(rows[0].get('.e-tel').attributes('href')).toBe(`tel:${firstTel}`)
})

test('the detail header matches the folded bar: back, resort name, logo; main header keeps the brand', async () => {
  const app = mount(App)
  expect(app.get('.topbar').text()).toContain('스키장 CCTV')

  await app.findAll('.resort-row')[1].trigger('click') // 지산
  const bar = app.get('.topbar')
  expect(bar.find('.topbar-back').exists()).toBe(true)
  expect(bar.get('.topbar-name').text()).toBe('지산리조트')
  expect(bar.text()).not.toContain('스키장 CCTV')
})

test('footer notes this is an unaffiliated personal page', () => {
  const credit = mount(App).get('.credit')

  expect(credit.text()).toContain('개인 페이지')
})
