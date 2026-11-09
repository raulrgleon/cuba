"""Publish public civilian scheduled-service airports from OurAirports."""
import csv
import io
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

url = "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv"
with urlopen(url, timeout=30) as response:
    rows = list(csv.DictReader(io.TextIOWrapper(response, encoding="utf-8-sig")))
airports = []
for row in rows:
    if row["iso_country"] != "CU" or row["scheduled_service"] != "yes":
        continue
    if row["type"] not in ("large_airport", "medium_airport") or not row["iata_code"]:
        continue
    x, y = float(row["longitude_deg"]), float(row["latitude_deg"])
    if not -86 < x < -73 or not 18 < y < 25:
        raise ValueError("Cuban airport is outside the expected region")
    airports.append({"id":row["ident"],"iata":row["iata_code"],"name":row["name"],
                     "town":row["municipality"],"coordinates":[x,y]})
if not airports or len({row["id"] for row in airports}) != len(airports):
    raise ValueError("Empty or duplicate airport data")
snapshot = {"retrieved":datetime.now(timezone.utc).date().isoformat(),
            "source":"https://github.com/davidmegginson/ourairports-data",
            "license":"Unlicense / Public domain", "airports":sorted(airports,key=lambda row:row["iata"])}
target = Path(__file__).resolve().parents[1] / "public/data/airports.json"
target.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")))
