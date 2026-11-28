import { expect, test } from 'vitest'
// @ts-expect-error 중계 코드는 Vercel용 순수 JS 모듈이다
import { rewritePlaylist as konjiamPlaylist, upstreamUrl as konjiamUrl } from './konjiam.js'
// @ts-expect-error 중계 코드는 Vercel용 순수 JS 모듈이다
import { extractStream, rewritePlaylist as mujuPlaylist, upstreamUrl as mujuUrl } from './muju.js'
// @ts-expect-error 중계 코드는 Vercel용 순수 JS 모듈이다
import { extractCamFile, rewritePlaylist as o2Playlist, upstreamUrl as o2Url } from './o2.js'

// 곤지암: 하이원과 같은 파일 이름 규칙. cam01~05만 통과시킨다.
test('곤지암은 cam01~05의 정해진 파일 이름만 중계한다', () => {
  expect(konjiamUrl('cam01', 'playlist.m3u8')).toBe('http://konjiam.live.cdn.cloudn.co.kr/konjiam/cam01.stream/playlist.m3u8')
  expect(konjiamUrl('cam05', 'media_w920257721_154799.ts')).toBe(
    'http://konjiam.live.cdn.cloudn.co.kr/konjiam/cam05.stream/media_w920257721_154799.ts',
  )
  expect(konjiamUrl('cam06', 'playlist.m3u8')).toBeNull()
  expect(konjiamUrl('cam01', '../../etc/passwd')).toBeNull()
  expect(konjiamUrl('cam01', 'http://evil.example/x.m3u8')).toBeNull()
})

test('곤지암 playlist는 하이원과 같은 방식으로 중계 주소를 만든다', () => {
  const master = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=1291334\nchunklist_w920257721.m3u8\n'
  expect(konjiamPlaylist(master, 'cam02')).toBe('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=1291334\nkonjiam?cam=cam02&f=chunklist_w920257721.m3u8\n')
})

// 무주: 팝업 페이지에서 서명 토큰(?e=&h=)을 뽑고, 목록 줄에 붙은 토큰은 떼고 다시 붙인다.
test('무주 팝업 페이지에서 캠 번호와 서명 토큰을 뽑는다', () => {
  const html = `<video id=muju-video><source
     src="http://muju.cache.cdn.cloudn.co.kr/mujuresort/_definst_/cam07.stream/playlist.m3u8?e=1795899801&h=87247449db68c9df00281fe5bc550e2f"
     type="application/x-mpegURL">
</video>`
  expect(extractStream(html)).toEqual({ cam: '07', e: '1795899801', h: '87247449db68c9df00281fe5bc550e2f' })
  expect(extractStream('<video>점검 중입니다</video>')).toBeNull()
  expect(extractStream('http://muju.cache.cdn.cloudn.co.kr/mujuresort/_definst_/cam07.stream/playlist.m3u8')).toBeNull()
})

test('무주는 토큰을 붙여 원본 주소를 만들고, 토큰이 없으면 중계하지 않는다', () => {
  const token = { e: '1795899801', h: '87247449db68c9df00281fe5bc550e2f' }
  expect(mujuUrl('07', 'media_w1940807101_16541.ts', token)).toBe(
    'http://muju.cache.cdn.cloudn.co.kr/mujuresort/_definst_/cam07.stream/media_w1940807101_16541.ts?e=1795899801&h=87247449db68c9df00281fe5bc550e2f',
  )
  expect(mujuUrl('12', 'playlist.m3u8', token)).toBeNull()
  expect(mujuUrl('07', 'playlist.m3u8', null)).toBeNull()
})

test('무주 목록 줄에 붙은 토큰은 떼고 중계 주소로 바꾼다', () => {
  const master = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=606803\nchunklist_w1940807101.m3u8?e=1795899654&h=7c19a3fb\n'
  expect(mujuPlaylist(master, '07')).toBe('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=606803\nmuju?cam=07&f=chunklist_w1940807101.m3u8\n')
})

// 오투: 채널 번호와 파일 이름이 순서대로 맞지 않아 플레이어 페이지에서 실제 이름을 확인한다.
test('오투 플레이어 페이지에서 채널의 실제 m3u8 이름을 뽑는다', () => {
  const page = '<source src="http://118.46.149.144:8080/ramdisk/cam21.m3u8" type="application/x-mpegURL">'
  expect(extractCamFile(page)).toBe('cam21.m3u8')
  expect(extractCamFile('<html>404 Not Found</html>')).toBeNull()
})

test('오투는 ramdisk 안의 cam 조각만 중계한다', () => {
  expect(o2Url('cam0783.ts')).toBe('http://118.46.149.144:8080/ramdisk/cam0783.ts')
  expect(o2Url('cam21.m3u8')).toBe('http://118.46.149.144:8080/ramdisk/cam21.m3u8')
  expect(o2Url('../../streaming/streamhls2.jsp?ch=0')).toBeNull()
  expect(o2Url('playlist.m3u8')).toBeNull()
})

test('오투 목록 줄은 조각마다 중계 주소로 바꾼다', () => {
  const media = '#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:783\n#EXTINF:1.998000,\ncam0783.ts\nhttp://evil.example/x.ts\n'
  expect(o2Playlist(media, '1')).toBe('#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:783\n#EXTINF:1.998000,\no2?ch=1&f=cam0783.ts\n\n')
})
