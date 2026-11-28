import { expect, test } from 'vitest'
// @ts-expect-error 중계 코드는 Vercel용 순수 JS 모듈이다
import { allowOrigin, rewritePlaylist, upstreamUrl } from './lib.js'

test('only Hi1 cams 1-18 and their own file names are relayed (not an open proxy)', () => {
  expect(upstreamUrl('1', 'playlist.m3u8')).toBe('http://59.30.12.195:1935/live/ch1.stream/playlist.m3u8')
  expect(upstreamUrl('5', 'media_w1103570177_4.ts')).toBe('http://59.30.12.195:1935/live/ch5.stream/media_w1103570177_4.ts')
  expect(upstreamUrl('19', 'playlist.m3u8')).toBeNull()
  expect(upstreamUrl('18', 'playlist.m3u8')).toBe('http://59.30.12.195:1935/live/ch18.stream/playlist.m3u8')
  expect(upstreamUrl('0', 'playlist.m3u8')).toBeNull()
  expect(upstreamUrl('1', '../../etc/passwd')).toBeNull()
  expect(upstreamUrl('1', 'http://evil.example/x.m3u8')).toBeNull()
  expect(upstreamUrl(null, 'playlist.m3u8')).toBeNull()
})

test('playlist file names are rewritten to go back through the relay', () => {
  const master = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=3084634\nchunklist_w420334151.m3u8\n'
  const chunks = '#EXTM3U\n#EXTINF:9.532,\nmedia_w1103570177_4.ts\nhttp://evil.example/x.ts\n'

  expect(rewritePlaylist(master, '2')).toBe('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=3084634\nhigh1?ch=2&f=chunklist_w420334151.m3u8\n')
  expect(rewritePlaylist(chunks, '2')).toBe('#EXTM3U\n#EXTINF:9.532,\nhigh1?ch=2&f=media_w1103570177_4.ts\n\n')
})

test('only our site may read the relay from a browser', () => {
  expect(allowOrigin('https://ss-people0.github.io')).toBe('https://ss-people0.github.io')
  expect(allowOrigin('http://localhost:5199')).toBe('http://localhost:5199')
  expect(allowOrigin('https://evil.example')).toBeNull()
})
