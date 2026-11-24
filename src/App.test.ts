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

test('summary tells how many cams can be played', () => {
  const summaries = mount(App).findAll('summary').map((s) => s.text())

  expect(summaries.find((s) => s.includes('모나용평'))).toContain('영상 7개')
  expect(summaries.find((s) => s.includes('지산리조트'))).toContain('오픈 준비 중')
  expect(summaries.find((s) => s.includes('엘리시안강촌'))).toContain('새 창으로 보기')
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
