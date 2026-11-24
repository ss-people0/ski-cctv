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

test('shows every resort collapsed in one exclusive group', () => {
  const panels = mount(App).findAll('details')

  expect(panels).toHaveLength(resorts.length)
  expect(panels.every((p) => !p.element.open)).toBe(true)
  expect(new Set(panels.map((p) => p.attributes('name'))).size).toBe(1)
})

test('each resort symbol links to its official webcam page in a new tab', () => {
  const links = mount(App).findAll('summary a.symbol-link')

  expect(links).toHaveLength(resorts.length)
  const yongpyong = links.find((a) => a.attributes('aria-label')?.includes('모나용평'))!
  expect(yongpyong.find('img.symbol').exists()).toBe(true)
  expect(yongpyong.attributes('href')).toBe(
    resorts.find((r) => r.id === 'yongpyong')!.officialPage,
  )
  expect(yongpyong.attributes('target')).toBe('_blank')
  expect(yongpyong.attributes('rel')).toContain('noopener')
})

test('collapsing a resort stops only its own video', async () => {
  const panels = mount(App).findAll('details')
  const yongpyong = panels.find((p) => p.text().includes('모나용평'))!
  const other = panels.find((p) => p.text().includes('지산리조트'))!
  playingCamId.value = 'yongpyong-cam08-test'
  await other.trigger('toggle')
  expect(playingCamId.value).toBe('yongpyong-cam08-test')

  playingCamId.value = resorts.find((r) => r.id === 'yongpyong')!.cams[0].id
  await yongpyong.trigger('toggle')

  expect(playingCamId.value).toBeNull()
})

test('choosing a resort in the dropdown shows only that resort, expanded', async () => {
  const app = mount(App)

  await app.get('select').setValue('yongpyong')

  const panels = app.findAll('details')
  expect(panels).toHaveLength(1)
  expect(panels[0].text()).toContain('모나용평')
  expect(panels[0].element.open).toBe(true)

  await app.get('select').setValue('all')
  expect(app.findAll('details')).toHaveLength(resorts.length)
  expect(app.findAll('details').every((p) => !p.element.open)).toBe(true)
})

test('choosing a resort stops a video playing in another resort only', async () => {
  const app = mount(App, { global: { stubs: { CamCard: true } } }) // jsdom에서는 재생기가 오류로 스스로 꺼진다.
  const yongpyongCam = resorts.find((r) => r.id === 'yongpyong')!.cams[0].id
  playingCamId.value = yongpyongCam

  await app.get('select').setValue('yongpyong')
  expect(playingCamId.value).toBe(yongpyongCam)

  await app.get('select').setValue('high1')
  expect(playingCamId.value).toBeNull()
})

test('dropdown has a label and lists every resort', () => {
  const select = mount(App).get('select')

  expect(select.attributes('aria-label')).toBe('스키장 선택')
  expect(select.findAll('option')).toHaveLength(resorts.length + 1)
})

test('resorts appear in the order the user chose', () => {
  const names = mount(App).findAll('summary h3').map((h) => h.text())

  expect(names).toEqual(['모나용평', '지산리조트', '웰리힐리파크', '하이원리조트', '알펜시아', '엘리시안강촌'])
})

test('every resort has a symbol file', () => {
  const sources = mount(App).findAll('summary img').map((img) => img.attributes('src')!)

  expect(sources).toHaveLength(resorts.length)
  sources.forEach((src) => expect(existsSync(`public/${src}`), src).toBe(true))
})

test('hero photo credits its author and license', () => {
  const credit = mount(App).get('.credit')

  expect(credit.text()).toContain('Christian Jansky')
  expect(credit.text()).toContain('CC BY-SA 3.0')
})
