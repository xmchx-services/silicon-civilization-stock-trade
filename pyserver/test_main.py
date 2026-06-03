import unittest
from unittest.mock import patch

import main
import pandas as pd


class FundamentalRateLimitTest(unittest.TestCase):
    def test_returns_partial_snapshot_when_daily_basic_rate_limited(self) -> None:
        writes: list[tuple[str, dict, int]] = []

        def remember_cache_write(key: str, value: dict, ttl_seconds: int) -> None:
            writes.append((key, value, ttl_seconds))

        with (
            patch.object(main, "cache_get", return_value=None),
            patch.object(main, "cache_put", side_effect=remember_cache_write),
            patch.object(main, "_to_ts_code", return_value=("300373.SZ", "sz")),
            patch.object(main, "_resolve_name", return_value="测试股份"),
            patch.object(
                main,
                "_ak_a_spot",
                return_value={"名称": "测试股份", "市盈率-动态": "23.5"},
            ),
            patch.object(main, "_attach_profit_yoy"),
            patch.object(main, "_with_retries", side_effect=Exception("频率超限")),
        ):
            out = main.fundamental("300373")

        self.assertEqual(out["symbol"], "300373")
        self.assertEqual(out["name"], "测试股份")
        self.assertEqual(out["pe_ttm"], 23.5)
        self.assertNotIn("pb", out)
        self.assertNotIn("market_cap", out)
        self.assertEqual(writes[-1][0], "fund:v2:300373")
        self.assertEqual(writes[-1][2], 6 * 3600)

    def test_waits_for_daily_basic_when_no_partial_payload(self) -> None:
        writes: list[tuple[str, dict, int]] = []

        def remember_cache_write(key: str, value: dict, ttl_seconds: int) -> None:
            writes.append((key, value, ttl_seconds))

        def fake_daily_basic(*, block: bool = False, **kwargs):
            self.assertTrue(block)
            return pd.DataFrame(
                [
                    {
                        "trade_date": "20260601",
                        "pe_ttm": 41.2,
                        "pb": 5.6,
                        "total_mv": 9876543.0,
                    }
                ]
            )

        with (
            patch.object(main, "cache_get", return_value=None),
            patch.object(main, "cache_put", side_effect=remember_cache_write),
            patch.object(main, "_to_ts_code", return_value=("688629.SH", "sh")),
            patch.object(main, "_resolve_name", return_value=None),
            patch.object(main, "_ak_a_spot", return_value=None),
            patch.object(main, "_attach_profit_yoy"),
            patch.object(main, "_daily_basic", side_effect=fake_daily_basic),
        ):
            out = main.fundamental("688629")

        self.assertEqual(out["symbol"], "688629")
        self.assertIsNone(out["name"])
        self.assertEqual(out["pe_ttm"], 41.2)
        self.assertEqual(out["pb"], 5.6)
        self.assertEqual(out["market_cap"], 987.6543)
        self.assertEqual(writes[-1][0], "fund:v2:688629")
        self.assertEqual(writes[-1][2], 6 * 3600)

    def test_daily_basic_blocking_mode_retries_after_rate_limit(self) -> None:
        class FakeLimiter:
            def __init__(self) -> None:
                self.acquire_calls = 0

            def acquire(self) -> None:
                self.acquire_calls += 1

            def try_acquire(self) -> bool:
                raise AssertionError("blocking mode should not use try_acquire")

        limiter = FakeLimiter()
        with (
            patch.object(main, "_DAILY_BASIC_LIMITER", limiter),
            patch.object(main, "_with_retries", side_effect=[Exception("频率超限"), "ok"]),
        ):
            out = main._daily_basic(block=True, ts_code="688629.SH")

        self.assertEqual(out, "ok")
        self.assertEqual(limiter.acquire_calls, 2)


if __name__ == "__main__":
    unittest.main()
