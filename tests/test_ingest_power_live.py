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

    def test_provincial_directory_keeps_circuits_without_live_status(self):
        from scripts.ingest_power_live import provincial_directory

        body = '''window.MAPA_ZONAS={"prov":"Villa Clara","cols":["key","name","muni","ls","lt"],
                   "c":[["182","Circuito 182 · Van Troy","Caibarién","off","2026-11-08T11:42"],
                        ["183","Circuito 183","Municipio por confirmar",null,null]]};'''
        entries = provincial_directory("Villa Clara", body, datetime(2026, 11, 9, 18, tzinfo=timezone.utc))
        self.assertEqual(entries[0]["id"], "villa clara:caibarien:182")
        self.assertEqual(entries[0]["lastNotice"]["state"], "off")
        self.assertEqual(entries[1]["municipalities"], [])
        self.assertNotIn("lastNotice", entries[1])

    def test_official_partial_outage_remains_partial(self):
        from scripts.ingest_power_live import VILLA, utility_message

        result = utility_message("Afectado de forma parcial, circuito 110 La Piedra del municipio Manicaragua, ramal Bermejo.",
                                 VILLA, {}, "2026-11-09T17:09:15Z", "https://t.me/electrico1895/1",
                                 "Empresa Eléctrica Villa Clara")
        self.assertEqual([(row["circuit"], row["municipality"], row["state"]) for row in result],
                         [("110", "Manicaragua", "partial")])
