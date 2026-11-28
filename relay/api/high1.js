import { allowOrigin, rewritePlaylist, upstreamUrl } from '../lib.js'

// GET /api/high1?ch=1&f=playlist.m3u8 → 하이원 :1935 스트림을 https로 넘겨준다(Vercel Node 함수).
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ch = searchParams.get('ch')
  const f = searchParams.get('f')
  const cors = { 'Access-Control-Allow-Origin': allowOrigin(request.headers.get('origin')) ?? 'https://ss-people0.github.io', Vary: 'Origin' }

  const url = upstreamUrl(ch, f)
  if (!url) return new Response('not allowed', { status: 400, headers: cors })

  let upstream
  try {
    upstream = await fetch(url, { headers: { Referer: 'http://www.high1.com/' }, signal: AbortSignal.timeout(8000) })
  } catch (error) {
    console.error('high1 upstream failed', url, error)
    return new Response('upstream unreachable', { status: 502, headers: cors })
  }
  if (!upstream.ok) return new Response('upstream error', { status: upstream.status, headers: cors })

  if (f.endsWith('.m3u8')) {
    const body = rewritePlaylist(await upstream.text(), ch)
    return new Response(body, {
      headers: { ...cors, 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-cache' },
    })
  }
  // 영상 조각(.ts)은 받는 대로 흘려보낸다. 같은 조각을 여러 명이 보면 Vercel 캐시가 재사용한다.
  return new Response(upstream.body, {
    headers: { ...cors, 'Content-Type': 'video/mp2t', 'Cache-Control': 'public, s-maxage=60, max-age=60' },
  })
}
