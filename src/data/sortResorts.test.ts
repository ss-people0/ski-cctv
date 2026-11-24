import { expect, test } from 'vitest'
import type { Cam, Resort } from './cams'
import { sortResorts } from './sortResorts'

const cam = (id: string, status: Cam['status'], type: 'hls' | 'link' = 'hls'): Cam =>
  type === 'hls'
    ? { id, name: id, status, type, url: 'https://example.com/a.m3u8', playLimitSec: 15 }
    : { id, name: id, status, type, url: null }
const resort = (id: string, cams: Cam[]): Resort => ({ id, name: id, region: '', officialPage: '', cams })

test('orders resorts and cams as playable, link, investigate, pending', () => {
  const input = [
    resort('pending', [cam('p', 'pending', 'link')]),
    resort('link', [cam('l', 'active', 'link')]),
    resort('mixed', [cam('broken', 'investigate'), cam('live', 'active')]),
    resort('playable', [cam('live2', 'active')]),
  ]

  const sorted = sortResorts(input)

  expect(sorted.map((r) => r.id)).toEqual(['mixed', 'playable', 'link', 'pending'])
  expect(sorted[0].cams.map((c) => c.id)).toEqual(['live', 'broken'])
  expect(input[0].id).toBe('pending')
})
