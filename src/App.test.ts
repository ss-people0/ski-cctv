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

const ORDER = ['모나용평', '지산리조트', '웰리힐리파크', '하이원리조트', '휘닉스 평창', '알펜시아', '엘리시안강촌']

test('the main screen lists every resort as a symbol + name row, in the chosen order', () => {
  const app = mount(App)
  const rows = app.findAll('.resort-row')

  expect(rows).toHaveLength(resorts.length)
  expect(rows.map((r) => r.get('.resort-name').text())).toEqual(ORDER)
  expect(app.find('.resort-detail').exists()).toBe(false)
  expect(app.find('.cams').exists()).toBe(false) // 목록에서는 CCTV를 깔지 않는다
})

test('every resort has a symbol file and renders a mountain illustration', () => {
  const app = mount(App)

  resorts.forEach((resort) => {
    expect(existsSync(`public/symbols/${resort.id}.png`), `symbol ${resort.id}`).toBe(true)
  })
  expect(app.findAll('.row-art svg')).toHaveLength(resorts.length)
})

test('clicking a resort opens only its detail: name, slope info, cams, and a back button', async () => {
  const app = mount(App)

  await app.findAll('.resort-row')[0].trigger('click') // 모나용평

  expect(app.find('.resort-list').exists()).toBe(false)
  const detail = app.get('.resort-detail')
  expect(detail.get('h2').text()).toBe('모나용평')
  expect(detail.find('.back').exists()).toBe(true)
  expect(detail.find('.slope-info').exists()).toBe(true)
  const yongpyong = resorts.find((r) => r.id === 'yongpyong')!
  expect(detail.findAll('.card')).toHaveLength(yongpyong.cams.length)
})

test('the detail symbol links to the official page in a new tab', async () => {
  const app = mount(App)

  await app.findAll('.resort-row')[0].trigger('click')

  const link = app.get('.resort-detail a.symbol-link')
  expect(link.attributes('href')).toBe(resorts.find((r) => r.id === 'yongpyong')!.officialPage)
  expect(link.attributes('target')).toBe('_blank')
  expect(link.attributes('rel')).toContain('noopener')
  expect(link.find('img.symbol').exists()).toBe(true)
})

test('the back button returns to the list', async () => {
  const app = mount(App)
  await app.findAll('.resort-row')[1].trigger('click')

  await app.get('.back').trigger('click')

  expect(app.find('.resort-detail').exists()).toBe(false)
  expect(app.findAll('.resort-row')).toHaveLength(resorts.length)
})

test('navigating stops any cam that was playing', async () => {
  const app = mount(App, { global: { stubs: { CamCard: true } } })

  playingCamId.value = 'yongpyong-cam08'
  await app.findAll('.resort-row')[3].trigger('click') // 다른 스키장으로 이동
  expect(playingCamId.value).toBeNull()

  playingCamId.value = 'anything'
  await app.get('.back').trigger('click')
  expect(playingCamId.value).toBeNull()
})

test('detail shows a placeholder when slope data is unavailable', async () => {
  const app = mount(App, { global: { stubs: { CamCard: true } } }) // jsdom엔 fetch가 없어 슬로프 데이터가 비어 있다

  await app.findAll('.resort-row')[0].trigger('click')

  const info = app.get('.slope-info')
  expect(info.classes()).toContain('empty')
  expect(info.text()).toContain('정보가 없어요')
})

test('detail shows the resort emergency contact as a tap-to-call link', async () => {
  const app = mount(App, { global: { stubs: { CamCard: true } } })

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

test('footer notes this is an unaffiliated personal page', () => {
  const credit = mount(App).get('.credit')

  expect(credit.text()).toContain('개인 페이지')
})
