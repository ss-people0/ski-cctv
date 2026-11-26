"""python3 -m unittest discover scripts"""
import json
import os
import tempfile
import unittest

from collect_slopes import keep_uncollected, parse_alpensia_records, parse_yongpyong_rows


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


if __name__ == "__main__":
    unittest.main()
