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
        self.assertGreaterEqual(len(airports), 100)
        self.assertEqual(len({item["id"] for item in airports}), len(airports))
        self.assertTrue({"scheduled","other","military","closed"}.issubset({item["category"] for item in airports}))
        military = [item for item in airports if item["category"]=="military"]
        self.assertTrue(any(item["province"]=="Artemisa" for item in military))
        self.assertTrue(all(item["coordinates"] is None and not item["town"] for item in military))
        self.assertTrue(all(-86 < item["coordinates"][0] < -73 and 18 < item["coordinates"][1] < 25
                            for item in airports if item["coordinates"]))

    def test_provincial_population_and_open_map_layers(self):
        population = json.loads((DATA / "population-provinces.json").read_text())
        self.assertEqual(len(population["territories"]),16)
        self.assertEqual(population["years"],[2021,2022,2023,2024])
        self.assertEqual(sum(row[-1] for row in population["territories"].values()),population["totals"][-1])
        places = json.loads((DATA / "places.geojson").read_text())
        self.assertEqual(len({feature["id"] for feature in places["features"]}),len(places["features"]))
        self.assertEqual(sum(places["metadata"]["counts"].values()),len(places["features"]))
        self.assertGreaterEqual(len(places["metadata"]["counts"]),10)

    def test_electricity_edition_has_attribution_and_unknowns(self):
        edition = json.loads((DATA / "energy.json").read_text())
        self.assertEqual(edition["license"],"CC BY 4.0")
        self.assertEqual(len(edition["national"]),90)
        self.assertGreaterEqual(len(edition["provinces"]),30)
        latest = max(edition["provinces"])
        self.assertNotIn("pinar-del-rio",edition["provinces"][latest])
        self.assertTrue(any(item["latest_served_mw"] is None
                            for item in edition["provinces"][latest].values()))
