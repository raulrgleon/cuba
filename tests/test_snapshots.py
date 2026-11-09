import hashlib
import json
from pathlib import Path
import unittest

DATA = Path(__file__).resolve().parents[1] / "public" / "data"


class PublicSnapshots(unittest.TestCase):
    def test_manifest_and_geojson(self):
        sources = json.loads((DATA / "sources.json").read_text())
        for name, digest in sources["sha256"].items():
            self.assertEqual(hashlib.sha256((DATA / name).read_bytes()).hexdigest(), digest)
        for level, count in (("ADM1", 16), ("ADM2", 168)):
            geo = json.loads((DATA / (level.lower() + ".geojson")).read_text())
            self.assertEqual(geo["type"], "FeatureCollection")
            self.assertEqual(len({item["id"] for item in geo["features"]}), count)
            self.assertEqual(len(geo["features"]), count)
            self.assertTrue(all(item["properties"]["level"] == level for item in geo["features"]))
            for item in geo["features"]:
                shape = item["geometry"]
                polygons = [shape["coordinates"]] if shape["type"] == "Polygon" else shape["coordinates"]
                self.assertTrue(polygons)
                for polygon in polygons:
                    for ring in polygon:
                        self.assertEqual(ring[0], ring[-1])
                        self.assertGreaterEqual(len(ring), 4)
                        self.assertTrue(all(-86 < x < -73 and 18 < y < 25 for x, y in ring))

    def test_series_metadata_and_years(self):
        indicators = json.loads((DATA / "indicators.json").read_text())
        self.assertGreaterEqual(len(indicators), 16)
        self.assertEqual({series["category"] for series in indicators},
                         {"people", "economy", "energy", "health", "education", "connectivity", "environment", "transport"})
        for series in indicators:
            self.assertEqual(series["geography"], "CUB")
            self.assertEqual(series["status"], "published")
            self.assertTrue(series["url"].startswith("https://data.worldbank.org/"))
            self.assertTrue(series["license"])
            years = [row["year"] for row in series["observations"]]
            self.assertEqual(years, sorted(set(years)))
            self.assertGreaterEqual(len(years), 1)

    def test_airports_are_unique_and_in_cuba(self):
        snapshot = json.loads((DATA / "airports.json").read_text())
        airports = snapshot["airports"]
        self.assertGreaterEqual(len(airports), 8)
        self.assertEqual(len({item["iata"] for item in airports}), len(airports))
        self.assertTrue(all(len(item["iata"]) == 3 and -86 < item["coordinates"][0] < -73
                            and 18 < item["coordinates"][1] < 25 for item in airports))
