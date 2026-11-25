#!/usr/bin/env python3
"""스키장 「오늘 슬로프 운영 현황」 수집 참고용 프로토타입.

- 목적: GitHub Actions(파이썬 표준 라이브러리만 사용)에서 6개 스키장의
  슬로프 OPEN/CLOSE + (있으면) 운영시간을 모아 JSON으로 출력한다.
- 웰리힐리파크는 개발자 도구 접근 차단으로 현재 수집 불가 → 이 스크립트에서 제외.
  (2026-11-25 실측: 본문이 클라이언트 렌더링이고 렌더용 청크가 404. 개장 후 재확인)
- 이 파일은 "참고용 원형"이다. 실제 도입 시에는 리조트별 함수를 그대로 가져다
  `scripts/collect_slopes.py`로 옮기고 실패 처리·캐시만 보강하면 된다.

사용법
    python3 scripts/probe_slopes.py                 # 6곳 전부
    python3 scripts/probe_slopes.py yongpyong jisan # 일부만
    python3 scripts/probe_slopes.py --out result.json

설계 메모
- 외부 패키지(requests, bs4) 없이 urllib + re 만 쓴다. Actions 러너에서 설치 단계가 필요 없다.
- 리조트별 함수는 서로 독립이다. 마크업이 바뀌면 그 함수만 고치면 된다.
- 결과에는 항상 `fetchedAt`(조회 시각, KST)과 `sourceDate`(사이트가 밝힌 기준일, 없으면 null)를
  같이 담는다. 지산·알펜시아처럼 사이트가 지난 시즌 값을 그대로 두는 곳이 있어
  "언제 기준 정보인지"를 화면에 표시하지 않으면 오늘 값으로 오해된다.
- 실패는 예외를 밖으로 던지지 않고 `status: "error"`로 담는다(한 곳이 죽어도 나머지는 수집).
"""
from __future__ import annotations

import argparse
import datetime as dt
import gzip
import json
import os
import re
import sys
import urllib.error
import urllib.request
from typing import Any

# ------------------------------------------------------------------ 공통 설정

# 리조트가 WAF/봇 판별에 UA 문자열을 쓰는 곳이 있다(지산: curl UA → 400, 엘리시안 API: curl UA → 403).
# Actions 기본 UA를 쓰지 말고 브라우저 UA를 넣는다.
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
TIMEOUT = 15  # 사이트별. Actions에서는 전체 60초 예산을 잡는 것을 권장.

# 엘리시안은 사이트 JS 번들에 박힌 공개 키가 필요하다. 번들이 바뀌면 이 값도 바뀔 수 있으므로
# 환경변수로 덮어쓸 수 있게 두고, 갱신 지점을 여기 한 곳으로 모은다.
ELYSIAN_API_KEY = os.environ.get("ELYSIAN_API_KEY", "7Ji067mE64OQIOuCmOyLnOuCmOuniA==")

KST = dt.timezone(dt.timedelta(hours=9))


def now_kst() -> dt.datetime:
    return dt.datetime.now(KST)


def today_kst() -> dt.date:
    return now_kst().date()


def get(url: str, *, data: bytes | None = None, headers: dict[str, str] | None = None) -> tuple[int, str]:
    """GET/POST 한 번. (status, body_text)를 돌려주고 HTTP 오류도 상태코드로 돌려준다."""
    h = {"User-Agent": UA, "Accept-Language": "ko,en;q=0.8"}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                raw = gzip.decompress(raw)
            charset = r.headers.get_content_charset() or "utf-8"
            return r.status, raw.decode(charset, "replace")
    except urllib.error.HTTPError as e:  # 400/403/404 등
        body = e.read().decode("utf-8", "replace")
        return e.code, body


def strip_tags(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).replace("&nbsp;", " ").strip()


def strip_comments(html: str) -> str:
    """HTML 주석을 지운다. 주석 안에 옛 운영시간·지난 시즌 일정이 남아 있는 사이트가 있어
    (용평 야간 18:30~22:00, 하이원 '운영시간: 주중 09:00~19:00') 먼저 걷어내야 옛 값을 줍지 않는다."""
    return re.sub(r"<!--.*?-->", "", html, flags=re.S)


def base(resort_id: str, name: str, source_url: str) -> dict[str, Any]:
    return {
        "id": resort_id,
        "name": name,
        "sourceUrl": source_url,
        "fetchedAt": now_kst().isoformat(timespec="seconds"),
        "sourceDate": None,   # 사이트가 밝힌 기준일 (없으면 null)
        "status": "ok",       # ok | partial | error
        "hours": [],          # [{"label": "주간", "value": "08:30~16:30"}]
        "slopes": [],         # [{"name": "핑크", "level": "초급", "day": "OPEN", "night": "CLOSE"}]
        "lifts": [],          # [{"name": "뉴레드", "day": "OPEN"}]
        "note": None,
        "error": None,
    }


# ------------------------------------------------------------------ 1. 모나용평
def yongpyong() -> dict[str, Any]:
    """SSR 표. 가장 깔끔한 케이스 — 표 제목에 서버가 만든 오늘 날짜가 찍힌다."""
    url = "https://yongpyong.co.kr/kor/skiNboard/slope/openStatusBoard.do"
    out = base("yongpyong", "모나용평", url)
    status, html = get(url)
    out["httpStatus"] = status
    if status != 200:
        out["status"] = "error"
        out["error"] = f"HTTP {status}"
        return out
    html = strip_comments(html)

    m = re.search(r"슬로프 오픈 현황 \((\d{4}-\d{2}-\d{2})\)", html)
    out["sourceDate"] = m.group(1) if m else None

    # 표 본문만 자른다. 표 밖에 "3월 슬로프 운영일정" 같은 시즌 문구가 함께 있어 전체 파싱은 위험.
    start = html.find('id="slopeStatus"')
    body = html[start : html.find("</tbody>", start)] if start >= 0 else ""

    for row in re.split(r"<tr>", body)[1:]:
        # 슬로프명: <td class=" conLeft"> 안. 골드파라다이스·블루·드래곤파크 3면은 마크업이 달라
        # 이름이 <a> 등으로 감싸여 오므로 태그를 걷어내고 첫 텍스트를 쓴다.
        cell = re.search(r'<td class=" conLeft">(.*?)</td>', row, re.S)
        if not cell:
            continue
        name = strip_tags(cell.group(1))
        name = re.sub(r"^(OPEN|CLOSE)\s*", "", name).strip()
        states = re.findall(r'<em class="ico (open|close)">(OPEN|CLOSE)</em>', row)
        if not name or not states:
            continue
        out["slopes"].append({
            "name": name,
            "day": states[0][1],
            "night": states[1][1] if len(states) > 1 else None,
        })

    # 발권가능시간: "<li><strong>[주간] Daytime</strong> 08:30 ~ 16:30</li>"
    for label, s, e in re.findall(
        r"\[(주간|오전|오후|야간|심야)\][^<]*</strong>\s*(\d{2}:\d{2})\s*[~∼]\s*(\d{2}:\d{2})", html
    ):
        item = {"label": label, "value": f"{s}~{e}"}
        if item not in out["hours"]:
            out["hours"].append(item)

    if not out["slopes"]:
        out["status"] = "partial"
        out["note"] = "표는 받았지만 슬로프 행을 찾지 못함(마크업 변경 의심)"
    return out


# ------------------------------------------------------------------ 2. 하이원
HIGH1_SLOPE = "https://www.high1.com/ski/slopeView.do?key=748&mode=p"
HIGH1_LIFT = "https://www.high1.com/ski/slopeView.do?key=749&mode=g"


def high1() -> dict[str, Any]:
    """SSR 표 2장(슬로프 + 리프트). 페이지에 '오늘 날짜'와 '운영시간'이 없다.

    운영시간은 HTML 주석(`<!-- <p>운영시간: 주중 09:00~19:00(정설없음)</p>-->`)으로만 남아 있어
    파싱해도 옛 값이다. 시간은 넣지 말고 OPEN/CLOSE만 쓰는 것이 정확하다.
    """
    out = base("high1", "하이원리조트", HIGH1_SLOPE)
    out["note"] = "페이지에 운영시간이 없어 슬로프·리프트 OPEN/CLOSE만 제공"

    # 슬로프 표: 그룹명이 rowspan 칸("<td rowspan=\"4\">제우스<br> (Zeus)</td>")에만 나오고
    # 번호(Ⅰ, Ⅲ-1)가 다음 칸. 이어지는 행에는 그룹 칸이 없으므로 직전 그룹명을 물려준다.
    # 리프트 표: "<th scope=\"row\" rowspan=\"6\">리프트</th><th scope=\"row\">주피터(JUPITER)</th>".
    CODE = re.compile(r"^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩA-Za-z0-9\-]{1,4}$")
    CELL = re.compile(r"<t([dh])([^>]*)>(.*?)</t\1>", re.S)

    def parse(url: str) -> tuple[int, list[dict[str, Any]]]:
        status, html = get(url)
        rows: list[dict[str, Any]] = []
        if status != 200:
            return status, rows
        group = ""
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", strip_comments(html), re.S):
            states = re.findall(r"<span class='slope_open (open|close)'>(OPEN|CLOSE)</span>", tr)
            if not states:
                continue
            cells = CELL.findall(tr)  # [(tag, attrs, inner), ...]
            state_at = [i for i, (_, _, inner) in enumerate(cells) if "slope_open" in inner]
            if not state_at:
                continue
            before = [strip_tags(inner) for _, _, inner in cells[: state_at[0]]]
            after = [strip_tags(inner) for _, _, inner in cells[state_at[-1] + 1 :]]

            if before and CODE.match(before[-1] or ""):
                # 슬로프 행: 마지막 칸이 번호. 그룹명은 바로 앞 칸(있을 때만)
                if len(before) >= 2:
                    group = before[-2].split("(")[0].strip()
                name = f"{group}{before[-1]}"
                level = after[0] if after else None
            else:
                # 리프트 행: ["리프트", "주피터(JUPITER)", "6", "950", "약4분", "초급"] 형태.
                # 첫 칸이 구분(리프트/케이블카)이면 두 번째 칸이 이름, 이어지는 행은 첫 칸이 이름.
                group_cell = before[0] if before else ""
                if group_cell in ("리프트", "케이블카", "구분"):
                    name = before[1] if len(before) > 1 else ""
                    group = group_cell
                else:
                    name = group_cell
                level = before[-1] if len(before) > 1 and before[-1] != name else None
            if not name:
                continue
            row: dict[str, Any] = {
                "name": name,
                "day": states[0][1],
                "night": states[1][1] if len(states) > 1 else None,
            }
            if level:
                row["level"] = level
            rows.append(row)
        return status, rows

    s1, slopes = parse(HIGH1_SLOPE)
    s2, lifts = parse(HIGH1_LIFT)
    out["httpStatus"] = [s1, s2]
    out["slopes"] = slopes
    out["lifts"] = lifts
    if s1 != 200 or s2 != 200:
        out["status"] = "partial" if slopes or lifts else "error"
        out["error"] = f"slope HTTP {s1} / lift HTTP {s2}"
    return out


# ------------------------------------------------------------------ 3. 지산
def jisan() -> dict[str, Any]:
    """SSR이지만 상태가 이미지 파일명. WAF가 UA를 본다(브라우저 UA 필수).

    현재 페이지에는 지난 시즌(폐장일) 운영안내가 걸려 있다 → sourceDate(안내 기준일)를 반드시 표시.
    """
    url = "https://www.jisanresort.co.kr/w/ski/slopes/info.asp"
    out = base("jisan", "지산리조트", url)
    status, html = get(url, headers={"Referer": "https://www.jisanresort.co.kr/w/ski/"})
    out["httpStatus"] = status
    if status != 200:
        out["status"] = "error"
        out["error"] = f"HTTP {status} (브라우저 UA 확인)"
        return out

    # 탭 제목이 곧 안내 기준일: "2026년 3월 1일 슬로프 운영안내"
    m = re.search(r'<li class="on">\s*<a[^>]*>([^<]*운영안내[^<]*)</a>', html)
    label = m.group(1).strip() if m else None
    if label:
        d = re.search(r"(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일", label)
        out["sourceDate"] = f"{d.group(1)}-{int(d.group(2)):02d}-{int(d.group(3)):02d}" if d else None
        out["note"] = f"안내 기준일: {label}"
    else:
        out["status"] = "partial"
        out["note"] = "운영안내 탭 제목을 찾지 못함"

    start = html.find('<table class="slope_table')
    table = html[start : html.find("</table>", start)] if start >= 0 else ""
    headers = [strip_tags(h) for h in re.findall(r"<th scope=\"col\"[^>]*>(.*?)</th>", table, re.S)]
    skip = ("구분", "초급", "중급", "상급", "최상급", "중상급")
    names = [h for h in headers if h and not h.startswith(skip)]

    for row in re.split(r"<tr>", table)[1:]:
        t = re.search(r'<td class="tit">\s*([^<]*)<br', row)
        if not t:
            continue
        slot = t.group(1).strip()
        states = []
        for src in re.findall(r"<td[^>]*>\s*<img src='([^']+)'", row):
            if "slope_open" in src:
                states.append("OPEN")
            elif "slope_ready" in src:
                states.append("READY")
            elif "slope_close" in src:
                states.append("CLOSE")
            else:
                states.append("?")
        for i, st in enumerate(states):
            if i >= len(names):
                break
            out["slopes"].append({"name": names[i], "slot": slot, "state": st})

    # 운영시간 고정 문구(예: 주중 09:00~17:00)
    for value in re.findall(r"(\d{2}:\d{2}\s*~\s*\d{2}:\d{2})", table):
        item = {"label": "운영시간", "value": value.replace(" ", "")}
        if item not in out["hours"]:
            out["hours"].append(item)
    return out


# ------------------------------------------------------------------ 4. 휘닉스 평창
def phoenix() -> dict[str, Any]:
    """내부 JSON API. 응답에 기준 날짜가 없어 fetchedAt으로 대신한다.

    주의: 공식 robots.txt가 `Disallow: /api/`. 굳이 쓸 경우 저빈도(30분 이상) + 캐시,
    가능하면 리조트 측에 문의하는 편이 맞다. CORS 헤더가 없어 브라우저 직접 호출은 불가
    → Actions가 대신 받아 정적 JSON으로 커밋하는 구조여야 한다.
    """
    url = "https://www.phoenixhnr.co.kr/api/snowpark/slope"
    out = base("phoenix", "휘닉스 평창", url)
    out["note"] = "응답에 기준 날짜 필드가 없음 → 조회 시각(fetchedAt) 표시"
    status, body = get(url, headers={"Accept": "application/json"})
    out["httpStatus"] = status
    if status != 200:
        out["status"] = "error"
        out["error"] = f"HTTP {status}"
        return out
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        out["status"] = "error"
        out["error"] = "JSON 아님(차단/개편 의심)"
        return out

    for d in data:
        # slopeOpenYn 필드 자체가 없으면 미운영(주간/야간 슬롯이 아예 등록되지 않은 상태)
        out["slopes"].append({
            "name": d.get("slopeNm"),
            "slot": d.get("slopeOpenDivNm"),
            "level": d.get("dfflyNm"),
            "state": "OPEN" if d.get("slopeOpenYn") == "Y" else "CLOSE",
            "hours": d.get("slopeOpenTime"),
        })
    for s in out["slopes"]:
        h = s.get("hours")
        if s["state"] == "OPEN" and h:
            item = {"label": f"{s.get('slot') or '운영'}", "value": h}
            if item not in out["hours"]:
                out["hours"].append(item)
    return out


# ------------------------------------------------------------------ 5. 엘리시안 강촌
def elysian() -> dict[str, Any]:
    """REST POST. 헤더 3종(브라우저 UA + Origin + x-api-key)이 모두 필요하다.

    응답 `data: []`(빈 배열)은 "전부 CLOSE"가 아니라 "아직 데이터 없음"이다.
    두 경우를 구분해 표시해야 하므로 rows=0이면 status="partial"로 내려보낸다.
    """
    url = "https://api.elysian.co.kr/api/v1/resort-Intro/slope-list"
    out = base("elysian", "엘리시안 강촌", url)
    out["sourceDate"] = today_kst().isoformat()  # 요청 날짜로 조회하는 구조
    payload = json.dumps({"ASLOPE_DATE": today_kst().isoformat()}).encode()
    status, body = get(url, data=payload, headers={
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json",
        "Origin": "https://www.elysian.co.kr",
        "Referer": "https://www.elysian.co.kr/",
        "x-api-key": ELYSIAN_API_KEY,
    })
    out["httpStatus"] = status
    if status != 200:
        out["status"] = "error"
        out["error"] = f"HTTP {status}: {body[:120]}"
        out["note"] = "403이면 UA/Origin/x-api-key 중 하나가 바뀐 것(키는 JS 번들에서 갱신)"
        return out
    try:
        j = json.loads(body)
    except json.JSONDecodeError:
        out["status"] = "error"
        out["error"] = "JSON 아님"
        return out

    rows = j.get("data") or []
    def on(v: Any) -> str:
        return "OPEN" if str(v) == "1" else "CLOSE"

    for r in rows:
        out["slopes"].append({
            "name": r.get("SLOPE"),
            "slot": r.get("DIVISION"),
            "day": on(r.get("WEEKLY")),
            "afternoon": on(r.get("AFTERNOON_A")),
            "night": on(r.get("NIGHT_TIME")),
            "lateNight": on(r.get("LATE_AT_NIGHT")),
            "dawn": on(r.get("EARLY_DAWN")),
        })
    if not rows:
        out["status"] = "partial"
        out["note"] = "응답 data가 빈 배열 — '전부 CLOSE'가 아니라 '26/27 정보 미입력'"
    return out


# ------------------------------------------------------------------ 6. 알펜시아
def alpensia() -> dict[str, Any]:
    """HTML에 박힌 JSON(슬로프별 오픈일~종료일). 오늘 상태는 우리가 계산한다.

    현재 값이 지난 시즌(2026-03-03 갱신)에 멈춰 있어 전부 CLOSE로 계산된다.
    관리자가 26/27로 갱신하기 전까지는 sourceDate를 화면에 크게 표시할 것.
    """
    url = "https://www.alpensia.com/ski/slope-now.do"
    out = base("alpensia", "알펜시아", url)
    status, html = get(url)
    out["httpStatus"] = status
    if status != 200:
        out["status"] = "error"
        out["error"] = f"HTTP {status}"
        return out

    m = re.search(r"var json = \$\.parseJSON\('(\[.*?\])'\);", html, re.S)
    if not m:
        out["status"] = "error"
        out["error"] = "내장 JSON을 찾지 못함(개편 의심)"
        return out
    raw = m.group(1).replace("\\'", "'")
    try:
        records = json.loads(raw)
    except json.JSONDecodeError as e:
        out["status"] = "error"
        out["error"] = f"내장 JSON 파싱 실패: {e}"
        return out

    updates = sorted({r.get("lastUpdusrPnttm") for r in records if r.get("lastUpdusrPnttm")})
    out["lastUpdate"] = updates
    out["sourceDate"] = updates[-1][:10] if updates else None

    per: dict[str, dict[str, dict[str, str]]] = {}
    for r in records:
        title = r.get("ski700ConditionStatusTitle") or ""
        parts = [p.strip() for p in title.split(" - ")]
        if len(parts) == 3 and parts[2] in ("오픈일", "종료일"):
            per.setdefault(parts[0], {}).setdefault(parts[1], {})[parts[2]] = r.get("ski700ConditionStatusData")

    today = today_kst().isoformat()
    for slope, slots in per.items():
        item: dict[str, Any] = {"name": slope}
        for slot, rng in slots.items():
            s, e = rng.get("오픈일"), rng.get("종료일")
            item[slot] = "OPEN" if (s and e and s <= today <= e) else "CLOSE"
            item[f"{slot}Range"] = f"{s}~{e}"
        out["slopes"].append(item)

    if updates and updates[-1][:10] < today:
        out["status"] = "stale"
        out["note"] = f"사이트 값이 {out['sourceDate']} 갱신 이후 그대로 — 지난 시즌 값일 수 있음"
    return out


# ------------------------------------------------------------------ 7. 웰리힐리 (제외)
def wellihilli() -> dict[str, Any]:
    """현재 수집 불가. 개장(12/4) 전후로 사이트가 정상화되면 다시 확인.

    2026-11-25 실측: Nuxt SPA, 본문 클라이언트 렌더링, 렌더용 청크 /_nuxt/9b28959.js 가 404.
    `window.__NUXT__`의 slopeStatus 슬롯 값도 전부 "N"(지난 시즌 중이던 스냅샷도 N)이라
    상태 필드로 신뢰할 수 없다.
    """
    out = base("wellihilli", "웰리힐리파크", "https://www.wellihillipark.com/snowpark/ski-school/schedule/open-slope")
    out["status"] = "skipped"
    out["note"] = "개발자 도구 접근 차단/사이트 미정상 → 별도 확인 예정(개장 후 재시도)"
    return out


RESORTS = {
    "yongpyong": yongpyong,
    "high1": high1,
    "jisan": jisan,
    "phoenix": phoenix,
    "elysian": elysian,
    "alpensia": alpensia,
    "wellihilli": wellihilli,  # skip 상태로만 출력
}


def main() -> int:
    ap = argparse.ArgumentParser(description="스키장 슬로프 현황 프로토타입 수집")
    ap.add_argument("resorts", nargs="*", help=f"수집할 리조트 id (기본: 웰리힐리 제외 전체) {list(RESORTS)}")
    ap.add_argument("--out", help="결과 JSON 저장 경로 (없으면 표준출력)")
    ap.add_argument("--compact", action="store_true", help="한 줄 JSON")
    args = ap.parse_args()

    ids = args.resorts or [k for k in RESORTS if k != "wellihilli"]
    result: dict[str, Any] = {
        "generatedAt": now_kst().isoformat(timespec="seconds"),
        "timezone": "Asia/Seoul",
        "resorts": [],
    }
    for rid in ids:
        fn = RESORTS.get(rid)
        if fn is None:
            print(f"알 수 없는 리조트: {rid} (가능: {list(RESORTS)})", file=sys.stderr)
            continue
        try:
            result["resorts"].append(fn())
        except Exception as e:  # 한 곳이 죽어도 나머지는 계속
            item = base(rid, rid, "")
            item["status"] = "error"
            item["error"] = f"{type(e).__name__}: {e}"
            result["resorts"].append(item)

    text = json.dumps(result, ensure_ascii=False, indent=None if args.compact else 1)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text + "\n")
        print(f"{args.out} 에 저장 ({len(result['resorts'])}곳)", file=sys.stderr)
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
