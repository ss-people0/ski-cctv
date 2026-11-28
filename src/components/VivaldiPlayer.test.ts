import { mount } from '@vue/test-utils'
import { afterEach, expect, test, vi } from 'vitest'
import VivaldiPlayer from './VivaldiPlayer.vue'

// 비발디파크는 hls가 아니라 소노 WESP SDK로 재생한다. 실제 SDK는 800KB 스크립트라
// 테스트에서는 같은 모양의 가짜 컨트롤러를 window에 꽂아 두고 확인한다.
class FakeController {
  disposed = false
  layouts: [number, number][] = []
  private onReady?: () => void
  constructor() {
    sdk.controllers.push(this)
  }
  init(onReady: () => void) {
    this.onReady = onReady
  }
  ready() {
    this.onReady?.()
  }
  changeLayout(count: number, first: number) {
    this.layouts.push([count, first])
  }
  dispose() {
    this.disposed = true
  }
}

const sdk = {
  controllers: [] as FakeController[],
  install() {
    this.controllers = []
    ;(window as unknown as { WespJSSDK?: unknown }).WespJSSDK = { MonitorUIController: FakeController }
  },
}

const PROPS = { channel: 8, serial: 'TW0014A15451', token: ';test', label: '비발디파크 블루스', playLimitSec: 30, fallbackUrl: 'https://example.test/cam' }

afterEach(() => {
  delete (window as unknown as { WespJSSDK?: unknown }).WespJSSDK
  vi.useRealTimers()
})

test('플레이어가 준비되면 한 채널만 보여 주고 미리보기 시간을 센다', async () => {
  vi.useFakeTimers()
  sdk.install()
  const player = mount(VivaldiPlayer, { props: PROPS })
  await vi.waitFor(() => expect(sdk.controllers).toHaveLength(1))

  sdk.controllers[0].ready()
  await player.vm.$nextTick()
  expect(sdk.controllers[0].layouts).toEqual([[1, 7]]) // 채널 8 → SDK 인덱스 7
  expect(player.get('.countdown').text()).toContain('미리보기 30초')

  vi.advanceTimersByTime(30_000)
  await player.vm.$nextTick()
  expect(player.emitted('end')).toHaveLength(1)
  player.unmount()
})

test('화면에서 사라지면 SDK 플레이어를 정리한다(dispose)', async () => {
  sdk.install()
  const player = mount(VivaldiPlayer, { props: PROPS })
  await vi.waitFor(() => expect(sdk.controllers).toHaveLength(1))

  player.unmount()
  expect(sdk.controllers[0].disposed).toBe(true)
})

test('SDK가 플레이어를 만들지 못하면 안내와 다시 시도·공식 페이지 링크를 보여 준다', async () => {
  ;(window as unknown as { WespJSSDK?: unknown }).WespJSSDK = {
    MonitorUIController: class {
      constructor() {
        throw new Error('no player')
      }
    },
  }
  const player = mount(VivaldiPlayer, { props: PROPS })
  await vi.waitFor(() => expect(player.find('.note.error').exists()).toBe(true))

  expect(player.get('.note.error').text()).toContain('지금은 영상을 볼 수 없어요')
  expect(player.get('.fallback button').text()).toContain('다시 시도')
  expect(player.get('.fallback a').attributes('href')).toBe(PROPS.fallbackUrl)
  player.unmount()
})
