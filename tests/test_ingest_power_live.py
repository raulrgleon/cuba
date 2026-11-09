from datetime import datetime, timezone
import unittest

from scripts.ingest_power_live import CHANNEL, event, reconcile, telegram


class PowerNoticesTest(unittest.TestCase):
    def test_latest_official_report_resolves_mirror_disagreement(self):
        now = datetime(2026, 11, 9, 18, tzinfo=timezone.utc)

        def notice(state, at, source):
            return event("La Habana", "Plaza", "A490", state, at, source, "https://example.org")

        outage = notice("off", "2026-11-09T17:10:00Z", "Directorio Cubano")
        restoration = notice("on", "2026-11-09T17:09:00Z", "CiberCuba")
        official = notice("on", "2026-11-09T17:09:15Z", "Empresa Eléctrica de La Habana")
        self.assertEqual(reconcile([outage, restoration], now), [])
        result = reconcile([outage, restoration, official], now)
        self.assertEqual(result[0]["state"], "on")
        self.assertEqual(result[0]["municipality"], "Plaza de la Revolución")
        self.assertEqual(set(result[0]["sources"]), {"CiberCuba", "Empresa Eléctrica de La Habana"})
        self.assertEqual(reconcile([outage], now.replace(day=10)), [])

    def test_telegram_does_not_paint_unmapped_circuits(self):
        body = f'''<div data-post="{CHANNEL}/123"><div class="tgme_widget_message_text">
          Queda restablecido el servicio eléctrico en estos circuitos:<br/>👉 A490/S514: zona.
          </div><time datetime="2026-11-09T17:09:15Z"></time></div>'''
        result = telegram(body, CHANNEL, {"A490": ["Centro Habana"]})
        self.assertEqual([(row["circuit"], row["state"]) for row in result], [("A490", "on")])
