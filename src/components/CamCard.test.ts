import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { resorts, type Cam, type Resort } from '../data/cams'
import { playingCamId } from '../playingCam'
import CamCard from './CamCard.vue'

const hls = vi.hoisted(() => ({
  isSupported: vi.fn(() => true),
  loadSource: vi.fn(),
  destroy: vi.fn(),
  onError: undefined as undefined | ((event: string, data: { fatal: boolean }) => void),
}))

vi.mock('hls.js', () => ({
  default: class {
    static isSupported = hls.isSupported
    static Events = { ERROR: 'hlsError' }
    loadSource = hls.loadSource
    destroy = hls.destroy
    attachMedia() {}
    on(_event: string, handler: typeof hls.onError) {
      hls.onError = handler
    }
  },
}))

const resort: Resort = { id: 'r', name: '리조트', region: '강원', officialPage: 'https://example.com/cam', cams: [] }
const base = { id: 'r-base', name: '베이스', status: 'active' } as const
const hlsCam: Cam = { ...base, type: 'hls', url: 'https://example.com/a.m3u8', playLimitSec: 15 }

// jsdom에는 Popover API가 없다.
const toggleTo = (newState: string) =>
  function (this: HTMLElement) {
    this.dispatchEvent(Object.assign(new Event('toggle'), { newState }))
  }
const showPopover = vi.fn(toggleTo('open'))
const hidePopover = vi.fn(toggleTo('closed'))
Object.assign(HTMLElement.prototype, { showPopover, hidePopover })

enableAutoUnmount(afterEach)

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  playingCamId.value = null
  showPopover.mockImplementation(toggleTo('open'))
  hidePopover.mockImplementation(toggleTo('closed'))
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('CamCard', () => {
  test('link cam shows only the official page link', () => {
    const card = mount(CamCard, { props: { resort, cam: { ...base, type: 'link', url: null } } })

    expect(card.find('button').exists()).toBe(false)
    expect(card.get('a').attributes('href')).toBe('https://example.com/cam')
    expect(card.get('a').attributes('rel')).toContain('noopener')
  })

  test('youtube cam embeds the video only after click', async () => {
    const card = mount(CamCard, { props: { resort, cam: { ...base, type: 'youtube', videoId: 'abc' } } })
    expect(card.find('iframe').exists()).toBe(false)

    await card.get('button').trigger('click')

    expect(card.get('iframe').attributes('src')).toContain('/embed/abc')
  })

  test('hls cam loads on click and stops after the play limit', async () => {
    const card = mount(CamCard, { props: { resort, cam: hlsCam } })
    expect(hls.loadSource).not.toHaveBeenCalled()

    await card.get('button').trigger('click')
    expect(hls.loadSource).toHaveBeenCalledWith('https://example.com/a.m3u8')
    await card.get('video').trigger('loadedmetadata')
    await vi.advanceTimersByTimeAsync(15_000)

    expect(hls.destroy).toHaveBeenCalledOnce()
    expect(card.find('video').exists()).toBe(false)
    expect(card.find('button').exists()).toBe(true)
  })

  test('unmounting a playing hls cam releases the stream', async () => {
    const card = mount(CamCard, { props: { resort, cam: hlsCam } })
    await card.get('button').trigger('click')

    card.unmount()

    expect(hls.destroy).toHaveBeenCalledOnce()
  })

  test('fatal hls error shows a message and allows retry', async () => {
    const card = mount(CamCard, { props: { resort, cam: hlsCam } })
    await card.get('button').trigger('click')

    hls.onError?.('hlsError', { fatal: true })
    await flushPromises()

    expect(card.get('[role="alert"]').text()).toContain('지금은 영상을 볼 수 없어요')
    expect(card.find('button').exists()).toBe(true)
  })

  test('falls back to native playback when hls.js is unsupported', async () => {
    hls.isSupported.mockReturnValueOnce(false)
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('maybe')
    const card = mount(CamCard, { props: { resort, cam: hlsCam } })

    await card.get('button').trigger('click')

    expect(card.get('video').attributes('src')).toBe('https://example.com/a.m3u8')
  })

  test('stalled stream errors out when metadata never arrives', async () => {
    const card = mount(CamCard, { props: { resort, cam: hlsCam } })
    await card.get('button').trigger('click')

    await vi.advanceTimersByTimeAsync(15_000)

    expect(card.find('[role="alert"]').exists()).toBe(true)
    expect(hls.destroy).toHaveBeenCalledOnce()
  })

  test('keyboard focus follows the player and returns to the play button', async () => {
    const card = mount(CamCard, { props: { resort, cam: hlsCam }, attachTo: document.body })
    await card.get('button').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(card.get('video').element)

    await card.get('video').trigger('loadedmetadata')
    await vi.advanceTimersByTimeAsync(15_000)

    expect(document.activeElement).toBe(card.get('button').element)
    card.unmount()
  })

  test('ending playback does not steal focus from elsewhere', async () => {
    const card = mount(CamCard, { props: { resort, cam: hlsCam }, attachTo: document.body })
    await card.get('button').trigger('click')
    await flushPromises()
    card.get('a').element.focus()

    await vi.advanceTimersByTimeAsync(15_000)

    expect(document.activeElement).toBe(card.get('a').element)
    card.unmount()
  })

  test('link cam with its own url opens that url', () => {
    const card = mount(CamCard, { props: { resort, cam: { ...base, type: 'link', url: 'http://example.com/ch1' } } })

    expect(card.get('a').attributes('href')).toBe('http://example.com/ch1')
  })

  test('pending cam shows the preparing message without a player', () => {
    const card = mount(CamCard, { props: { resort, cam: { ...hlsCam, status: 'pending' } } })

    expect(card.text()).toContain('오픈 준비 중')
    expect(card.find('button').exists()).toBe(false)
  })

  test('investigate cam falls back to the official page link', () => {
    const card = mount(CamCard, { props: { resort, cam: { ...hlsCam, status: 'investigate' } } })
    expect(card.text()).toContain('지금은 영상이 나오지 않아요')

    expect(card.find('button').exists()).toBe(false)
    expect(card.get('a').attributes('href')).toBe('https://example.com/cam')
  })

  test('playing another cam stops the previous one', async () => {
    const first = mount(CamCard, { props: { resort, cam: hlsCam }, attachTo: document.body })
    const second = mount(CamCard, {
      props: { resort, cam: { ...base, id: 'r-yt', type: 'youtube', videoId: 'abc' } },
      attachTo: document.body,
    })
    await first.get('button').trigger('click')

    await second.get('button').trigger('click')
    await flushPromises()

    expect(hls.destroy).toHaveBeenCalledOnce()
    expect(first.find('video').exists()).toBe(false)
    expect(first.find('[role="alert"]').exists()).toBe(false)
    expect(second.find('iframe').exists()).toBe(true)
    expect(document.activeElement).toBe(second.get('iframe').element)
  })

  test('a late error from a stopped cam does not stop the current one', async () => {
    const first = mount(CamCard, { props: { resort, cam: hlsCam } })
    const second = mount(CamCard, { props: { resort, cam: { ...hlsCam, id: 'r-second' } } })
    await first.get('button').trigger('click')
    const lateError = hls.onError
    await second.get('button').trigger('click')

    lateError?.('hlsError', { fatal: true })
    await flushPromises()

    expect(second.find('video').exists()).toBe(true)
    expect(first.find('[role="alert"]').exists()).toBe(false)
  })

  test('enlarge opens the popover and starts playing', async () => {
    const card = mount(CamCard, { props: { resort, cam: hlsCam } })

    await card.get('.enlarge').trigger('click')

    expect(showPopover).toHaveBeenCalledOnce()
    expect(card.find('video').exists()).toBe(true)
  })

  test('enlarging a playing cam does not restart the stream', async () => {
    const card = mount(CamCard, { props: { resort, cam: hlsCam } })
    await card.get('.play').trigger('click')

    await card.get('.enlarge').trigger('click')

    expect(hls.loadSource).toHaveBeenCalledOnce()
  })

  test('popover stays open with a replay button after the limit', async () => {
    const card = mount(CamCard, { props: { resort, cam: hlsCam } })
    await card.get('.enlarge').trigger('click')
    await card.get('video').trigger('loadedmetadata')

    await vi.advanceTimersByTimeAsync(15_000)

    expect(hidePopover).not.toHaveBeenCalled()
    expect(card.get('.screen').find('.play').exists()).toBe(true)
  })

  test('close button hides the popover', async () => {
    const card = mount(CamCard, { props: { resort, cam: hlsCam } })
    await card.get('.enlarge').trigger('click')

    await card.get('.close').trigger('click')

    expect(hidePopover).toHaveBeenCalledOnce()
  })

  test('cams that cannot play have no enlarge button', () => {
    const card = mount(CamCard, { props: { resort, cam: { ...base, type: 'link', url: null } } })

    expect(card.find('.enlarge').exists()).toBe(false)
  })
})

test('cam ids are unique', () => {
  const ids = resorts.flatMap((r) => r.cams.map((c) => c.id))

  expect(new Set(ids).size).toBe(ids.length)
})
