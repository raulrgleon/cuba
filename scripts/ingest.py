"""Fetch and validate CubaOS public snapshots. Run from the project root."""
import concurrent.futures
import datetime
import hashlib
import json
import math
import pathlib
import sqlite3
import urllib.request
import urllib.error
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
TARGET = ROOT / "public" / "data"
WDI = {
    "SP.POP.TOTL": ("people", "Población total", "Total population", "personas", "people"),
    "SP.POP.GROW": ("people", "Crecimiento de población", "Population growth", "% anual", "% per year"),
    "SP.URB.TOTL.IN.ZS": ("people", "Población urbana", "Urban population", "% del total", "% of total"),
    "SP.POP.65UP.TO.ZS": ("people", "Población de 65 años o más", "Population aged 65 and over", "% del total", "% of total"),
    "SM.POP.NETM": ("people", "Migración neta", "Net migration", "personas", "people"),
    "NY.GDP.MKTP.CD": ("economy", "PIB a precios corrientes", "GDP at current prices", "USD corrientes", "current USD"),
    "NY.GDP.MKTP.KD.ZG": ("economy", "Crecimiento real del PIB", "Real GDP growth", "% anual", "% per year"),
    "SL.UEM.TOTL.ZS": ("economy", "Desempleo", "Unemployment", "% de la fuerza laboral", "% of labor force"),
    "ST.INT.ARVL": ("economy", "Llegadas turísticas internacionales", "International tourist arrivals", "llegadas", "arrivals"),
    "EG.ELC.ACCS.ZS": ("energy", "Acceso a electricidad", "Access to electricity", "% de la población", "% of population"),
    "EG.ELC.RNWX.ZS": ("energy", "Generación renovable sin hidroeléctrica", "Non-hydro renewable electricity", "% de la generación", "% of generation"),
    "SP.DYN.LE00.IN": ("health", "Esperanza de vida al nacer", "Life expectancy at birth", "años", "years"),
    "SP.DYN.IMRT.IN": ("health", "Mortalidad infantil", "Infant mortality", "por 1.000 nacidos vivos", "per 1,000 live births"),
    "SH.MED.PHYS.ZS": ("health", "Médicos", "Physicians", "por 1.000 personas", "per 1,000 people"),
    "SE.PRM.ENRR": ("education", "Matrícula bruta en primaria", "Gross primary enrollment", "% bruto", "gross %"),
    "SE.TER.ENRR": ("education", "Matrícula bruta terciaria", "Gross tertiary enrollment", "% bruto", "gross %"),
    "IT.NET.USER.ZS": ("connectivity", "Personas que usan Internet", "People using the Internet", "% de la población", "% of population"),
    "IT.CEL.SETS.P2": ("connectivity", "Suscripciones móviles", "Mobile subscriptions", "por 100 personas", "per 100 people"),
    "AG.LND.FRST.ZS": ("environment", "Superficie forestal", "Forest area", "% de la superficie terrestre", "% of land area"),
    "EN.GHG.CO2.PC.CE.AR5": ("environment", "Emisiones de CO₂ por persona", "CO₂ emissions per capita", "t de CO₂e por persona", "t CO₂e per person"),
    "IS.AIR.PSGR": ("transport", "Pasajeros de aerolíneas registradas en Cuba", "Passengers carried by Cuba-registered airlines", "pasajeros", "passengers"),
}


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "CubaOS/0.1"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return json.load(response)
        except (OSError, urllib.error.URLError) as error:
            if attempt == 2:
                raise RuntimeError(f"Could not fetch {url}: {error}") from error
            time.sleep(attempt + 1)


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
        "id": identifier, "category": labels[0], "label": labels[1], "labelEn": labels[2],
        "unit": labels[3], "unitEn": labels[4], "geography": "CUB", "status": "published",
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
