import { FETCH_OPTS, corsHeaders } from '../lib.js'
import { MUJU_PAGE, extractStream, rewritePlaylist, upstreamUrl } from '../muju.js'

// GET /api/muju?cam=07&f=playlist.m3u8 → 무주 http(80) 스트림을 https로 넘겨준다.
// 주소에 붙는 서명 토큰(?e=만료시각&h=해시)은 팝업 페이지에서 뽑아 쓴다. 토큰 수명이 9시간이라
// 한 번 뽑은 값을 잠깐(5분) 재사용해 조각마다 페이지를 다시 받지 않는다.
const TOKEN_TTL_MS = 5 * 60 * 1000
const tokens = new Map() // cam → { e, h, at }

async function readToken(cam, fresh = false) {
  const hit = tokens.get(cam)
  if (!fresh && hit && Date.now() - hit.at < TOKEN_TTL_MS) return hit
  const res = await fetch(MUJU_PAGE(cam), { ...FETCH_OPTS, headers: { ...FETCH_OPTS.headers, Referer: 'http://www.mdysresort.com/guide/webcam.asp' } })
  if (!res.ok) throw new Error(`muju popup ${res.status}`)
  const stream = extractStream(await res.text())
  if (!stream) throw new Error('muju popup has no stream url')
  const token = { e: stream.e, h: stream.h, at: Date.now() }
  tokens.set(cam, token)
  return token
}

async function load(cam, f) {
  for (const fresh of [false, true]) {
    const token = await readToken(cam, fresh)
    const upstream = await fetch(upstreamUrl(cam, f, token), FETCH_OPTS)
    // 토큰이 만료됐으면 새로 뽑아 한 번만 더 시도한다.
    if (upstream.ok || (upstream.status !== 400 && upstream.status !== 403) || fresh) return upstream
  }
  return null
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const cam = searchParams.get('cam')
  const f = searchParams.get('f')
  const cors = corsHeaders(request.headers.get('origin'))

  if (!upstreamUrl(cam, f, { e: '0', h: '0' })) return new Response('not allowed', { status: 400, headers: cors })

  let upstream
  try {
    upstream = await load(cam, f)
  } catch (error) {
    console.error('muju token failed', cam, error)
    tokens.delete(cam)
    return new Response('upstream unreachable', { status: 502, headers: cors })
  }
  if (!upstream || !upstream.ok) return new Response('upstream error', { status: upstream?.status ?? 502, headers: cors })

  if (f.endsWith('.m3u8')) {
    const body = rewritePlaylist(await upstream.text(), cam)
    return new Response(body, {
      headers: { ...cors, 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-cache' },
    })
  }
  return new Response(upstream.body, {
    headers: { ...cors, 'Content-Type': 'video/mp2t', 'Cache-Control': 'public, s-maxage=30, max-age=30' },
  })
}
