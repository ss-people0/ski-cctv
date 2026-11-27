#!/usr/bin/env python3
"""스키장 「오늘 슬로프 운영 현황」 수집기.

- 목적: GitHub Actions(파이썬 표준 라이브러리만 사용)에서 각 스키장의
  슬로프 OPEN/CLOSE + (있으면) 운영시간을 모아 `public/data/slopes.json`으로 저장한다.
- 웰리힐리파크·에덴밸리는 수집 불가 → `skipped`로만 남긴다(화면은 공식 코스 목록으로 형식을 갖춘다).
  웰리힐리: 개발자 도구 접근 차단(2026-11-25 실측, 개장 후 재확인).
  에덴밸리: 사이트 개편 중, 스키 페이지 본문 비어 있음(2026-11-27 실측).

사용법
    python3 scripts/collect_slopes.py                 # 웰리힐리를 뺀 전부
    python3 scripts/collect_slopes.py yongpyong jisan # 일부만
    python3 scripts/collect_slopes.py --out public/data/slopes.json

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
def parse_yongpyong_rows(body: str) -> list[dict[str, Any]]:
    """용평 표 행 → [{name, level, day, night}]. 공식 표 순서와 난이도 이름을 그대로 쓴다.

    - 난이도는 그룹 첫 행의 rowspan <th>에만 있어 다음 행들에 물려준다.
    - 그룹 첫 행은 이름 칸 class가 "lineBold conLeft"라서 " conLeft"만 찾으면 3면(골드파라다이스·블루·
      드래곤파크)을 놓친다(2026-11-26 발견) → class에 conLeft가 들어간 첫 <td>를 이름 칸으로 쓴다.
    """
    rows: list[dict[str, Any]] = []
    level = None
    for row in re.split(r"<tr[^>]*>", body)[1:]:
        th = re.search(r"<th[^>]*>(.*?)</th>", row, re.S)
        if th:
            level = strip_tags(th.group(1)) or level
        cell = re.search(r'<td class="[^"]*conLeft[^"]*">(.*?)</td>', row, re.S)
        states = re.findall(r'<em class="ico (open|close)">(OPEN|CLOSE)</em>', row)
        name = re.sub(r"^(OPEN|CLOSE)\s*", "", strip_tags(cell.group(1))).strip() if cell else ""
        if not name or not states:
            continue
        rows.append({
            "name": name,
            "level": level,
            "day": states[0][1],
            "night": states[1][1] if len(states) > 1 else None,
        })
    return rows


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

    out["slopes"] = parse_yongpyong_rows(body)

    # 주간은 사이트 실시간 값을 쓴다(성수기 09:00→08:30 자동 반영). 오전/오후 세분은 글랜스엔 과해서 뺀다.
    # "<li><strong>[주간] Daytime</strong> 08:30 ~ 16:30</li>"
    for label, s, e in re.findall(
        r"\[(주간)\][^<]*</strong>\s*(\d{2}:\d{2})\s*[~∼]\s*(\d{2}:\d{2})", html
    ):
        item = {"label": label, "value": f"{s}~{e}"}
        if item not in out["hours"]:
            out["hours"].append(item)
    # 사이트가 안 주는 정설·야간은 공식 공지 기준으로 고정한다(시즌마다 거의 안 바뀜). 바뀌면 여기만 고친다.
    out["hours"] += [
        {"label": "정설", "value": "16:30~18:00"},
        {"label": "야간", "value": "19:00~23:00"},
    ]
    # 야간 슬로프가 하나라도 열렸는지(평일 미운영·주말 운영이 섞여 매일 달라짐).
    out["nightOpen"] = any(s.get("night") == "OPEN" for s in out["slopes"])

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
    # 페이지에 운영시간이 없어(주석 처리된 옛 값뿐) 공식 이용요금 안내 기준으로 고정한다.
    # 주간 09:00~16:00 · 정설(슬로프 정비) 16:00~18:00 · 야간 18:00~22:00(12/4~).
    # 스키장 운영시간은 시즌마다 거의 안 바뀌므로 고정값으로 둔다. 바뀌면 여기만 고친다.
    out["hours"] = [
        {"label": "주간", "value": "09:00~16:00"},
        {"label": "정설", "value": "16:00~18:00"},
        {"label": "야간", "value": "18:00~22:00"},
    ]
    out["note"] = "운영시간은 공식 이용요금 안내 기준(고정). 슬로프·리프트 OPEN/CLOSE는 실시간."

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
    out["nightOpen"] = any(s.get("night") == "OPEN" for s in slopes)
    if s1 != 200 or s2 != 200:
        out["status"] = "partial" if slopes or lifts else "error"
        out["error"] = f"slope HTTP {s1} / lift HTTP {s2}"
    return out


# ------------------------------------------------------------------ 3. 지산
JISAN_HEADER_SKIP = ("구분", "초급", "중급", "상급", "최상급", "중상급")


def jisan_slope_name(raw: str) -> str:
    """지산 표의 '1-1'은 하이픈이 코스 구분처럼 보여 화면에서는 가운뎃점으로 쓴다(1·1).

    같은 이름을 cams.ts slopeCatalog와 맞춰 두어야 수집값과 고정 목록이 한 슬로프로 묶인다.
    """
    return raw.replace("-", "·")


def parse_jisan_slopes(table: str) -> list[dict[str, Any]]:
    """지산 슬로프 표 → [{name, slot, state, level}].

    첫 머리글 줄이 코스 이름, 둘째 줄(class="colorN")이 코스별 난이도다.
    난이도는 같은 표에서 바로 읽으므로 따로 손으로 관리하지 않는다.
    """
    headers = [strip_tags(h) for h in re.findall(r'<th scope="col"[^>]*>(.*?)</th>', table, re.S)]
    names = [jisan_slope_name(h) for h in headers if h and not h.startswith(JISAN_HEADER_SKIP)]
    levels = [strip_tags(v) for v in re.findall(r'<th scope="col" class="color\d+"[^>]*>(.*?)</th>', table, re.S)]

    rows: list[dict[str, Any]] = []
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
            item: dict[str, Any] = {"name": names[i], "slot": slot, "state": st}
            if i < len(levels) and levels[i]:
                item["level"] = levels[i]
            rows.append(item)
    return rows


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
    out["slopes"] = parse_jisan_slopes(table)

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
    # 응답의 slopeOpenTime 대신, 사이트가 안 주는 정설·야간까지 공식 공지 기준으로 고정한다.
    # 주간 09:00~16:00 · 정설 16:00~18:00 · 야간 18:00~22:00. 시즌마다 거의 안 바뀜. 바뀌면 여기만 고친다.
    out["hours"] = [
        {"label": "주간", "value": "09:00~16:00"},
        {"label": "정설", "value": "16:00~18:00"},
        {"label": "야간", "value": "18:00~22:00"},
    ]
    # 야간 슬롯(slot) 슬로프가 열렸는지로 야간 운영 여부를 판단한다.
    out["nightOpen"] = any("야간" in (s.get("slot") or "") and s.get("state") == "OPEN" for s in out["slopes"])
    return out


# ------------------------------------------------------------------ 5. 엘리시안 강촌
def elysian() -> dict[str, Any]:
    """REST POST. 헤더 3종(브라우저 UA + Origin + x-api-key)이 모두 필요하다.

    응답 `data: []`(빈 배열)은 "전부 CLOSE"가 아니라 "아직 데이터 없음"이다.
    두 경우를 구분해 표시해야 하므로 rows=0이면 status="partial"로 내려보낸다.
    """
    url = "https://api.elysian.co.kr/api/v1/resort-Intro/slope-list"
    out = base("gangchon", "엘리시안 강촌", url)
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
SLOT_KEY = {"주간": "day", "야간": "night"}  # 화면 공통 필드명


def parse_alpensia_records(records: list[dict[str, Any]], today: str) -> list[dict[str, Any]]:
    """내장 JSON → 슬로프별 {name, level, 주간/야간 OPEN·CLOSE(오픈~종료일 기준), day, night}.

    "알파 - 난이도" 레코드가 공식 난이도다. 난이도가 "-"인 항목(눈썰매장)은 슬로프가 아니라 뺀다.
    """
    per: dict[str, dict[str, Any]] = {}
    for r in records:
        parts = [p.strip() for p in (r.get("ski700ConditionStatusTitle") or "").split(" - ")]
        data = r.get("ski700ConditionStatusData")
        if len(parts) == 2 and parts[1] == "난이도" and parts[0] != "구분":
            per.setdefault(parts[0], {"slots": {}})["level"] = data
        elif len(parts) == 3 and parts[2] in ("오픈일", "종료일"):
            per.setdefault(parts[0], {"slots": {}})["slots"].setdefault(parts[1], {})[parts[2]] = data

    slopes = []
    for name, info in per.items():
        if info.get("level") == "-":
            continue
        item: dict[str, Any] = {"name": name, "level": info.get("level")}
        for slot, rng in info["slots"].items():
            s, e = rng.get("오픈일"), rng.get("종료일")
            item[slot] = "OPEN" if (s and e and s <= today <= e) else "CLOSE"
            item[f"{slot}Range"] = f"{s}~{e}"
        for slot, key in SLOT_KEY.items():
            if slot in item:
                item[key] = item[slot]
        slopes.append(item)
    return slopes


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

    today = today_kst().isoformat()
    out["slopes"] = parse_alpensia_records(records, today)

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


# ------------------------------------------------------------------ 8. 비발디파크
VIVALDI_PAGE = "https://sonolc.sonohotelsresorts.com/daemyung.vp.skiworld.04_02_04.ds/dmparse.dm"
VIVALDI_API = "https://sonolc.sonohotelsresorts.com/front.subMainAjax.getSlopeConditionAjax.dp/dmparse.dm"


def parse_vivaldi_rows(data: dict[str, Any]) -> list[dict[str, Any]]:
    """스키장 상황 JSON → [{name, level, day, night}].

    응답 list에는 오늘 값이 아직 입력되지 않으면 daytimeYn/nightYn/dawnYn이 모두 null로 온다
    (사이트도 그때는 CLOSE 아이콘을 그린다). null은 '미개방'이 아니라 '모름'이므로 상태를 넣지 않는다.
    """
    def state(v: Any) -> str | None:
        return {"Y": "OPEN", "N": "CLOSE"}.get(str(v))

    rows: list[dict[str, Any]] = []
    for d in data.get("list") or []:
        name = (d.get("slopeNm") or "").strip()
        if not name:
            continue
        row: dict[str, Any] = {"name": name}
        if d.get("slopeGrade"):
            row["level"] = d["slopeGrade"]
        if state(d.get("daytimeYn")):
            row["day"] = state(d.get("daytimeYn"))
        if state(d.get("nightYn")):
            row["night"] = state(d.get("nightYn"))
        # 밤샘/새벽만 여는 날은 상태 칸이 하나뿐이라 state로 넘긴다(개방으로 보이게).
        if state(d.get("dawnYn")) == "OPEN" and row.get("night") != "OPEN":
            row["state"] = "OPEN"
        rows.append(row)
    return rows


def vivaldi() -> dict[str, Any]:
    """구 소노 '스키장 상황' AJAX(JSON). 슬로프 이름·난이도는 항상 오지만 개방 값은 비어 있을 때가 있다.

    신형 사이트(Nuxt)는 오늘 운영 시간대만 보여 주고 슬로프별 개방 값은 이 구 시스템에서만 준다.
    """
    out = base("vivaldi", "비발디파크", VIVALDI_PAGE)
    status, body = get(VIVALDI_API, headers={
        "Referer": VIVALDI_PAGE,
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json",
    })
    out["httpStatus"] = status
    if status != 200:
        out["status"] = "error"
        out["error"] = f"HTTP {status}"
        return out
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        out["status"] = "error"
        out["error"] = "JSON 아님(개편 의심)"
        return out

    out["slopes"] = parse_vivaldi_rows(data)
    out["nightOpen"] = any(s.get("night") == "OPEN" for s in out["slopes"])
    if not out["slopes"]:
        out["status"] = "partial"
        out["note"] = "슬로프 목록이 비어 있음(개편 의심)"
    elif not any(k in s for s in out["slopes"] for k in ("day", "night", "state")):
        out["status"] = "partial"
        out["note"] = "공식 스키장 상황에 오늘 개방 값이 입력되지 않음(사이트도 CLOSE 표시)"
    return out


# ------------------------------------------------------------------ 9. 무주덕유산리조트
MUJU_POPUP = "https://www.mdysresort.com/convert_main_slope_221207.asp"
MUJU_LEVEL = {"초급자용": "초급", "중급자용": "중급", "상급자용": "상급", "최상급자용": "최상급"}


def muju_slope_name(raw: str) -> str:
    """'스피츠하단' → '스피츠 하단'. 상세 화면·slopeCatalog와 이름을 맞춰야 칩이 한 슬로프로 묶인다."""
    name = re.sub(r"\s+", " ", raw).strip()
    if name.endswith(("상단", "하단")) and not name.endswith((" 상단", " 하단")):
        name = f"{name[:-2]} {name[-2:]}"
    return name


def parse_muju_courses(html: str) -> list[dict[str, Any]]:
    """오픈슬로프 popup의 코스 목록 → [{name, level, day, night}].

    코스마다 `<p>이름</p><ul class="color_check">` 아래 칸이 5개(새벽·오전·오후·야간·자정)이고
    열린 칸에만 class="on"이 붙는다. 난이도는 코스 앞 HTML 주석('<!-- 초급자용 코스(...) -->')에 있다.
    """
    start = html.find('<div class="course_list">')
    if start < 0:
        return []
    end = html.find('<section class="schedule">', start)
    seg = html[start : end if end > start else len(html)]
    rows: list[dict[str, Any]] = []
    level = None
    # 난이도 주석과 코스 한 칸을 문서 순서대로 한 번에 찾는다(칸 안의 주석 때문에 잘라서 보면 안 된다).
    pattern = re.compile(
        r'<!--\s*(초급자용|중급자용|상급자용|최상급자용)\s*코스|<p>([^<]+)</p>\s*<ul class="color_check">(.*?)</ul>',
        re.S,
    )
    for m in pattern.finditer(seg):
        if m.group(1):
            level = MUJU_LEVEL[m.group(1)]
            continue
        cells = re.findall(r"<li([^>]*)>", m.group(3))
        on = ['class="on"' in c for c in cells]
        row: dict[str, Any] = {"name": muju_slope_name(m.group(2))}
        if level:
            row["level"] = level
        if len(on) >= 5:
            row["day"] = "OPEN" if (on[1] or on[2]) else "CLOSE"
            row["night"] = "OPEN" if on[3] else "CLOSE"
        rows.append(row)
    return rows


def muju() -> dict[str, Any]:
    """SSR popup. `n_date`로 그날 운영표를 보여 주고, 화면에 기준일이 그대로 찍힌다."""
    date = today_kst().isoformat()
    url = f"{MUJU_POPUP}?g=S&n_date={date}"
    out = base("muju", "무주 덕유산", url)
    status, html = get(url)
    out["httpStatus"] = status
    if status != 200:
        out["status"] = "error"
        out["error"] = f"HTTP {status}"
        return out

    m = re.search(r'<p class="day_txt">\s*(\d{4}-\d{2}-\d{2})', html)
    out["sourceDate"] = m.group(1) if m else None
    out["slopes"] = parse_muju_courses(html)
    out["nightOpen"] = any(s.get("night") == "OPEN" for s in out["slopes"])
    if not out["slopes"]:
        out["status"] = "partial"
        out["note"] = "코스 목록을 찾지 못함(마크업 변경 의심)"
    return out


# ------------------------------------------------------------------ 10. 오투리조트
O2_STATUS = "https://o2resort.com/SKI/slopeOpen.jsp"


def o2_slope_name(raw: str) -> str:
    """'드림1 (DREAM1)' → '드림1'. slopeCatalog와 같은 이름으로 맞춘다."""
    return re.sub(r"\s*\([^)]*\)\s*$", "", raw).strip()


def parse_o2_rows(html: str) -> list[dict[str, Any]]:
    """왼쪽 제원 표(이름·난이도)와 오른쪽 오픈현황 표(주간·야간 아이콘)를 순서대로 짝지어 읽는다.

    오른쪽 표는 왼쪽 표와 같은 순서이고, 슬로프 12면 뒤에 부대시설 3칸이 더 있다 → 앞 12칸만 쓴다.
    """
    i = html.find("skiLeftBox")
    if i < 0:
        return []
    left = html[i : html.find("</table>", i)]
    names: list[tuple[str, str | None]] = []
    level = None
    for attrs, row in re.findall(r"<tr([^>]*)>(.*?)</tr>", left, re.S)[1:]:
        if "slopeFacil" in attrs or "slopeFacil" in row:  # 하프파이프·눈썰매장·익스트림파크
            continue
        cells = [strip_tags(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)]
        if not cells or cells[0].startswith("슬로프"):
            continue
        if cells[0] in ("초급", "중급", "상급", "최상급"):
            level = cells[0]
            cells = cells[1:]
        if len(cells) < 2:
            continue
        name = o2_slope_name(cells[1])
        if name:
            names.append((name, level))

    j = html.find("skiRightBox")
    status_rows = re.findall(r"<tr[^>]*>(.*?)</tr>", html[j : html.find("</table>", j)], re.S)[2:] if j >= 0 else []

    rows: list[dict[str, Any]] = []
    for k, (name, level) in enumerate(names):
        row: dict[str, Any] = {"name": name}
        if level:
            row["level"] = level
        if k < len(status_rows):
            states = re.findall(r"icon_slope_(open|closed)\.jpg", status_rows[k])
            if states:
                row["day"] = "OPEN" if states[0] == "open" else "CLOSE"
                if len(states) > 1:
                    row["night"] = "OPEN" if states[1] == "open" else "CLOSE"
        rows.append(row)
    return rows


def o2() -> dict[str, Any]:
    """SSR 표 2장. 페이지에 기준일이 없어 fetchedAt으로 대신한다."""
    out = base("o2", "오투", O2_STATUS)
    status, html = get(O2_STATUS)
    out["httpStatus"] = status
    if status != 200:
        out["status"] = "error"
        out["error"] = f"HTTP {status}"
        return out
    html = strip_comments(html)
    out["slopes"] = parse_o2_rows(html)
    out["nightOpen"] = any(s.get("night") == "OPEN" for s in out["slopes"])
    if not out["slopes"]:
        out["status"] = "partial"
        out["note"] = "슬로프 표를 찾지 못함(마크업 변경 의심)"
    return out


# ------------------------------------------------------------------ 11. 곤지암리조트
KONJIAM_STATUS = "https://www.konjiamresort.co.kr/ski/slopeOpenClose.dev"
# 사이트가 옛 이름을 괄호로 붙여 쓴다('씽큐 1 (구 제타)') → 우리 목록 이름으로 되돌린다.
KONJIAM_NAMES = {
    "그램(구 하늬)": "그램",
    "익시오(구 휘슬)": "익시오",
    "씽큐 1 (구 제타)": "씽큐1",
    "씽큐 2 (구 제타)": "씽큐2",
    "홈봇 1/2(구 윈디)": "홈봇 1/2",
    "홈봇 3(구 윈디)": "홈봇 3",
    "홈봇 4(구 윈디)": "홈봇 4",
    "CNP 1(구 게일)": "CNP 1",
    "CNP 2(구 게일)": "CNP 2",
}


def konjiam_slope_name(raw: str) -> str:
    if raw in KONJIAM_NAMES:
        return KONJIAM_NAMES[raw]
    return re.sub(r"\s+", " ", re.sub(r"\s*\([^)]*\)\s*$", "", raw)).strip()


def parse_konjiam_rows(html: str) -> list[dict[str, Any]]:
    """슬로프현황 표 → [{name, level, day, night}]. 칸 순서는 주간·야간·백야이고 값은 Open/Close 글자다.

    백야만 열린 날도 개방으로 보이도록 night에 합친다(야간 칸과 백야 칸 중 하나라도 Open).
    """
    i = html.find('<table class="chart-a1">')
    if i < 0:
        return []
    table = html[i : html.find("</table>", i)]
    rows: list[dict[str, Any]] = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S):
        m = re.search(r'<span class="slope-[a-z]+">([^<]+)</span>', tr)
        if not m:
            continue
        cells = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
        states = re.findall(r'<td class="(open|close)"[^>]*>', tr)
        row: dict[str, Any] = {"name": konjiam_slope_name(m.group(1))}
        level = strip_tags(cells[1]).replace("/", "") if len(cells) > 1 else ""
        if level:
            row["level"] = level
        if len(states) >= 2:
            row["day"] = "OPEN" if states[0] == "open" else "CLOSE"
            night = states[1] == "open" or (len(states) > 2 and states[2] == "open")
            row["night"] = "OPEN" if night else "CLOSE"
        rows.append(row)
    return rows


def konjiam() -> dict[str, Any]:
    """SSR 표. PC 사이트의 '슬로프/리프트 현황'(slopeOpenClose.dev). 기준일 표기는 없다."""
    out = base("konjiam", "곤지암", KONJIAM_STATUS)
    status, html = get(KONJIAM_STATUS)
    out["httpStatus"] = status
    if status != 200:
        out["status"] = "error"
        out["error"] = f"HTTP {status}"
        return out
    html = strip_comments(html)
    out["slopes"] = parse_konjiam_rows(html)
    out["nightOpen"] = any(s.get("night") == "OPEN" for s in out["slopes"])
    if not out["slopes"]:
        out["status"] = "partial"
        out["note"] = "슬로프 표를 찾지 못함(마크업 변경 의심)"
    return out


# ------------------------------------------------------------------ 12. 오크밸리
OAK_API = "https://api.oakvalley.co.kr/api/v1/skis/slopes"
# 26/27 운영 코스는 I·F·G 3면(+I-1 퍼니런파크·D 게이트). API에는 옛 코스 A·B도 남아 있어 3면만 쓴다.
OAK_SLOPES = ("I", "F", "G")
OAK_SEASON_START = dt.date(2026, 12, 11)  # 공식 26/27 개장일


def parse_oakvalley(data: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for group in (data.get("data") or {}).get("groups") or []:
        level = group.get("levelCategoryValue") or None
        for item in group.get("items") or []:
            name = (item.get("name") or "").strip()
            if name not in OAK_SLOPES:
                continue
            row: dict[str, Any] = {"name": name, "day": "OPEN" if item.get("open") else "CLOSE"}
            if level:
                row["level"] = level
            rows.append(row)
    return rows


def oakvalley() -> dict[str, Any]:
    """SPA가 쓰는 공개 JSON API. 개장 전에는 지난 시즌 값(전 코스 open=true)이 그대로 남아 있다."""
    out = base("oakvalley", "오크밸리", OAK_API)
    status, body = get(OAK_API, headers={
        "Origin": "https://oakvalley.co.kr",
        "Referer": "https://oakvalley.co.kr/",
        "Accept": "application/json",
    })
    out["httpStatus"] = status
    if status != 200:
        out["status"] = "error"
        out["error"] = f"HTTP {status}"
        return out
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        out["status"] = "error"
        out["error"] = "JSON 아님(개편 의심)"
        return out

    out["slopes"] = parse_oakvalley(data)
    if today_kst() < OAK_SEASON_START:
        # 개장 전에는 API가 지난 시즌 기본값(개방)을 그대로 준다 → 화면에서 '개장 전 → 전부 미개방'으로 보이게 stale.
        out["status"] = "stale"
        out["note"] = f"개장 전({OAK_SEASON_START.isoformat()}) — API 값은 지난 시즌 기본값"
    elif not out["slopes"]:
        out["status"] = "partial"
        out["note"] = "슬로프 목록을 찾지 못함(개편 의심)"
    return out


# ------------------------------------------------------------------ 13. 에덴밸리 (제외)
def edenvalley() -> dict[str, Any]:
    """수집 불가. 공식 사이트(edenvalley.co.kr)가 골프 사이트로 넘어가고, 스키 페이지 본문이 비어 있다.

    2026-11-27 확인: 메인은 golf.edenvalley.co.kr로 리다이렉트, 스키 요금·학교 페이지는 '개편 중'으로
    본문이 없고, 슬로프·리프트 개방 현황 페이지 자체가 없다. 개장(12월 중순) 뒤 다시 확인.
    """
    out = base("edenvalley", "에덴밸리", "https://www.edenvalley.co.kr/")
    out["status"] = "skipped"
    out["note"] = "사이트 개편 중 — 스키 페이지 본문이 비어 있고 슬로프 현황 페이지가 없음(개장 후 재확인)"
    return out


RESORTS = {
    "yongpyong": yongpyong,
    "high1": high1,
    "jisan": jisan,
    "phoenix": phoenix,
    "gangchon": elysian,
    "alpensia": alpensia,
    "wellihilli": wellihilli,  # skip 상태로만 출력
    "vivaldi": vivaldi,
    "muju": muju,
    "o2": o2,
    "konjiam": konjiam,
    "oakvalley": oakvalley,
    "edenvalley": edenvalley,  # skip 상태로만 출력
}


def keep_uncollected(collected: list[dict[str, Any]], previous_path: str) -> list[dict[str, Any]]:
    """이번에 안 모은 리조트(휘팍은 하루 3회만 모음)는 기존 파일 값을 남겨 화면에서 사라지지 않게 한다."""
    try:
        with open(previous_path, encoding="utf-8") as f:
            previous = json.load(f).get("resorts", [])
    except (OSError, ValueError) as e:
        print(f"기존 파일을 못 읽어 새 값만 저장: {e}", file=sys.stderr)
        return collected
    ids = {r["id"] for r in collected}
    kept = [r for r in previous if isinstance(r, dict) and r.get("id") not in ids]
    order = list(RESORTS)
    # 실행마다 모으는 곳이 달라도 파일 속 순서가 같게 유지한다.
    return sorted(collected + kept, key=lambda r: order.index(r["id"]) if r["id"] in order else len(order))


# 한 번 연 슬로프는 시즌 내내 열려 있다 → 시즌 중엔 사이트의 일시적 CLOSE·수집 실패로 화면이 흔들리지 않게 개방을 유지한다.
# 3월부터는 슬로프가 하나씩 닫히므로 실시간 그대로. 야간은 요일마다 달라 실시간 그대로.
STICKY_MONTHS = {11, 12, 1, 2}
SAME_SEASON_DAYS = 7  # 화면(slopeStatus.ts)과 같은 기준: 이보다 오래된 기준일은 지난 시즌 값


def _is_this_season(entry: dict[str, Any], today: dt.date) -> bool:
    if entry.get("status") not in ("ok", "partial") or not entry.get("slopes"):
        return False
    source = entry.get("sourceDate")
    return source is None or (today - dt.date.fromisoformat(source)).days <= SAME_SEASON_DAYS


def _keep_day_open(row: dict[str, Any], prev_rows: dict[tuple, dict[str, Any]]) -> dict[str, Any]:
    prev = prev_rows.get((row.get("name"), row.get("slot")))
    if not prev:
        return row
    kept = {**row}
    if prev.get("day") == "OPEN":
        kept["day"] = "OPEN"
    if prev.get("state") == "OPEN" and "야간" not in (row.get("slot") or ""):
        kept["state"] = "OPEN"
    return kept


def stick_open(new: dict[str, Any], prev: dict[str, Any] | None, today: dt.date) -> dict[str, Any]:
    """시즌 중(STICKY_MONTHS)엔 지난 수집에서 연 주간 슬로프를 개방으로 유지하고, 수집이 실패하면 지난 값을 그대로 둔다."""
    if today.month not in STICKY_MONTHS or prev is None or not _is_this_season(prev, today):
        return new
    if new.get("status") in ("error", "skipped") or not new.get("slopes"):
        return prev
    prev_rows = {(r.get("name"), r.get("slot")): r for r in prev["slopes"]}
    return {**new, "slopes": [_keep_day_open(r, prev_rows) for r in new["slopes"]]}


def read_previous(path: str) -> dict[str, dict[str, Any]]:
    try:
        with open(path, encoding="utf-8") as f:
            return {r["id"]: r for r in json.load(f).get("resorts", []) if isinstance(r, dict) and "id" in r}
    except (OSError, ValueError):
        return {}  # 없거나 깨졌으면 keep_uncollected가 이유를 출력한다


def main() -> int:
    ap = argparse.ArgumentParser(description="스키장 슬로프 현황 프로토타입 수집")
    ap.add_argument("resorts", nargs="*", help=f"수집할 리조트 id (기본: 웰리힐리 제외 전체) {list(RESORTS)}")
    ap.add_argument("--out", help="결과 JSON 저장 경로 (없으면 표준출력). 이번에 안 모은 리조트는 기존 값 유지")
    ap.add_argument("--exclude", nargs="*", default=[], help="이번에 뺄 리조트 id (예: phoenix)")
    ap.add_argument("--compact", action="store_true", help="한 줄 JSON")
    args = ap.parse_args()

    ids = [k for k in (args.resorts or [k for k in RESORTS if k != "wellihilli"]) if k not in args.exclude]
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

    if args.out:
        previous = read_previous(args.out)
        today = today_kst()
        result["resorts"] = [stick_open(r, previous.get(r["id"]), today) for r in result["resorts"]]
        result["resorts"] = keep_uncollected(result["resorts"], args.out)
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
