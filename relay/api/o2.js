import { FETCH_OPTS, corsHeaders } from '../lib.js'
import { O2_PAGE, extractCamFile, isChannel, rewritePlaylist, upstreamUrl } from '../o2.js'

// GET /api/o2?ch=0&f=cam0.m3u8 → 오투 http:8080 스트림을 https로 넘겨준다.
// 채널(ch0~7)과 파일 이름(cam0~3, cam20~23)이 순서대로 맞지 않아, 채널 플레이어 페이지에서
// 실제 파일 이름을 먼저 확인한다. 그 값은 자주 바뀌지 않아 10분쯤 재사용한다.
const CAM_TTL_MS = 10 * 60 * 1000
const camFiles = new Map() // ch → { file, at }

async function camFile(ch, fresh = false) {
  const hit = camFiles.get(ch)
  if (!fresh && hit && Date.now() - hit.at < CAM_TTL_MS) return hit.file
  const res = await fetch(O2_PAGE(ch), FETCH_OPTS)
  if (!res.ok) throw new Error(`o2 page ${res.status}`)
  const file = extractCamFile(await res.text())
  if (!file) throw new Error('o2 page has no stream file')
  camFiles.set(ch, { file, at: Date.now() })
  return file
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ch = searchParams.get('ch')
  const f = searchParams.get('f')
  const cors = corsHeaders(request.headers.get('origin'))

  // f=playlist.m3u8은 "이 채널의 첫 요청"이라는 뜻이고, 실제 파일 이름은 아래에서 확인한다.
  if (!isChannel(ch) || !(f === 'playlist.m3u8' || upstreamUrl(f))) return new Response('not allowed', { status: 400, headers: cors })

  let upstream
  try {
    // 첫 요청(f=playlist.m3u8)은 채널의 실제 파일 이름을 확인해 넘겨준다.
    const file = await camFile(ch)
    upstream = await fetch(upstreamUrl(f === 'playlist.m3u8' ? file : f), FETCH_OPTS)
  } catch (error) {
    console.error('o2 upstream failed', ch, f, error)
    return new Response('upstream unreachable', { status: 502, headers: cors })
  }
  if (!upstream.ok) {
    camFiles.delete(ch)
    return new Response('upstream error', { status: upstream.status, headers: cors })
  }

  if (f.endsWith('.m3u8')) {
    const body = rewritePlaylist(await upstream.text(), ch)
    return new Response(body, {
      headers: { ...cors, 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-cache' },
    })
  }
  // 오투는 2초짜리 작은 조각이라 짧게만 캐시한다.
  return new Response(upstream.body, {
    headers: { ...cors, 'Content-Type': 'video/mp2t', 'Cache-Control': 'public, s-maxage=30, max-age=30' },
  })
}
