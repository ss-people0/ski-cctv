# 스키장 CCTV

Vue 3 + Vite + TypeScript. 국내 스키장 웹캠을 모아 보는 **개인용 정적 페이지**.
배포: https://ss-people0.github.io/ski-cctv/ · 저장소: `ss-people0/ski-cctv` · 사용자에게는 **한국어**로 답한다.

## 설명 방식 (중요)

사용자는 개발자가 아니다. 설명은 **결론부터 짧게, 쉬운 말로, 화면에서 뭐가 달라지는지** 중심으로 한다.
전문 용어는 한 줄로 뜻을 붙인다.

## 명령

- `npm test` — Vitest(jsdom). 현재 61개 통과. 수집기 테스트: `python3 -m unittest discover scripts`.
- `npm run build` — vue-tsc 타입체크 + vite 빌드.
- `npm run dev -- --host --port 5199` — 휴대폰 확인용(같은 와이파이에서 `http://<맥 IP>:5199`).

## 지금 화면 구성 (2026-11-25 전면 재디자인)

**디자인 레퍼런스:** 핀터레스트 "일러스트 여정(travel) 앱" (파스텔 + 벡터 설산). 실제 스키장 사진은 무료 라이선스로 좋은 게 없어서 **직접 그린 SVG 설산 일러스트**로 대체함.

- **메인(목록):** 스키장별 **파스텔 설산 일러스트 카드**(색조는 순서대로 자동). 카드 아래 흰 영역에 이름(왼쪽) + **실시간 날씨 칩**(오른쪽, 세로 중앙) + 슬로프 요약/지역.
- **상세(스키장 클릭):** 일러스트 배너(뒤로가기 ←, 로고, 날씨 칩) → 이름/지역 → **슬로프 현황 카드** → **사고 시 연락처 카드** → **라이브 캠**.
- **스크롤 고정 헤더:** 상세에서 150px 넘게 내리면 상단에 뒤로가기+스키장명이 고정(그라데이션 페이드로 자연스럽게). `scrolled` ref + window scroll 리스너.
- 테마: 파스텔 라이트(라벤더), 글꼴은 시스템 산세리프(`--sans`). 색 토큰은 `style.css` `:root`.

## 파일 구조

- `src/data/cams.ts` — **웹캠·스키장 데이터와 타입. 주소/좌표/연락처는 여기서만 관리.**
  - `Resort`: `id, name, region, officialPage, note?, coord?{lat,lon}, emergency?[{label,tels[]}], cams[]`
  - `Cam` status: `active | pending | investigate`, type: `hls | youtube | link`
  - 순서: 용평 · 지산 · 휘팍 · 하이원 · 웰리힐리 · 알펜시아 · 강촌
  - `GANGCHON_TOKEN`(공개 서명 토큰, 2027-10-30 만료), `PLAY_LIMIT_SEC=15`, `HIGH1_PLAY_LIMIT_SEC=30`
- `src/data/sortResorts.ts` — `isPlayable`, 캠 정렬(재생→링크→investigate→pending). `isBlockedByHttps`(https에서 http 스트림 차단).
- `src/data/slopeStatus.ts` — `slopes.json` 읽어 카드 배지로. `formatSlopeBadge`(→ `{summary, hours[]}` 또는 null), `loadSlopeStatus`, `todayKst`. stale/빈데이터/에러는 **숨김**(null).
- `src/data/weather.ts` — **Open-Meteo**로 실시간 날씨. `fetchWeather(lat,lon)`, `weatherFrom(code,temp,isDay)`. 키 불필요, CORS 열림, 비상업 무료(출처표기 CC BY 4.0).
- `src/components/SlopeStatusCard.vue` — 상세 슬로프 운영 현황: 개방 수/전체·진행률 바·난이도별 칩(개방/미개방/개방 예정/정보 미확인)·범례·운영시간 3칸·오픈 예정 안내. **들어올 때마다 접힌 상태**(상태 기억 안 함).
- `src/data/slopeStatus.ts` `buildSlopeBoard`(칩 데이터, 지난 시즌 값이면 preseason=전부 미개방, 목록 없으면 `slopeCatalog` 사용) · `formatUpcoming`(날짜만 표기, 당일·공식 현황 개방 시 자동 삭제) · `levelColor`.
- `cams.ts` `upcoming`(손으로 넣는 오픈 예정, name '스키장'=스키장 개장) · `slopeCatalog`(공식 슬로프 안내에서 옮긴 목록: 강촌 맵, 웰리힐리 사용자 캡처).
- `public/illustrations/{id}.jpg` — 사용자가 그린 스키장 일러스트(목록 2열 그리드·상세 상단). `MountainScene.vue`는 미사용(삭제 대기).
- `src/components/CamCard.vue` — type·status별 카드. ▶재생(미리보기) 버튼, 재생 중 카운트다운/이름 유지, 끝나면 "다시 보기", ✕ 닫기. 하이원은 https에서 `.popup` 새 창 링크.
- `src/components/HlsPlayer.vue` — hls.js 재생, `playLimitSec` 카운트다운 + 종료/오류 emit, 정리.
- `src/playingCam.ts` — 재생 중 카드 id(전역, 한 번에 하나만).
- `src/App.vue` — 목록/상세 전환(`selectedId`), 슬로프/날씨 로드, 스크롤 헤더.
- `src/style.css` — 파스텔 라이트 테마 토큰 + 레이아웃.
- `.github/workflows/collect-slopes.yml` — 슬로프 자동 수집(아래).
- `.github/workflows/deploy.yml` — 배포(아래).
- `scripts/collect_slopes.py` — 슬로프 수집 스크립트(파이썬 표준 라이브러리만).
- `public/data/slopes.json` — 수집된 슬로프 현황(로봇이 갱신·커밋).

## 자동화 (중요)

**슬로프 현황 = 자동 수집.** 직접 입력하는 게 아니라 로봇이 각 스키장 공식 페이지에서 긁어온다.

- `collect-slopes.yml`: 휘팍 뺀 나머지 **매시 08:17~17:17 KST**(`17 23,0-8 * * *`, `--exclude phoenix`) + 휘팍만 **09:47/12:47/16:47**(`47 0,3,7 * * *`) + 수동(전체). `scripts/collect_slopes.py` 실행 → `public/data/slopes.json` 갱신 → 바뀌면 커밋(push 전 `pull --rebase`).
  - 이번에 안 모은 리조트는 `keep_uncollected`가 **기존 값을 유지**(안 하면 휘팍이 파일에서 지워져 숨김됨).
  - 정각 cron은 GitHub가 밀리거나 빠뜨림(2026-11-26 09/10시 수집 누락 → 용평 하루 종일 숨김) → 정각 피하고 매시로 둠.
  - 테스트: `python3 -m unittest discover scripts`.
- `deploy.yml`: `main` push + **`workflow_run`(수집 워크플로 성공 후)** 트리거 → 테스트·빌드·Pages 배포.
  - ⚠️ 자동 토큰 커밋은 push 트리거를 안 울려서, 수집 후 배포는 `workflow_run`으로 이어받게 해둠.
- 화면 표시: 목록 카드 이름 밑(열린 슬로프 이름) + 상세 "슬로프 현황 카드". 운영시간(주간/정설/야간)은 고정값, OPEN/CLOSE만 실시간.
- **날씨는 수집 안 함.** 브라우저가 접속할 때마다 Open-Meteo로 실시간 호출(스키장별 `coord` 좌표).

### 스키장별 수집 상태(2026-11-25 기준)
- 용평 `ok`(sourceDate=오늘), 하이원 `ok`(날짜없음), 휘팍 `ok`(날짜없음) → 배지 **표시됨**.
- 지산 `ok`지만 sourceDate가 지난시즌 → stale 처리로 **숨김**. 알펜 `stale`, 강촌 `partial`(빈값), 웰리힐리 수집제외 → **숨김**. 올 시즌 데이터 올라오면 자동 표시.
- 운영시간/연락처 고정값: 용평·하이원·휘팍 hours는 `collect_slopes.py`의 각 함수에 하드코딩(공식 공지 기준). 하이원 패트롤 등 연락처는 `cams.ts` `emergency`.

## 지킬 것 (규칙)

- **사용자가 "배포해"(또는 "ㄱㄱ...배포까지")라고 할 때까지 push 하지 않는다.** `main` push = 사이트 즉시 변경. 이전 허락은 다음 push에 적용 안 됨. 로컬에서 확인시켜 주고 승인받는다.
- 막힌 스트림은 프록시 우회 X, 링크로 둠. 강촌은 공개 토큰 그대로 쓰기로 사용자가 정함(2026-11-24). 막히면 링크로 되돌림.
- `playLimitSec`(미리보기 시간) 없애지 않는다. 자동재생 X, 동시 1개만 재생.
- 날씨: 공식 기상청이 필요하면 키+Actions 수집 방식이어야 함(CORS·키노출 때문). 지금은 Open-Meteo 실시간.
- 공개 홍보 전 각 리조트 임베드 허락·약관 재확인(개인용이라 보류). 휘팍 API는 robots.txt가 `/api/` 금지 → 저빈도(하루 3회)로만.

## 함정 / 메모

- `window.scrollTo`, `HTMLMediaElement.load`는 jsdom에서 "Not implemented" 로그만 뜨고 테스트는 통과.
- CamCard는 `--surface` 등 CSS 토큰 사용 → 테마 바꾸면 자동 반영.
- 삭제 명령(rm/git rm)이 안전 훅에 막힘 → 파일 삭제는 사용자가 터미널 `!` 로 직접.
- **미사용 파일 `public/photos/`**(옛 사진, 2.8MB)가 남아있음 — 훅 때문에 못 지움. 정리하려면: `git rm -r public/photos` 후 커밋.
- 가끔 자동 수집 커밋(`chore: update slope status`)이 원격 main에 먼저 올라가 있음 → push 전 `git fetch` 후 rebase.
- 배포 워크플로 확인은 `gh run watch`.

## 참고 자료

- `../HANDOFF.md`(저장소 밖) — 초기 조사 메모.
- `docs/slope-status-research`(브랜치) — 슬로프 수집 조사 자료(이슈 #1).
