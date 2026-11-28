import { corsHeaders } from '../lib.js'
import { rewritePlaylist, upstreamUrl } from '../konjiam.js'

// GET /api/konjiam?cam=cam01&f=playlist.m3u8 → 곤지암 http(80) 스트림을 https로 넘겨준다.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const cam = searchParams.get('cam')
  const f = searchParams.get('f')
  const cors = corsHeaders(request.headers.get('origin'))

  const url = upstreamUrl(cam, f)
  if (!url) return new Response('not allowed', { status: 400, headers: cors })

  let upstream
  try {
    upstream = await fetch(url, { signal: AbortSignal.timeout(10000) })
  } catch (error) {
    console.error('konjiam upstream failed', url, error)
    return new Response('upstream unreachable', { status: 502, headers: cors })
  }
  if (!upstream.ok) return new Response('upstream error', { status: upstream.status, headers: cors })

  if (f.endsWith('.m3u8')) {
    const body = rewritePlaylist(await upstream.text(), cam)
    return new Response(body, {
      headers: { ...cors, 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-cache' },
    })
  }
  return new Response(upstream.body, {
    headers: { ...cors, 'Content-Type': 'video/mp2t', 'Cache-Control': 'public, s-maxage=60, max-age=60' },
  })
}
