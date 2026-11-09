"""Fetch and validate CubaOS public snapshots. Run from the project root."""
import concurrent.futures
import datetime
import hashlib
import json
import math
import pathlib
import sqlite3
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
TARGET = ROOT / "public" / "data"
WDI = {
    "SP.POP.TOTL": ("Población total", "Total population", "personas", "people"),
    "SP.POP.GROW": ("Crecimiento de población", "Population growth", "% anual", "% per year"),
    "SP.URB.TOTL.IN.ZS": ("Población urbana", "Urban population", "% del total", "% of total"),
}


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "CubaOS/0.1"})
    with urllib.request.urlopen(request, timeout=35) as response:
        return json.load(response)


def boundary(level):
    url = f"https://www.geoboundaries.org/api/current/gbOpen/CUB/{level}/"
    meta = fetch(url)
    if meta["boundaryISO"] != "CUB" or meta["boundaryType"] != level:
        raise ValueError("Unexpected geographic coverage")
    geo = fetch(meta["simplifiedGeometryGeoJSON"])
    seen = set()
    for feature in geo["features"]:
        props = feature["properties"]
        identifier = props["shapeID"]
        if identifier in seen or not props["shapeName"].strip():
            raise ValueError("Duplicate boundary or missing name")
        seen.add(identifier)
        shape = feature["geometry"]
        if shape["type"] not in ("Polygon", "MultiPolygon"):
            raise ValueError("Unsupported boundary geometry")
        polygons = [shape["coordinates"]] if shape["type"] == "Polygon" else shape["coordinates"]
        for polygon in polygons:
            for ring in polygon:
                if len(ring) < 4 or ring[0] != ring[-1] or any(
                    not (-86 < x < -73 and 18 < y < 25) for x, y in ring
                ):
                    raise ValueError(f"Invalid ring in {identifier}")
        feature["id"] = identifier
        feature["properties"] = {"name": props["shapeName"], "level": level}
    if len(seen) != int(meta["admUnitCount"]):
        raise ValueError("Boundary count differs from metadata")
    source = {
        "id": level, "provider": "geoBoundaries / OpenStreetMap / Wambacher",
        "year": meta["boundaryYearRepresented"], "license": "ODbL 1.0",
        "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
        "url": url, "download": meta["simplifiedGeometryGeoJSON"],
        "source": meta["boundarySource"],
    }
    return level, geo, source


def indicator(item):
    identifier, labels = item
    api = f"https://api.worldbank.org/v2/country/CUB/indicator/{identifier}?format=json&per_page=100"
    meta, observations = fetch(api)
    rows = []
    for row in observations:
        if row["value"] is None:
            continue
        if row["countryiso3code"] != "CUB" or not math.isfinite(row["value"]):
            raise ValueError(f"Invalid observation for {identifier}")
        rows.append({"year": int(row["date"]), "value": row["value"]})
    if not rows or len({row["year"] for row in rows}) != len(rows):
        raise ValueError(f"Empty or duplicate observations: {identifier}")
    return {
        "id": identifier, "label": labels[0], "labelEn": labels[1],
        "unit": labels[2], "unitEn": labels[3], "geography": "CUB", "status": "estimate",
        "source": "Banco Mundial / World Development Indicators", "license": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        "url": f"https://data.worldbank.org/indicator/{identifier}?locations=CU",
        "api": api, "updated": meta["lastupdated"], "observations": sorted(rows, key=lambda row: row["year"]),
    }


def publish():
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        jobs = [pool.submit(boundary, level) for level in ("ADM1", "ADM2")]
        indicators = list(pool.map(indicator, WDI.items()))
        maps = [job.result() for job in jobs]
    with sqlite3.connect(":memory:") as database:
        database.executescript((ROOT / "migrations" / "001_snapshot.sql").read_text())
        for series in indicators:
            database.executemany("INSERT INTO observations VALUES (?, ?, ?)", [
                (series["id"], row["year"], row["value"]) for row in series["observations"]
            ])
        for level, collection, _ in maps:
            database.executemany("INSERT INTO boundaries VALUES (?, ?, ?)", [
                (feature["id"], level, feature["properties"]["name"]) for feature in collection["features"]
            ])
    assets = {f"{level.lower()}.geojson": geo for level, geo, _ in maps}
    assets["indicators.json"] = indicators
    payloads = {name: json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode() for name, value in assets.items()}
    manifest = {
        "retrieved": datetime.datetime.now(datetime.timezone.utc).date().isoformat(),
        "boundaries": [source for _, _, source in maps],
        "sha256": {name: hashlib.sha256(content).hexdigest() for name, content in payloads.items()},
    }
    TARGET.mkdir(parents=True, exist_ok=True)
    for name, content in payloads.items():
        (TARGET / name).write_bytes(content)
    (TARGET / "sources.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    publish()
