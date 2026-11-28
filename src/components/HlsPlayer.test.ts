import { mount } from '@vue/test-utils'
import { afterEach, expect, test, vi } from 'vitest'
import HlsPlayer from './HlsPlayer.vue'

afterEach(() => vi.useRealTimers())

const PROPS = { url: 'https://example.test/live.m3u8', playLimitSec: 15, label: '테스트 캠' }

async function playFor(continuous: boolean, seconds: number) {
  vi.useFakeTimers()
  const player = mount(HlsPlayer, { props: { ...PROPS, continuous } })
  await player.get('video').trigger('loadedmetadata') // 영상이 들어온 순간부터 시간을 잰다
  vi.advanceTimersByTime(seconds * 1000)
  await player.vm.$nextTick()
  return player
}

test('without continuous the preview ends after playLimitSec', async () => {
  const player = await playFor(false, 15)

  expect(player.emitted('end')).toHaveLength(1)
})

test('continuous keeps chaining 15-second segments and shows LIVE instead of a countdown', async () => {
  const player = await playFor(true, 60)

  expect(player.emitted('end')).toBeUndefined()
  expect(player.get('.countdown').text()).toContain('LIVE')
})
