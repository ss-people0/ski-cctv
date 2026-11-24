import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Cam, Resort } from './cams'
import { isPlayable, sortResorts } from './sortResorts'

const cam = (id: string, status: Cam['status'], type: 'hls' | 'link' = 'hls'): Cam =>
  type === 'hls'
    ? { id, name: id, status, type, url: 'https://example.com/a.m3u8', playLimitSec: 15 }
    : { id, name: id, status, type, url: null }
const resort = (id: string, cams: Cam[]): Resort => ({ id, name: id, region: '', officialPage: '', cams })

test('keeps the resort order and puts playable cams first', () => {
  const input = [
    resort('pending', [cam('p', 'pending', 'link')]),
    resort('link', [cam('l', 'active', 'link')]),
    resort('mixed', [cam('broken', 'investigate'), cam('live', 'active')]),
    resort('playable', [cam('live2', 'active')]),
  ]

  const sorted = sortResorts(input)

  expect(sorted.map((r) => r.id)).toEqual(['pending', 'link', 'mixed', 'playable'])
  expect(sorted[2].cams.map((c) => c.id)).toEqual(['live', 'broken'])
  expect(input[2].cams[0].id).toBe('broken')
})

describe('isPlayable on an https page', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('blocks http streams but keeps https streams', () => {
    const httpCam: Cam = { id: 'h', name: 'h', status: 'active', type: 'hls', url: 'http://example.com/a.m3u8', playLimitSec: 15 }
    expect(isPlayable(httpCam)).toBe(true)

    vi.stubGlobal('location', { protocol: 'https:' })

    expect(isPlayable(httpCam)).toBe(false)
    expect(isPlayable(cam('s', 'active'))).toBe(true)
  })
})
