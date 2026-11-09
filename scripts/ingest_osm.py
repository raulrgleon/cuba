"""Produce a CubaOS edition from a dated Geofabrik Cuba OSM PBF."""
import argparse
from collections import Counter
import json
from pathlib import Path
import re

import osmium

AMENITIES = {
    "hospital":"health", "clinic":"health", "pharmacy":"pharmacy",
    "school":"school", "college":"school", "university":"university",
    "marketplace":"market", "ferry_terminal":"port",
}


def category(tags):
    if any(tags.get(key) for key in ("military", "disused:amenity", "abandoned:amenity")):
        return None
    if tags.get("access") in ("private", "no"):
        return None
    if tags.get("leisure") == "park" or tags.get("boundary") == "national_park":
        return "park"
    if tags.get("railway") in ("station", "halt") and tags.get("station") != "freight":
        return "station"
    if tags.get("shop") == "supermarket":
        return "market"
    if tags.get("water") == "reservoir":
        return "water"
    return AMENITIES.get(tags.get("amenity"))


def coords(location):
    return [round(location.lon, 5), round(location.lat, 5)]


class Extract(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.features = []
        self.seen = set()

    def save(self, identifier, tags, kind, geometry):
        name = (tags.get("name:es") or tags.get("name") or tags.get("ref") or "").strip()
        if not name:
            return
        if geometry["type"] == "Point":
            x,y = geometry["coordinates"]
            fingerprint=(kind,name.casefold(),round(x,3),round(y,3))
            if fingerprint in self.seen:
                return
            self.seen.add(fingerprint)
        self.features.append({
            "type":"Feature", "id":identifier, "geometry":geometry,
            "properties":{"name":name,"kind":kind},
        })

    def node(self, node):
        kind = category(node.tags)
        if kind and node.location.valid():
            self.save(f"node/{node.id}",node.tags,kind,{"type":"Point","coordinates":coords(node.location)})

    def way(self, way):
        kind = category(way.tags)
        road = way.tags.get("highway") in ("motorway","trunk","primary")
        rail = way.tags.get("railway") == "rail" and not way.tags.get("service")
        if not (kind or road or rail):
            return
        points = [coords(node.location) for node in way.nodes if node.location.valid()]
        if len(points) < 2:
            return
        if road or rail:
            self.save(f"way/{way.id}",way.tags,"road" if road else "rail",
                      {"type":"LineString","coordinates":points})
        else:
            # Represent a named mapped facility by its geometry's bounding-box center.
            # This is an approximate marker, not an entrance or surveyed location.
            x,y = zip(*points)
            center=[round((min(x)+max(x))/2,5), round((min(y)+max(y))/2,5)]
            self.save(f"way/{way.id}",way.tags,kind,{"type":"Point","coordinates":center})


parser = argparse.ArgumentParser()
parser.add_argument("pbf",type=Path)
args = parser.parse_args()
if not re.fullmatch(r"cuba-\d{6}\.osm\.pbf",args.pbf.name):
    parser.error("Use a dated Cuba extract from Geofabrik.")
extract = Extract()
extract.apply_file(str(args.pbf), locations=True, idx="flex_mem")
assert len(extract.features) > 100
counts = dict(sorted(Counter(item["properties"]["kind"] for item in extract.features).items()))
target = Path(__file__).resolve().parents[1] / "public/data/places.geojson"
target.write_text(json.dumps({"type":"FeatureCollection", "features":extract.features,
    "metadata":{"source":"https://download.geofabrik.de/central-america/cuba.html",
                "snapshot":args.pbf.name,"license":"ODbL 1.0","counts":counts}},
    ensure_ascii=False,separators=(",",":")))
print(counts)
