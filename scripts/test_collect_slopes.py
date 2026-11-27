"""python3 -m unittest discover scripts"""
import json
import os
import tempfile
import unittest

import datetime as dt

from collect_slopes import (
    keep_uncollected,
    konjiam_slope_name,
    muju_slope_name,
    o2_slope_name,
    parse_alpensia_records,
    parse_jisan_slopes,
    parse_konjiam_rows,
    parse_muju_courses,
    parse_o2_rows,
    parse_oakvalley,
    parse_vivaldi_rows,
    parse_yongpyong_hours,
    parse_yongpyong_rows,
    stick_open,
)


class ParseAlpensiaRecordsTest(unittest.TestCase):
    def test_reads_official_level_and_day_night_state_and_skips_sled_area(self):
        rec = lambda title, data: {"ski700ConditionStatusTitle": title, "ski700ConditionStatusData": data}
        records = [
            rec("구분 - 난이도 - 주간", "주간\\n(09:00 ~ 17:00)"),
            rec("알파 - 난이도", "초급"),
            rec("알파 - 주간 - 오픈일", "2026-11-20"),
            rec("알파 - 주간 - 종료일", "2027-03-01"),
            rec("알파 - 야간 - 오픈일", "2026-12-20"),
            rec("알파 - 야간 - 종료일", "2027-02-17"),
            rec("눈썰매장 - 난이도", "-"),
            rec("눈썰매장 - 주간 - 오픈일", "2026-11-20"),
            rec("눈썰매장 - 주간 - 종료일", "2027-03-01"),
        ]
        self.assertEqual(parse_alpensia_records(records, "2026-11-26"), [{
            "name": "알파", "level": "초급",
            "주간": "OPEN", "주간Range": "2026-11-20~2027-03-01",
            "야간": "CLOSE", "야간Range": "2026-12-20~2027-02-17",
            "day": "OPEN", "night": "CLOSE",
        }])

# 용평 공식 표 구조(2026-11-26) 축약: 난이도는 rowspan th에만 있고, 그룹 첫 행은 class에 lineBold가 붙는다.
YONGPYONG_TABLE = """
<tbody id="slopeStatus">
<tr>
  <th scope="row" rowspan="2" class=" brln conLeft"> <em class="ico beginners"></em> 초급</th>
  <td class=" conLeft"><em class="ico yellow"></em>옐로우</td>
  <td class=""><em class="ico close">CLOSE</em> </td><td class=""><em class="ico close">CLOSE</em> </td><td class=""></td>
</tr>
<tr>
  <td class=" conLeft"><em class="ico yellow"></em>뉴옐로우</td>
  <td class=""><em class="ico open">OPEN</em> </td><td class=""><em class="ico close">CLOSE</em> </td><td class=""></td>
</tr>
<tr>
  <th scope="row" rowspan="1" class="lineBold brln conLeft"> <em class="ico intermediate"></em> 중급</th>
  <td class="lineBold conLeft"><em class="ico gold"></em>골드파라다이스</td>
  <td class="lineBold"><em class="ico close">CLOSE</em> </td><td class="lineBold"><em class="ico open">OPEN</em> </td><td class="lineBold">미운영</td>
</tr>
<tr>
  <th scope="row" rowspan="1" class="lineBold brln conLeft"> <em class="ico extreme"></em> 익스트림</th>
  <td class="lineBold conLeft"><em class="ico purple"></em>드래곤파크</td>
  <td class="lineBold"><em class="ico close">CLOSE</em> </td><td class="lineBold"><em class="ico close">CLOSE</em> </td><td class="lineBold"></td>
</tr>
</tbody>
"""


class ParseYongpyongRowsTest(unittest.TestCase):
    def test_reads_every_slope_with_its_official_level_including_bold_group_rows(self):
        rows = parse_yongpyong_rows(YONGPYONG_TABLE)
        self.assertEqual(rows, [
            {"name": "옐로우", "level": "초급", "day": "CLOSE", "night": "CLOSE"},
            {"name": "뉴옐로우", "level": "초급", "day": "OPEN", "night": "CLOSE"},
            {"name": "골드파라다이스", "level": "중급", "day": "CLOSE", "night": "OPEN"},
            {"name": "드래곤파크", "level": "익스트림", "day": "CLOSE", "night": "CLOSE"},
        ])


class ParseYongpyongHoursTest(unittest.TestCase):
    """용평 운영시간은 슬로프 표 머리글에서 읽는다(발권가능시간 아님)."""

    def test_reads_day_hours_from_table_header_and_ignores_ticketing_hours(self):
        html = """
        <table><thead>
        <tr><th scope="col">주간</th><th scope="col">야간</th></tr>
        <tr><th scope="col"> 08:30~16:30</th><th scope="col"> </th></tr>
        </thead><tbody id="slopeStatus"></tbody></table>
        <li><strong>[주간] Daytime</strong> 08:00 ~ 16:00</li>
        """
        self.assertEqual(parse_yongpyong_hours(html), [
            {"label": "주간", "value": "08:30~16:30"},
            {"label": "정설", "value": "16:30~18:00"},
            {"label": "야간", "value": "18:00~22:00"},
        ])

    def test_uses_the_night_hours_once_the_table_shows_them(self):
        html = """
        <table><thead>
        <tr><th scope="col">주간</th><th scope="col">야간</th></tr>
        <tr><th scope="col"> 08:30~16:30</th><th scope="col"> 18:30~22:00</th></tr>
        </thead><tbody id="slopeStatus"></tbody></table>
        """
        self.assertEqual(parse_yongpyong_hours(html)[2], {"label": "야간", "value": "18:30~22:00"})

    def test_falls_back_to_official_26_27_hours_when_the_header_has_no_time(self):
        self.assertEqual(parse_yongpyong_hours("<tbody id=\"slopeStatus\"></tbody>"), [
            {"label": "주간", "value": "08:30~16:30"},
            {"label": "정설", "value": "16:30~18:00"},
            {"label": "야간", "value": "18:00~22:00"},
        ])


class ParseJisanSlopesTest(unittest.TestCase):
    """지산 표: 코스 이름은 첫 머리글 줄, 난이도는 둘째 줄(class=colorN)에서 읽고, '1-1'은 '1·1'로 쓴다."""

    TABLE = """
<table class="slope_table">
<thead>
<tr>
  <th scope="col" class="tit" rowspan="2">구분</th>
  <th scope="col">1-1</th>
  <th scope="col">2</th>
  <th scope="col" class="txt">3(어린이 전용)</th>
</tr>
<tr class="bg_white">
  <th scope="col" class="color1"><span>초급</span></th>
  <th scope="col" class="color2"><span>중급</span></th>
  <th scope="col" class="color2"><span>중급</span></th>
</tr>
</thead>
<tbody>
<tr>
  <td class="tit">주간<br/>(09:00~17:00)</td>
  <td><img src='../../asset/images/sub/ski/slope_open.png' alt=''></td>
  <td><img src='../../asset/images/sub/ski/slope_close.png' alt=''></td>
  <td><img src='../../asset/images/sub/ski/slope_close.png' alt=''></td>
</tr>
<tr>
  <td class="tit">야간<br/>(18:30~24:00)</td>
  <td><img src='../../asset/images/sub/ski/slope_close.png' alt=''></td>
  <td><img src='../../asset/images/sub/ski/slope_close.png' alt=''></td>
  <td><img src='../../asset/images/sub/ski/slope_close.png' alt=''></td>
</tr>
</tbody>
</table>
"""

    def test_reads_level_per_slope_and_uses_the_middle_dot_in_1_1(self):
        rows = parse_jisan_slopes(self.TABLE)
        self.assertEqual(rows, [
            {"name": "1·1", "slot": "주간", "state": "OPEN", "level": "초급"},
            {"name": "2", "slot": "주간", "state": "CLOSE", "level": "중급"},
            {"name": "3(어린이 전용)", "slot": "주간", "state": "CLOSE", "level": "중급"},
            {"name": "1·1", "slot": "야간", "state": "CLOSE", "level": "초급"},
            {"name": "2", "slot": "야간", "state": "CLOSE", "level": "중급"},
            {"name": "3(어린이 전용)", "slot": "야간", "state": "CLOSE", "level": "중급"},
        ])

    def test_keeps_going_when_the_level_row_is_missing(self):
        table = self.TABLE.split("<thead>")[0] + "<thead>" + \
            self.TABLE.split("<thead>")[1].split("<tr class=\"bg_white\">")[0] + "</tr></thead>" + \
            self.TABLE.split("</thead>")[1]
        rows = parse_jisan_slopes(table)
        self.assertEqual([r["name"] for r in rows], ["1·1", "2", "3(어린이 전용)"] * 2)
        self.assertNotIn("level", rows[0])


# 비발디파크 구 '스키장 상황' AJAX: 이름·난이도는 늘 오고, 개방 값은 입력 전이면 null이다.
VIVALDI_JSON = {
    "list": [
        {"slopeNm": "블루스", "slopeGrade": "초심", "daytimeYn": "Y", "nightYn": "N", "dawnYn": "N"},
        {"slopeNm": "발라드", "slopeGrade": "초급", "daytimeYn": "N", "nightYn": "N", "dawnYn": "N"},
        {"slopeNm": "락", "slopeGrade": "최상급", "daytimeYn": None, "nightYn": None, "dawnYn": None},
    ]
}


class ParseVivaldiRowsTest(unittest.TestCase):
    def test_reads_y_n_and_treats_unfilled_values_as_closed_like_the_official_screen(self):
        self.assertEqual(parse_vivaldi_rows(VIVALDI_JSON), [
            {"name": "블루스", "level": "초심", "day": "OPEN", "night": "CLOSE"},
            {"name": "발라드", "level": "초급", "day": "CLOSE", "night": "CLOSE"},
            {"name": "락", "level": "최상급", "day": "CLOSE", "night": "CLOSE"},  # null도 공식 화면처럼 미개방
        ])

    def test_missing_state_keys_stay_unknown(self):
        rows = parse_vivaldi_rows({"list": [{"slopeNm": "블루스", "slopeGrade": "초심"}]})
        self.assertEqual(rows, [{"name": "블루스", "level": "초심"}])

    def test_dawn_only_slope_counts_as_open(self):
        rows = parse_vivaldi_rows({"list": [{"slopeNm": "블루스", "daytimeYn": "N", "nightYn": "N", "dawnYn": "Y"}]})
        self.assertEqual(rows, [{"name": "블루스", "day": "CLOSE", "night": "CLOSE", "state": "OPEN"}])


# 무주 오픈슬로프 popup: 코스마다 5칸(새벽·오전·오후·야간·자정), 열린 칸에만 class="on". 난이도는 앞 주석.
MUJU_HTML = """
<div class="course_list">
  <ul>
    <!-- 초급자용 코스(스피츠하단) -->
    <li>
      <p>스피츠하단</p>
      <ul class="color_check">
        <li><!--새벽스키--></li>
        <li class="on"><!--오전스키--></li>
        <li class="on"><!--오후스키--></li>
        <li class="on"><!--야간스키--></li>
        <li><!--자정스키--></li>
      </ul>
    </li>
    <!-- 최상급자용 코스(안단테) -->
    <li>
      <p>안단테</p>
      <ul class="color_check">
        <li><!--새벽스키--></li>
        <li><!--오전스키--></li>
        <li><!--오후스키--></li>
        <li><!--야간스키--></li>
        <li><!--자정스키--></li>
      </ul>
    </li>
  </ul>
</div>
<section class="schedule"></section>
"""


class ParseMujuCoursesTest(unittest.TestCase):
    def test_reads_am_pm_as_day_night_slot_and_level_from_the_comment(self):
        self.assertEqual(parse_muju_courses(MUJU_HTML), [
            {"name": "스피츠 하단", "level": "초급", "day": "OPEN", "night": "OPEN"},
            {"name": "안단테", "level": "최상급", "day": "CLOSE", "night": "CLOSE"},
        ])

    def test_puts_a_space_before_top_bottom_only_when_missing(self):
        self.assertEqual(muju_slope_name("스피츠하단"), "스피츠 하단")
        self.assertEqual(muju_slope_name("레이더스상단"), "레이더스 상단")
        self.assertEqual(muju_slope_name("이스턴 하단"), "이스턴 하단")
        self.assertEqual(muju_slope_name("웨스턴"), "웨스턴")

    def test_missing_list_is_empty_not_an_exception(self):
        self.assertEqual(parse_muju_courses("<html></html>"), [])


# 오투 슬로프 오픈현황: 왼쪽 제원 표(난이도 rowspan)와 오른쪽 아이콘 표가 같은 순서.
O2_HTML = """
<div class="skiLeftBox">
<table class="tblBasic tdCen">
  <tr><th>난이도</th><th colspan="2">슬로프명</th><th>연장(m)</th></tr>
  <tr class="slopeLV1"><td rowspan="2">초급</td><td>1</td><td>드림1 (DREAM1)</td><td>556</td></tr>
  <tr class="slopeLV1"><td>2</td><td>드림2 (DREAM2)</td><td>963</td></tr>
  <tr class="slopeLV2"><td>중급</td><td>3</td><td>헤드 (HEAD)</td><td>1,155</td></tr>
  <tr class="slopeFacil"><td colspan="2">하프파이프</td><td>345(160)</td></tr>
</table>
</div>
<div class="skiRightBox">
<table class="tblBasic tdCen">
  <tr><th colspan="3">오픈현황</th></tr>
  <tr><th class="sub">주간</th><th class="sub last">야간</th></tr>
  <tr class="slopeLV1"><td><img src="/common/images/ski/icon_slope_open.jpg"></td><td class="last"><img src="/common/images/ski/icon_slope_closed.jpg"></td></tr>
  <tr class="slopeLV1"><td><img src="/common/images/ski/icon_slope_closed.jpg"></td><td class="last"><img src="/common/images/ski/icon_slope_closed.jpg"></td></tr>
  <tr class="slopeLV1"><td><img src="/common/images/ski/icon_slope_closed.jpg"></td><td class="last"><img src="/common/images/ski/icon_slope_closed.jpg"></td></tr>
  <tr class="slopeLV1"><td><img src="/common/images/ski/icon_slope_closed.jpg"></td><td class="last"><img src="/common/images/ski/icon_slope_closed.jpg"></td></tr>
</table>
</div>
"""


class ParseO2RowsTest(unittest.TestCase):
    def test_pairs_names_with_the_icon_rows_and_drops_facilities(self):
        self.assertEqual(parse_o2_rows(O2_HTML), [
            {"name": "드림1", "level": "초급", "day": "OPEN", "night": "CLOSE"},
            {"name": "드림2", "level": "초급", "day": "CLOSE", "night": "CLOSE"},
            {"name": "헤드", "level": "중급", "day": "CLOSE", "night": "CLOSE"},
        ])

    def test_strips_the_english_name(self):
        self.assertEqual(o2_slope_name("드림1 (DREAM1)"), "드림1")
        self.assertEqual(o2_slope_name("첼린지3 (CHALLENGE3)"), "첼린지3")


# 곤지암 슬로프현황: 칸 순서 주간·야간·백야, 값은 Open/Close 글자.
KONJIAM_HTML = """
<table class="chart-a1">
<thead><tr><th>슬로프</th><th>수준</th><th>주간</th><th>야간</th><th>백야</th></tr></thead>
<tbody>
  <tr>
    <td class="first td-slope"><span class="slope-a">그램(구 하늬)</span></td>
    <td>초급</td>
    <td class="open">Open</td>
    <td class="close">Close</td>
    <td class="close">Close</td>
  </tr>
  <tr>
    <td class="first td-slope"><span class="slope-c">씽큐 1 (구 제타)</span></td>
    <td>초/중급</td>
    <td class="close">Close</td>
    <td class="close">Close</td>
    <td class="open">Open</td>
  </tr>
</tbody>
</table>
"""


class ParseKonjiamRowsTest(unittest.TestCase):
    def test_reads_day_night_and_counts_a_late_night_opening_as_night_open(self):
        self.assertEqual(parse_konjiam_rows(KONJIAM_HTML), [
            {"name": "그램", "level": "초급", "day": "OPEN", "night": "CLOSE"},
            {"name": "씽큐1", "level": "초중급", "day": "CLOSE", "night": "OPEN"},
        ])

    def test_maps_old_names_and_removes_the_slash_in_levels(self):
        self.assertEqual(konjiam_slope_name("홈봇 1/2(구 윈디)"), "홈봇 1/2")
        self.assertEqual(konjiam_slope_name("CNP 2(구 게일)"), "CNP 2")


class ParseOakvalleyTest(unittest.TestCase):
    def test_keeps_only_this_seasons_three_slopes_with_their_level(self):
        data = {"data": {"groups": [
            {"levelCategoryValue": "초급", "items": [{"name": "I", "open": True}]},
            {"levelCategoryValue": "중급", "items": [
                {"name": "A", "open": False},
                {"name": "D", "open": False},
                {"name": "F", "open": True},
                {"name": "G", "open": False},
            ]},
            {"levelCategoryValue": "상급", "items": [{"name": "B", "open": False}]},
        ]}}
        self.assertEqual(parse_oakvalley(data), [
            {"name": "I", "level": "초급", "day": "OPEN"},
            {"name": "F", "level": "중급", "day": "OPEN"},
            {"name": "G", "level": "중급", "day": "CLOSE"},
        ])

    def test_missing_data_is_empty(self):
        self.assertEqual(parse_oakvalley({}), [])


class KeepUncollectedTest(unittest.TestCase):
    def write(self, data):
        fd, path = tempfile.mkstemp(suffix=".json")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(data if isinstance(data, str) else json.dumps(data))
        self.addCleanup(os.remove, path)
        return path

    def test_keeps_previous_entry_for_resort_not_collected_this_run(self):
        path = self.write({"resorts": [{"id": "phoenix", "v": "old"}, {"id": "yongpyong", "v": "old"}]})
        merged = keep_uncollected([{"id": "yongpyong", "v": "new"}], path)
        self.assertEqual(merged, [{"id": "yongpyong", "v": "new"}, {"id": "phoenix", "v": "old"}])

    def test_returns_new_entries_when_previous_file_missing_or_broken(self):
        new = [{"id": "yongpyong"}]
        self.assertEqual(keep_uncollected(new, "/nonexistent/slopes.json"), new)
        self.assertEqual(keep_uncollected(new, self.write("{broken")), new)


class StickOpenTest(unittest.TestCase):
    """한 번 연 슬로프는 시즌 중(11~2월) 닫히지 않는다 — 사이트가 잠깐 CLOSE를 띄워도 개방 유지."""
    TODAY = dt.date(2026, 11, 27)

    def entry(self, slopes, **over):
        return {"id": "yongpyong", "status": "ok", "sourceDate": "2026-11-26", "slopes": slopes, **over}

    def test_keeps_day_open_but_leaves_night_realtime(self):
        prev = self.entry([{"name": "핑크", "day": "OPEN", "night": "OPEN"}, {"name": "옐로우", "day": "CLOSE", "night": "CLOSE"}])
        new = self.entry([{"name": "핑크", "day": "CLOSE", "night": "CLOSE"}, {"name": "옐로우", "day": "OPEN", "night": "CLOSE"}],
                         sourceDate="2026-11-27")
        out = stick_open(new, prev, self.TODAY)
        self.assertEqual(out["slopes"], [{"name": "핑크", "day": "OPEN", "night": "CLOSE"}, {"name": "옐로우", "day": "OPEN", "night": "CLOSE"}])
        self.assertEqual(new["slopes"][0]["day"], "CLOSE")  # 원본은 건드리지 않는다

    def test_keeps_slot_state_open_only_for_day_slots(self):
        prev = self.entry([{"name": "A", "slot": "주간", "state": "OPEN"}, {"name": "A", "slot": "야간", "state": "OPEN"}], sourceDate=None)
        new = self.entry([{"name": "A", "slot": "주간", "state": "CLOSE"}, {"name": "A", "slot": "야간", "state": "CLOSE"}], sourceDate=None)
        self.assertEqual([s["state"] for s in stick_open(new, prev, self.TODAY)["slopes"]], ["OPEN", "CLOSE"])

    def test_keeps_previous_entry_when_fetch_failed(self):
        prev = self.entry([{"name": "핑크", "day": "OPEN"}])
        failed = {"id": "yongpyong", "status": "error", "error": "HTTP 500", "slopes": []}
        self.assertEqual(stick_open(failed, prev, self.TODAY), prev)

    def test_ignores_last_season_values_and_off_season(self):
        last_season = self.entry([{"name": "1", "slot": "주간", "state": "OPEN"}], sourceDate="2026-03-01")
        new = self.entry([{"name": "1", "slot": "주간", "state": "CLOSE"}], sourceDate="2026-11-27")
        self.assertEqual(stick_open(new, last_season, self.TODAY), new)
        prev = self.entry([{"name": "핑크", "day": "OPEN"}], sourceDate="2027-03-10")
        closing = self.entry([{"name": "핑크", "day": "CLOSE"}], sourceDate="2027-03-11")
        self.assertEqual(stick_open(closing, prev, dt.date(2027, 3, 11)), closing)  # 3월부턴 닫히는 것도 보여 준다
        self.assertEqual(stick_open(new, None, self.TODAY), new)


if __name__ == "__main__":
    unittest.main()
