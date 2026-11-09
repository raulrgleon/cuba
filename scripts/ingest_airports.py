"""Build the Cuban public aerodrome catalog from OurAirports and historical references."""
import csv
import io
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

URL = "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv"
SOURCE = "https://github.com/davidmegginson/ourairports-data"
HISTORY = ("https://tile.loc.gov/storage-services/master/frd/frdcstdy/cu/"
           "cubacountrystudy00huds/cubacountrystudy00huds.pdf")
MILITARY = {"MUSA", "MUPB", "MUSJ", "MUMG", "MULB", "MUGM", "CU-0015", "CU-0095", "CU-0115"}
REGIONS = {
    "01":"Pinar del Río", "03":"La Habana", "04":"Matanzas", "05":"Villa Clara",
    "06":"Cienfuegos", "07":"Sancti Spíritus", "08":"Ciego de Ávila", "09":"Camagüey",
    "10":"Las Tunas", "11":"Holguín", "12":"Granma", "13":"Santiago de Cuba",
    "14":"Guantánamo", "15":"Artemisa", "16":"Mayabeque", "99":"Isla de la Juventud",
}

with urlopen(URL, timeout=30) as response:
    rows = list(csv.DictReader(io.TextIOWrapper(response, encoding="utf-8-sig")))
airports = []
for row in rows:
    if row["iso_country"] != "CU" or row["name"].lower().startswith("[duplicate]"):
        continue
    name = row["name"]
    military = row["ident"] in MILITARY or any(term in name.casefold() for term in
        ("air base", "naval station", "military", "army"))
    scheduled = row["scheduled_service"] == "yes" and not military
    closed = row["type"] == "closed"
    category = "military" if military else "closed" if closed else "scheduled" if scheduled else "other"
    x, y = float(row["longitude_deg"]), float(row["latitude_deg"])
    if not -86 < x < -73 or not 18 < y < 25:
        raise ValueError(f"Airport outside Cuban bounds: {row['ident']}")
    public_civil = not military and not closed and (scheduled or bool(row["iata_code"]) or
        any(term in name.casefold() for term in ("agricultural", "hotel")))
    airports.append({
        "id":row["ident"], "iata":row["iata_code"] if not military else "",
        "name":name, "town":row["municipality"] if not military else "",
        "province":REGIONS.get(row["iso_region"].split("-")[-1],""),
        "category":category, "closed":closed,
        "coordinates":[x,y] if public_civil else None,
        "source":HISTORY if row["ident"] in {"MUSA","MUPB","MUSJ"} else SOURCE,
    })
if len(airports)<100 or len({row["id"] for row in airports})!=len(airports):
    raise ValueError("Unexpected airport coverage")
snapshot = {"retrieved":datetime.now(timezone.utc).date().isoformat(), "source":SOURCE,
            "license":"Unlicense / Public domain", "airports":sorted(airports,key=lambda row:row["name"].casefold())}
target = Path(__file__).resolve().parents[1] / "public/data/airports.json"
target.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")))
