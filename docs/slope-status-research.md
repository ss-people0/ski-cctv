---
title: 스키장 슬로프 현황 수집 자료 & 모바일 개선 체크리스트
작성일: 2026-11-25 (KST)
기준 커밋: b1f8dc1 (`main`)
---

# 스키장 슬로프 현황 수집 자료 & 모바일 개선 체크리스트

이 문서는 **집 맥북의 Claude Code가 그대로 읽고 구현에 들어갈 수 있도록** 정리한 자료다.

- **파트 1** — 6개 스키장의 「오늘 운영시간 + 슬로프 운영 현황」을 서버에서 긁어오는 방법(엔드포인트·헤더·파싱 포인트·데이터 한계)과 권장 아키텍처
- **파트 2** — 현재 페이지(`https://ss-people0.github.io/ski-cctv/`)의 모바일·코드 개선 체크리스트
- 참고 스크립트 — `scripts/probe_slopes.py` (6곳을 실제로 조회해 JSON으로 뽑는 프로토타입, 표준 라이브러리만 사용)

모든 값은 **2026-11-25 09:04~09:36 KST에 실제 HTTP 요청으로 실측**한 것이다. 브라우저 렌더링(Playwright)은 필요 없다.

---

# 파트 1. 6개 스키장 운영시간·슬로프 현황 수집 자료

## 1.1 한눈에 보기

| 스키장 | 상태 | 수집 방식 | 필수 헤더 | 오늘 날짜 표기 | 오늘 운영시간 | 비고 |
|---|---|---|---|---|---|---|
| 모나용평 | ✅ 바로 가능 | HTML SSR 표 | — | ✅ `2026-11-25` | ✅ 08:30~16:30 | 가장 깔끔. 기준 구현으로 삼을 것 |
| 하이원리조트 | ✅ 바로 가능 | HTML SSR 표 2장 | — | ✗ | ✗ | 운영시간이 페이지에 없음(주석 처리) |
| 지산리조트 | ✅ 가능 | HTML SSR + 이미지 파일명 | **브라우저 UA** | △ 안내 기준일 `2026-03-01` | △ 고정 문구 09:00~17:00 | 현재 **지난 시즌 값** |
| 휘닉스 평창 | ✅ 가능 | 내부 JSON API | `Accept: application/json` | ✗ | ✅ 슬로프별 09:00-16:00 | `robots.txt`가 `/api/` 금지 → 30분 이상 간격 |
| 엘리시안 강촌 | ✅ 가능 | REST **POST** | **브라우저 UA + `Origin` + `x-api-key`** | ✅ 요청 날짜 | ✗ | 오늘 응답 `data: []` (26/27 미입력) |
| 알펜시아 | ⚠️ 조건부 | HTML에 박힌 JSON | — | △ `lastUpdusrPnttm` `2026-03-03` | △ 옛 문구(2021) | 관리자가 26/27로 갱신해야 의미 있음 |
| 웰리힐리파크 | ❌ 현재 불가 | — | — | ✗ | ✗ | **별도 확인 예정**(개발자 도구 접근 차단) — 이번 구현에서 제외 |

**종합:** 6곳 모두 Actions의 단순 HTTP 요청으로 수집 가능. 추가 패키지 불필요(파이썬 표준 `urllib` + `re`, 또는 Node `fetch`). 전체 응답 합계 약 0.7MB·5초 내외로 30분 주기에 부담 없다.

## 1.2 공통 구현 규칙 (먼저 읽을 것)

1. **User-Agent는 반드시 브라우저 UA.**
   `curl/x`, `Python-urllib/x`로 보내면 지산은 **400 `Request Blocked`**, 엘리시안 API는 **403 `Forbidden: suspicious tool`** 이 온다.
   ```python
   UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
   ```
2. **HTML 주석을 먼저 지운다.** 용평(야간 18:30~22:00), 하이원(운영시간 주중 09:00~19:00)은 옛 값을 주석 안에 남겨 둔다. 주석을 안 걷으면 지난 시즌 시간을 오늘 값으로 읽는다. `re.sub(r"<!--.*?-->", "", html, flags=re.S)`
3. **`fetchedAt`(조회 시각)과 `sourceDate`(사이트가 밝힌 기준일)를 항상 같이 저장한다.** 지산·알펜시아처럼 사이트가 지난 시즌 값을 그대로 두는 곳이 있어, 이게 없으면 3월 값을 오늘 값으로 보여 주게 된다.
4. **KST 기준.** Actions 러너는 UTC다. 워크플로에 `env: TZ: Asia/Seoul`을 주거나 파이썬에서 `timezone(timedelta(hours=9))`를 쓴다.
5. **타임아웃·실패 처리.** 사이트별 15초, 전체 60초. 한 곳이 실패해도 나머지는 저장하고, 그 리조트만 `status: "error"`로 남긴다. 직전 성공값을 유지하고 `staleSince`를 붙이는 편이 빈칸보다 낫다.
6. **리조트별 함수를 분리한다.** 마크업이 바뀌면 그 함수만 고치면 되도록. (`scripts/probe_slopes.py`가 이 구조다.)
7. **첫 실행은 Actions 러너에서 한 번 확인한다.** 이번 조사는 해외 클라우드 IP에서 했고 7곳 모두 응답했지만, Actions IP 대역에서 지역 차단이 없는지 1회 확인하는 것이 안전하다.

## 1.3 스키장별 상세

### ① 모나용평 — 기준 구현 (SSR 표)

- **URL** `https://yongpyong.co.kr/kor/skiNboard/slope/openStatusBoard.do`
- **요청** `GET` · 헤더 없음(브라우저 UA 권장) · 응답 약 70KB · 1.0~1.3초
- **응답 구조**
  - 표 제목에 **서버가 만든 오늘 날짜**: `슬로프 오픈 현황 (2026-11-25)` → `sourceDate`로 그대로 사용
  - `<tbody id="slopeStatus">` 안에 슬로프 행마다 `<em class="ico open">OPEN</em>` / `<em class="ico close">CLOSE</em>` (주간/야간 2개, 순서대로)
  - 발권가능시간: `<li><strong>[주간] Daytime</strong> 08:30 ~ 16:30</li>` 형태(현재 주간·오전·오후만 열려 있고 야간·심야는 주석 처리)
- **파싱 포인트**
  - `id="slopeStatus"`부터 `</tbody>`까지만 잘라 쓴다. 표 밖에 "3월 슬로프 운영일정", "심야 스키 운영일" 같은 **시즌 전체 문구**가 있어 전체 파싱은 오해를 부른다.
  - 이름은 `<td class=" conLeft">` 안. **골드파라다이스·블루·드래곤파크 3면은 마크업이 달라** 이름이 다른 태그로 감싸여 온다 → 태그를 걷어낸 뒤 앞의 `OPEN`/`CLOSE` 글자를 제거해 쓴다.
- **실측(11/25 09:36)**: 슬로프 18행 파싱, **OPEN = 핑크·뉴레드**(둘 다 08:30~16:30), 나머지 CLOSE. 리프트 14기 중 뉴레드·핑크·옐로우 OPEN(리프트는 표가 따로 있어 이번 범위에선 슬로프만 사용).
- **한계**: 없음. 날짜·시간·상태가 모두 서버 값이다.

### ② 하이원리조트 — SSR 표 2장, 운영시간 없음

- **URL**
  - 슬로프: `https://www.high1.com/ski/slopeView.do?key=748&mode=p` (약 62KB)
  - 리프트·케이블카: `https://www.high1.com/ski/slopeView.do?key=749&mode=g` (약 51KB)
- **요청** `GET` · 헤더 없음 · 0.8~1.9초
- **응답 구조**: 행마다 `<span class='slope_open open'>OPEN</span>` / `... close'>CLOSE` 가 주간·야간 순서로 들어 있다.
- **파싱 포인트 (중요)**
  - 슬로프 이름이 **rowspan + `<br>` 두 칸**으로 쪼개져 있다: `<td rowspan="4">제우스<br> (Zeus)</td>` 다음 칸이 번호 `Ⅰ` / `Ⅲ-1`. 이어지는 행에는 그룹 칸이 없으므로 **직전 그룹명을 물려줘야** `제우스Ⅲ-1`처럼 나온다.
  - 리프트 표는 `<th scope="row">리프트</th><th scope="row">주피터(JUPITER)</th>` 형태로 **이름이 두 번째 칸**이다. 슬로프와 규칙이 다르니 함수를 나누거나 분기할 것.
- **실측(11/25 09:36)**: 슬로프 **제우스Ⅲ-1·아테나Ⅲ 주간 OPEN**, 리프트 **주피터·운탄고도케이블카·마운틴·팰리스 OPEN**.
- **한계**
  - **오늘 운영시간이 페이지에 없다.** `<!-- <p>운영시간: 주중 09:00~19:00(정설없음)</p>-->`처럼 주석 처리된 옛 값뿐이다. 시간은 넣지 말고 OPEN/CLOSE만 표시할 것(11/25 실제 운영은 공지·언론 기준 09:00~16:00).
  - 페이지에 **날짜 표기가 없다** → `sourceDate: null`, 화면은 `fetchedAt`만 표시.
- **robots.txt**: 302(사실상 없음). 제한 없음.

### ③ 지산리조트 — SSR이지만 상태가 '이미지 파일명'

- **URL** `https://www.jisanresort.co.kr/w/ski/slopes/info.asp` (약 234KB, 2.9초)
- **요청** `GET` · **브라우저 UA 필수**(`curl` UA는 400). `Referer`는 없어도 통과.
- **응답 구조**: 표 각 칸이 `<img src='.../slope_open.png'>`, `slope_ready.png`, `slope_close.png` — 상태를 **파일명으로** 알 수 있어 난도가 낮다.
- **파싱 포인트**
  - 안내 기준일은 탭 제목에서: `<li class="on"><a ...>2026년 3월 1일 슬로프 운영안내</a>` → `sourceDate: "2026-03-01"`. 아래 공지에 `등록일 2026.02.25`도 있다.
  - 표는 `<table class="slope_table...>` 영역만. 행 제목(`<td class="tit">주간<br>` 등)이 시간 구분(주간/야간/심야)이다.
- **실측(11/25 09:36)**: `sourceDate 2026-03-01`(지난 시즌 폐장일 안내), 주간 **1-1·1·2·5·7 OPEN**, 뉴오렌지·3·6 CLOSE. 운영시간 문구 09:00~17:00 / 18:30~24:00 / 24:00~02:00(시즌 고정 문구).
- **한계**: **오늘 값이 아니다.** 26/27 운영안내가 새로 등록되면 탭 제목과 표가 함께 바뀌는 구조이므로, 그때까지는 **"3/1 기준"처럼 기준일을 반드시 화면에 표시**한다.

### ④ 휘닉스 평창 — 내부 JSON API

- **URL** `https://www.phoenixhnr.co.kr/api/snowpark/slope` (약 3KB, 0.65초) · 리프트는 `/api/snowpark/lift`
- **요청** `GET` · `Accept: application/json` · 브라우저 UA 불필요(있으면 무해)
- **응답 구조**: 레코드 17건. 필드 `slopeNm`, `slopeOpenDivNm`(주간/야간), `slopeOpenYn`(`Y`/없음), `slopeOpenTime`(`09:00-16:00`), `dfflyNm`(난이도).
  - **`slopeOpenYn` 필드 자체가 없으면 미운영**이다(CLOSE로 채우면 됨).
- **실측(11/25 09:36)**: **OPEN = 도도(강습전용)·호크**, 둘 다 09:00-16:00. 나머지 15면은 미운영.
- **한계·주의**
  - **응답에 기준 날짜가 없다.** 페이지는 브라우저 시각으로 제목을 만들고, 그마저 4시간을 빼서 새벽 0~4시에는 전날로 표시된다 → 화면에는 `fetchedAt`을 쓰는 게 정확하다.
  - **CORS 헤더가 없다** → 브라우저에서 직접 `fetch` 불가. Actions가 대신 받아 정적 JSON으로 저장해야 한다.
  - **`robots.txt`가 `User-agent: * / Disallow: /api/`** 로 내부 API를 명시적으로 막고 있다. 개인용이라도 30분 이상 저빈도로만, 가능하면 리조트 측에 문의하는 편이 맞다. 이 점은 화면이 아니라 이 문서에 남겨 둔다.
  - 리프트 API는 468건짜리 코드/시간표 목록이라 "오늘 운행 여부"가 아니다 → 슬로프 API만으로 충분.

### ⑤ 엘리시안 강촌 — REST POST, 헤더 3종

- **URL** `POST https://api.elysian.co.kr/api/v1/resort-Intro/slope-list`
- **본문** `{"ASLOPE_DATE":"2026-11-25"}` (`Content-Type: application/json;charset=UTF-8`)
- **필수 헤더 3종** (하나라도 빠지면 403)

  | 조건 | 결과 |
  |---|---|
  | 브라우저 UA + `Origin: https://www.elysian.co.kr` + `x-api-key` | **200** `{"success":"true","data":[...]}` |
  | UA만 `curl`/`Python-urllib` | 403 `Forbidden: suspicious tool` |
  | `Origin` 없음 | 403 `Forbidden: no origin & untrusted IP` |
  | `x-api-key` 없음 | 403 `forbidden` |

  `x-api-key` 값은 사이트 JS 번들에서 추출한 **공개 키**다(현재 `7Ji067mE64OQIOuCmOyLnOuCmOuniA==`). 번들이 바뀌면 값도 바뀌므로 **코드 한 곳에 모으고 환경변수로 덮어쓸 수 있게** 둘 것. `Referer`는 없어도 된다.
- **응답 구조**: `data[]` 각 행이 `SLOPE`, `DIVISION`, `WEEKLY`(주간), `AFTERNOON_A`, `NIGHT_TIME`, `LATE_AT_NIGHT`, `EARLY_DAWN` — 값은 문자열 `"1"`/`"0"`.
- **실측(11/25 09:36)**: HTTP 200, `success: true`, **`data: []` (0행)**. 12/20 등 다른 날짜도 빈 배열.
- **한계 (중요)**: **빈 배열은 "전부 CLOSE"가 아니라 "아직 데이터 없음"이다.** 26/27 슬로프 데이터가 입력되지 않았다. 화면에서는 `rows === 0`이면 **"정보 없음"** 으로 표시하고, 절대 전부 CLOSE로 그리지 말 것.

### ⑥ 알펜시아 — 구조는 되지만 데이터가 지난 시즌에 멈춤

- **URL** `https://www.alpensia.com/ski/slope-now.do` (약 109KB, 0.8초)
- **요청** `GET` · 헤더 없음
- **응답 구조**: 표의 칸은 비어 있고, 페이지 스크립트에 JSON 배열이 박혀 있다.
  ```
  var json = $.parseJSON('[{"ski700ConditionStatusSeq":111122,...,"ski700ConditionStatusTitle":"알파 - 주간 - 오픈일","ski700ConditionStatusData":"2025-12-04"}, ...]');
  ```
  슬로프별 **오픈일·종료일 범위**만 있고, 브라우저가 오늘 날짜와 비교해 OPEN/CLOSE를 계산한다 → **우리가 계산**해야 한다. 제목은 `"<슬로프> - <주간|야간> - <오픈일|종료일>"`.
- **실측(11/25 09:36)**: `lastUpdusrPnttm`이 전부 **`2026-03-03 11:18:44`**. 슬로프 7면(알파·브라보·찰리·델타·에코·폭스트롯·골프) 범위가 25/26 시즌에 멈춰 있어 **오늘 계산하면 전부 CLOSE**. 본문 안내문도 "운영 일정 : 2021년 12월 3일 ~ 2022년 3월 1일" 같은 옛 문구가 남아 있다.
- **참고(같은 사이트의 26/27 정보)**: 리프트 요금 페이지 `/ski/use-cost-lift.do`에는 최신 일정이 올라와 있다 — 운영 기간 `오픈일 ~ 2027-03-07`, 주간 `오픈일 ~ 2026-12-18` 및 `2027-02-14 ~ 03-07`, 야간 `2026-12-19 ~ 2027-02-13`, 주간 09:00~17:00·야간 18:30~21:30·정설 17:00~18:30. 이건 슬로프별 값이 아니라 시즌 전체 값이므로 슬로프 OPEN/CLOSE 대신 **"운영 기간"으로만** 쓸 수 있다.
- **한계**: 파서는 지금도 만들 수 있지만, 슬로프별 값은 **관리자가 26/27로 갱신해 줘야** 의미가 있다. 그때까지 `status: "stale"` + 기준일 표시로 두고, 개장 후 갱신 여부를 다시 확인한다(갱신되면 그때부터 완전 자동).

### ⑦ 웰리힐리파크 — 이번 구현에서 제외

현재 사이트가 이 경로를 정상 서비스하지 못한다(본문 클라이언트 렌더링 + 렌더용 청크 `/_nuxt/9b28959.js` 404, `window.__NUXT__`의 상태 플래그가 지난 시즌 스냅샷에서도 전부 `N`). 브라우저로도 값을 얻을 수 없다. **사용자가 별도 방법을 찾을 예정**이므로 수집 대상에서 빼고, 카드에는 "별도 확인 예정" 한 줄만 둔다. 12/4 개장 전후로 사이트가 정상화되면 다시 확인.

## 1.4 출력 JSON 스키마 (권장)

`public/data/slopes.json` — 프런트가 읽는 정적 파일.

```json
{
  "generatedAt": "2026-11-25T09:36:27+09:00",
  "timezone": "Asia/Seoul",
  "resorts": [
    {
      "id": "yongpyong",
      "name": "모나용평",
      "sourceUrl": "https://yongpyong.co.kr/...",
      "status": "ok",
      "sourceDate": "2026-11-25",
      "fetchedAt": "2026-11-25T09:36:27+09:00",
      "hours": [{ "label": "주간", "value": "08:30~16:30" }],
      "slopes": [{ "name": "핑크", "day": "OPEN", "night": "CLOSE" }],
      "lifts": [{ "name": "뉴레드", "day": "OPEN" }],
      "note": null
    }
  ]
}
```

- `status`: `ok` | `partial`(일부만) | `stale`(기준일이 오늘이 아님) | `error` | `skipped`
- 프런트는 **이 파일이 없거나 실패해도 페이지가 그대로 동작**해야 한다(없으면 슬로프 줄만 숨김).
- `src/data/cams.ts`의 리조트 id(`yongpyong`, `high1`, `jisan`, `phoenix`, `elysian`(강촌), `alpensia`, `wellihilli`)와 **키를 맞춰** 두면 매핑 코드가 필요 없다.

## 1.5 권장 아키텍처

```
GitHub Actions (30분 주기, TZ=Asia/Seoul)
  └ scripts/collect_slopes.py  (probe_slopes.py를 승격)
      └ public/data/slopes.json 로 저장 → 커밋
          └ Pages 배포 시 dist/data/slopes.json
              └ App.vue 리조트 카드 상단에 배지 표시
```

**왜 서버(Actions)에서 받아야 하나:** 휘닉스는 CORS 헤더가 없고, 엘리시안은 `Origin` 화이트리스트 + UA 검사를 한다. 브라우저에서 직접 호출하면 둘 다 막힌다. 정적 사이트 + 정기 수집 + JSON 파일이 가장 단순하고 안전하다.

**워크플로 스케치** (`.github/workflows/collect-slopes.yml`)

```yaml
name: Collect slope status
on:
  schedule:
    - cron: "*/30 * * * *"     # 30분 주기 (휘닉스 robots 배려). GitHub cron은 5~15분 늦을 수 있음
  workflow_dispatch:

concurrency:
  group: collect-slopes
  cancel-in-progress: false

jobs:
  collect:
    runs-on: ubuntu-latest
    permissions:
      contents: write          # 결과 커밋용
    env:
      TZ: Asia/Seoul
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v6
        with:
          python-version: "3.12"
      - run: python3 scripts/collect_slopes.py --out public/data/slopes.json
      - name: Commit if changed
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          mkdir -p public/data
          git add public/data/slopes.json
          git diff --cached --quiet || git commit -m "chore: update slope status"
          git push
```

- **대안(커밋 소음 없이):** `main`에 커밋하면 매번 Pages 배포가 다시 돈다(30분마다). 부담되면 `data` 브랜치에만 밀어 두고(`git push origin HEAD:data --force`) 프런트가 `https://raw.githubusercontent.com/ss-people0/ski-cctv/data/slopes.json`(CORS 허용)을 읽게 한다. 다만 이 경우 Pages 배포와 데이터 갱신이 분리되므로 `cache` 처리를 확실히 해야 한다(`fetch(url, {cache:'no-store'})` 또는 `?t=Date.now()`).
- **주기**: 기본 30분. 개장 직후·주말 오전에는 10~15분으로 올려도 되지만, 휘닉스는 30분 아래로 내리지 않는다.
- **실패**: 마지막 성공값 유지 + `staleSince`(마지막 성공 시각) 표시. 3회 연속 실패할 때만 "갱신 실패" 배지.

**프런트 표시 규칙** (`App.vue` 리조트 `summary` 안, 로고·이름 옆 한 줄)

| 상황 | 표시 예 |
|---|---|
| `ok` + `sourceDate`가 오늘 | `슬로프 2면 운영 · 주간 08:30~16:30 · 09:30 기준` |
| `stale` 또는 `sourceDate`가 오늘 아님 | `3/1 안내 기준 · 주간 5면 운영` (회색/주황 톤, "오늘"이라는 인상 금지) |
| `sourceDate` 없음(하이원·휘닉스) | `슬로프 2면 운영 · 09:30 조회` |
| `partial`에 rows 0(엘리시안) | `슬로프 정보 없음` |
| `error` / 파일 없음 | 표시하지 않음(레이아웃 흔들림 없이) |

시간은 **하이원에는 넣지 않는다**(데이터에 없음). 알펜시아는 `lastUpdate`가 오늘이 아니면 상태 대신 "26/27 일정 미갱신"만 보여 준다.

## 1.6 정책·주의

- **휘닉스 `/api/`는 robots.txt가 금지**한다. 개인용 저빈도(30분+)로만 쓰고, 공개 배포를 생각한다면 리조트에 문의하거나 슬로프 줄을 빼는 쪽이 맞다.
- 나머지 5곳은 사용 경로에 robots 제한 규칙이 확인되지 않았다. 다만 요청은 30분 1회 수준으로 유지한다(브라우저 사용자 1명과 같은 수준).
- 이 페이지는 현재 **개인용**이다. 공개 배포 시에는 각 리조트 약관·임베드 허락을 다시 확인해야 한다(README·CLAUDE.md에 이미 적혀 있는 원칙).
- 엘리시안 `x-api-key`는 공개 JS 번들의 값이지만, 그 값 자체를 화면이나 로그에 노출할 필요는 없다.

## 1.7 참고 스크립트 — `scripts/probe_slopes.py`

`urllib` + `re`만 사용. 리조트별 함수가 분리돼 있어 그대로 `scripts/collect_slopes.py`로 승격하면 된다.

```bash
python3 scripts/probe_slopes.py                 # 6곳 전부 (웰리힐리 제외)
python3 scripts/probe_slopes.py yongpyong jisan # 일부만
python3 scripts/probe_slopes.py --out public/data/slopes.json
```

**실행 결과 (2026-11-25 09:36 KST, 이 스크립트로 실제 조회)**

| 리조트 | status | sourceDate | 파싱 행 | OPEN | 시간 |
|---|---|---|---|---|---|
| 모나용평 | ok | 2026-11-25 | 슬로프 18 | 핑크·뉴레드 | 주간 08:30~16:30 |
| 하이원 | ok | — | 슬로프 19 / 리프트 9 | 제우스Ⅲ-1·아테나Ⅲ / 주피터·운탄고도케이블카·마운틴·팰리스 | — |
| 지산 | ok | 2026-03-01 | 24 | 1-1·1·2·5·7 | 09:00~17:00 |
| 휘닉스 | ok | — | 17 | 도도(강습전용)·호크 | 09:00-16:00 |
| 엘리시안 | partial | 2026-11-25 | 0 | — | — |
| 알펜시아 | stale | 2026-03-03 | 7 | — (범위가 지난 시즌) | — |

## 1.8 남은 확인 과제

1. **지산** — 26/27 운영안내 등록 시점(개장 공지)에 `sourceDate`가 오늘로 바뀌는지 확인.
2. **알펜시아** — 관리자가 슬로프별 값을 26/27로 갱신하는지, 개장 후 재확인.
3. **엘리시안** — 개장 후 `data` 배열이 채워지는지 확인(지금은 빈 배열).
4. **웰리힐리** — 별도 확인 예정(사용자). 사이트 정상화 시 재시도.
5. **Actions 러너 1회 실행** — 해외 IP·Actions 대역에서 차단이 없는지 실제 워크플로로 확인.

---

# 파트 2. 모바일·코드 개선 체크리스트

대상: `https://ss-people0.github.io/ski-cctv/` (기준 커밋 `b1f8dc1`), 실측 뷰포트 390×844 / 320×568 / 844×390 + 데스크톱 1920×993.

> **제외 항목** — 영상의 `✕` 닫기 버튼 크기(28×28)는 **일부러 작게 둔 것**이다(다른 영상을 누르면 이전 영상이 꺼지므로 닫기 버튼을 크게 둘 이유가 없다). 이 항목은 손대지 않는다. 나머지 터치·접근성 항목은 유효하다.

## P0 — 먼저 손볼 것

### P0-1. 15초 종료가 "고장"처럼 보인다
- 버튼 라벨이 `▶ 재생 (15초)` 하나뿐이고, 재생 중 남은 시간을 알려 주는 UI가 없다. 15초가 끝나면 `stop(false)` → `playingCamId = null`로 **아무 메시지 없이** 카드가 원상복귀한다(`CamCard.vue:28-35`, `HlsPlayer.vue:12-20`). 실측: 종료 후 `hasError: false`, 텍스트 `베이스전경 / 레드 슬로프 ▶ 재생 (15초)` — 오류일 때는 빨간 문구가 뜨는데 정상 종료는 조용해서 오히려 "영상이 꺼졌다"로 읽힌다.
- 일시정지해도 타이머는 계속 흐른다(`video` 이벤트와 무관한 `setTimeout`). 잠깐 멈췄다 다시 누르면 남은 시간이 줄어 있다.
- **할 일**
  1. 재생 중 오버레이에 `15 → 0` 카운트다운 pill 표시.
  2. 끝난 뒤에는 재생 버튼으로 되돌리지 말고 카드 안에 **`15초 미리보기가 끝났어요` + [다시 보기] + [공식 웹캠 열기]** 를 남긴다.
  3. `pause`에서 타이머 정지, `play`에서 이어가기(남은 초 기준으로 `endAt` 재계산).
  4. (선택) [계속 보기]로 한 번 더 15초 연장. 라벨에 "미리보기"라는 말을 넣어 리조트 서버에 대한 예의를 표시.

### P0-2. 재생 중 카드에서 캠 이름이 사라진다
- `CamCard.vue:40` `<div v-if="!isPlaying" class="info">` 안에 `<h4>{{ cam.name }}</h4>`가 있어 **재생을 시작하면 이름이 DOM에서 제거**된다. 실측: 재생 중 카드 `textContent`가 `✕` 하나뿐. 390px 화면에서는 그 카드 하나만 보이는데 이름표가 없다.
- **할 일**: 이름(h4)은 항상 남기고 `actions` 블록만 `v-if="!isPlaying"`. 재생 중에는 같은 줄에 카운트다운을 붙이면 P0-1과 함께 해결.

### P0-3. 리조트 이동: URL에 안 남고, 스크롤하면 사라지고, 고르면 다른 리조트가 없어진다
- 선택 상태는 `const selectedId = ref(ALL)` 하나뿐(`App.vue:12`)이고 `history`/`location`을 건드리지 않는다. 실측: 하이원을 골라도 `location.href` 그대로 → 새로고침·공유·뒤로가기 모두 초기 상태로 돌아간다.
- 고르면 `visibleResorts`가 그 리조트만 남긴다(`App.vue:13-15`) → 다른 리조트로 가려면 드롭다운을 다시 열어야 한다.
- 툴바가 상단 고정이 아니다. 하이원 펼침 페이지 높이 2,630px → 아래에서 다른 리조트로 가려면 위로 2화면 넘게 올라와야 한다.
- **할 일**
  1. `location.hash = '#yongpyong'`(또는 `?r=`)로 동기화하고 로드 시 읽어 그 리조트를 펼친다 → 카톡으로 "이 스키장 캠" 링크를 보낼 수 있게 된다.
  2. 상단에 **sticky 가로 스크롤 칩 행**(`모나용평 10` 처럼 리조트명 + 캠 수)을 두고 드롭다운은 유지.
  3. 고른 뒤 `scrollIntoView`.
  4. "전체"에서는 필터로 지우지 말고 **고른 리조트만 펼치고 나머지는 접힌 채** 둔다.

### P0-4. 목록 밀도 — 캠 1개당 118px
- 카드 322×106 + 간격 12. 모나용평 10캠 1,180px, 하이원 18캠 2,630px. `cams` 그리드가 `minmax(min(320px,100%),1fr)`이라 390px에서는 무조건 1열(`style.css:56`).
- **할 일**: 기본은 **이름 + 작은 ▶ 한 줄짜리 컴팩트 행(56~64px)**, 탭하면 그 자리에서 16:9 플레이어로 확장. 또는 캠 이름만 있는 **2열 칩 그리드**(44px). 새 창으로만 열리는 하이원 18개에 특히 잘 맞는다.

## P1 — 함께 고치면 좋은 것

### P1-5. 15초 예산에 로딩 시간이 포함되고, 실패 안내가 한 문장뿐
- `HlsPlayer.vue:20`이 **마운트 즉시** 15초 타이머를 걸고, 그 안에 메타데이터가 안 오면 오류로 끝난다(실측: 첫 시도가 `readyState 0`인 채 15초를 보내고 오류). 성공 회차에도 로딩 중에는 검은 화면 + 브라우저 기본 스피너뿐.
- 오류 문구는 `지금은 영상을 볼 수 없어요. 잠시 후 다시 눌러 주세요.`(`CamCard.vue:42`) 하나로, 느린 네트워크·404·토큰 만료·HTTP 차단이 모두 같은 문장이고 **공식 페이지로 가는 대체 버튼이 없다**.
- **할 일**: 로딩 10초와 시청 15초 분리 → 로딩 실패 시 `연결이 느려요 · 다시 시도`, 메타데이터 이후 시청 15초 시작. 자동 1회 재시도(`hls.startLoad()`) 후에도 실패하면 `[공식 웹캠 열기]` 버튼. 로딩 중 `연결 중… 3초` 표시.

### P1-6. 하이원 18캠 — 왜 여기만 새 창인지 화면이 설명하지 않는다
- https 페이지에서는 `isBlockedByHttps`(`sortResorts.ts:4-7`) 때문에 하이원 스트림을 재생할 수 없어 `▶ 영상 보기 (새 창)` 링크가 된다(`CamCard.vue:49-57`). `window.open(...,'popup,...,width=680,height=550')`은 모바일에서 **새 탭**으로 열리고, 공식 팝업 페이지가 `setTimeout(closePopup, 30000)`으로 **30초 뒤 스스로 닫힌다**.
- 데이터의 `note`(`cams.ts:18`)가 **화면 어디에도 렌더되지 않는다**(`App.vue`에 `note` 사용 없음).
- **할 일**: `note`를 리조트 헤더 아래 작은 회색 1~2줄로 렌더(모바일 접기 가능). 하이원 버튼 라벨을 `공식 팝업 (30초)` 정도로. "새 탭이 30초 뒤 닫힙니다" 한 줄 안내.

### P1-7. 초기 로딩 830KB — hls.js를 늘 받는다
- `HlsPlayer.vue:2` `import Hls from 'hls.js'` 정적 import → JS 662KB(gzip 211KB)를 첫 페인트 전에 받는다. iOS Safari 네이티브 경로(`HlsPlayer.vue:28`)로 가면 한 줄도 쓰지 않는 코드다.
- `phoenix.png` 252KB(540×540을 56×44로 표시), `favicon.png` 161KB(512×512), `hero.jpg` 172KB, 심볼 7장 284KB — 모두 lazy 없이 즉시 요청.
- **할 일**
  - `const { default: Hls } = await import('hls.js')` — 재생 버튼을 누를 때만 로드.
  - 심볼·파비콘을 표시 크기로 리사이즈 + WebP(`phoenix.png` 250KB → 수 KB).
  - `hero.jpg`는 720px WebP/AVIF + `<picture>`/`srcset`, `decoding="async"`, `fetchpriority="high"`.
  - 심볼 `img`에 `loading="lazy" decoding="async"`.

### P1-8. 히어로가 화면을 많이 먹는다 (특히 가로)
- 390×844 220px(26%), 320×568 220px(38.7%), **844×390 가로 300px(77%)** — 가로로 돌리면 히어로와 툴바만 보이고 캠은 하나도 안 보인다. 모바일 규칙(`style.css:58-66`)에 가로/낮은 화면 대응이 없다.
- **할 일**: 모바일 히어로 96~120px, 또는 스크롤하면 히어로가 접히고 툴바만 sticky.
  ```css
  @media (orientation: landscape) and (max-height: 480px) {
    .hero { min-height: 96px } .rider { display: none }
  }
  ```

## P2 — 여유 있을 때

### P2-9. 터치·접근성 (닫기 ✕ 크기는 **제외**)
- 리조트 로고가 `<a>`(56×44)로 새 창 이동(`App.vue:57-66`) — 모바일에서 행을 펼치려다 로고를 누르면 공식 사이트로 이탈한다. 로고 링크를 summary 바깥(펼친 내용 안)으로 옮기거나 새 창 링크를 텍스트로.
- `select`에 화면용 `<label for="resort">`가 없다(aria-label은 있음).
- JS가 없으면 `#app`이 비어 있다 → `<noscript>` 한 줄 안내.
- 재생 버튼 44px, 드롭다운 46px, summary 73px은 문제 없음. 대비 `#566572` on `#f3f6f8` ≈ 5.6:1로 AA 통과(단 credit 12.8px는 작음).

### P2-10. 상태 문구 정확성
- **휘닉스 호크/스패로우**: 실제로는 세그먼트 404로 보류인데(`cams.ts:125` 주석) 화면 문구는 `오픈 준비 중`(`CamCard.vue:47`) → 시즌 전 캠으로 읽힌다. `hold`/`broken` 상태를 따로 두고 `주소는 있지만 응답이 없어요` 같은 문구를 쓰거나 `note`를 노출.
- **알펜시아 유튜브만 제한 없음**: 15초 표기가 없고 20초 뒤에도 계속 재생된다. 같은 미리보기 규칙을 적용하거나 `계속 재생`임을 명시.
- 지산 블루/실버 `오픈 준비 중`, 웰리힐리 정상광장 `지금은 영상이 나오지 않아요`는 적절.

### P2-11. 즐겨찾기·최근 본 캠 없음
- `localStorage`/`sessionStorage` 사용이 전혀 없다. 기본 진입이 항상 "전체 + 전부 접힘"이라 매번 같은 리조트를 두 번(펼치기 → 재생) 눌러야 한다.
- **할 일**: 카드에 별(★) → 상단 `즐겨찾기` 섹션, 마지막으로 연 리조트·캠 기억해 자동 펼침.
- **PWA**: `manifest.json`이 없다(404 확인) → 홈 화면 추가가 "주소창 있는 Safari 바로가기"가 되고 Android는 아이콘·테마색 제어 불가. `manifest.json`(192/512 아이콘, `display: standalone`, `theme_color #dceaf4`), `<link rel="manifest">`, `<meta name="theme-color">` 추가.

### P2-12. 코드 위생
- `style.css:16` `:root:has(.screen:popover-open)` — 팝오버 제거 후 남은 죽은 규칙. `CamCard.vue:101` `.sr-only` 미사용.
- `README.md`가 코드와 어긋난다: 엘리시안강촌 `1 | 링크`(실제 HLS 6개), 웰리힐리 `정상광장은 링크`(실제 `investigate` HLS), "크게 보기: PC는 팝업, 모바일은 큰 화면"(UI에 없음).
- `color-scheme: light` 고정 — 선택 사항.

## 지금도 잘 된 부분 (유지)
- 한 번에 한 캠만 재생(`playingCam.ts`), 리조트 접기·필터 변경·화면 이탈 시 재생 중지(`App.vue:20-28`).
- 포커스 관리: 재생 시 비디오로, 종료 시 재생 버튼으로(`CamCard.vue:20,34`), 오류에 `role="alert"`, 버튼·링크 `aria-label`, `:focus-visible` 링.
- 정지 시 `hls.destroy()` + `removeAttribute('src')` + `load()`(`HlsPlayer.vue:35-41`).
- 320px까지 가로 스크롤 없음, 주요 터치 타깃 44~73px, 재생 가능 캠 우선 정렬, OG/트위터 카드.

## 확인하지 못한 것 (추측으로 채우지 않음)
- **실제 아이폰 사파리 렌더링**: 데스크톱 Chrome을 좁힌 뷰포트로 측정. iOS는 네이티브 HLS 경로라 로딩 표시·컨트롤·전체화면·세이프에어리어 동작이 다를 수 있다.
- **실제 모바일 네트워크 로딩 시간**: 원격 브라우저 환경에서 용평 스트림이 첫 15초 안에 뜨지 못했다. 사용자 폰·통신사에서의 시간은 미측정.
- **별건**: 점검 시각(11/25 07:21) 알펜시아 유튜브 라이브(`videoId: IBGo-_Y3-g4`)가 슬로프가 아니라 **윈도우 데스크톱 화면**을 송출하고 있었다. 코드 문제가 아니라 `cams.ts`의 `videoId`가 실제 방송과 맞는지 확인이 필요하다.
