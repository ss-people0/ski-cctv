"""python3 -m unittest discover scripts"""
import json
import os
import tempfile
import unittest

from collect_slopes import keep_uncollected


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
