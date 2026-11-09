"""Import recent Cuban electricity reports from El Alambique (CC BY 4.0)."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
import json
import math
import os
from pathlib import Path
import re
import tempfile
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

BASE = "https://elalambique.net/datos/"
NATIONAL = ("morning_available_mw", "morning_demand_mw", "morning_outage_mw",
            "forecast_peak_mw", "peak_available_mw", "peak_demand_mw",
            "peak_deficit_mw", "max_outage_yesterday_mw", "solar_mwh")
PROVINCIAL = ("latest_outage_mw", "latest_served_mw", "max_outage_mw",
              "circuits_affected", "service_hours_min", "service_hours_max")


def fetch(filename):
    req = Request(BASE + filename, headers={"User-Agent": "CubaOS electricity / data import"})
    with urlopen(req, timeout=25) as response:
        data = json.load(response)
    if data["license"].rstrip("/") != "https://creativecommons.org/licenses/by/4.0":
        raise ValueError("Unexpected source license")
    datetime.fromisoformat(data["updated"].replace("Z", "+00:00"))
    return data


def valid_date(value):
    return date.fromisoformat(value).isoformat()


def safe_url(value, host=None):
    if not isinstance(value, str):
        return None
    url = urlsplit(value)
    return value if url.scheme == "https" and url.hostname and (not host or url.hostname == host) else None


def metrics(row, fields):
    return {field: value if isinstance(value := row.get(field), (int, float))
            and not isinstance(value, bool) and math.isfinite(value) and value >= 0 else None
            for field in fields}


def publish(output):
    with ThreadPoolExecutor(max_workers=2) as pool:
        national, regional = pool.map(fetch, ("apagones-une.json", "apagones-provincias.json"))
    country = []
    for row in national["rows"]:
        values = metrics(row, NATIONAL)
        if any(value is not None for value in values.values()):
            country.append({"date":valid_date(row["date"]), **values,
                "morning_time":row.get("morning_time"), "source_url":safe_url(row.get("source_url"))})
    country.sort(key=lambda item:item["date"])
    days = sorted({valid_date(row["date"]) for row in regional["rows"]})[-45:]
    provinces = {}
    for row in regional["rows"]:
        if row["date"] not in days or not re.fullmatch(r"[a-z-]+",row["province"]):
            continue
        values = metrics(row, PROVINCIAL)
        provinces.setdefault(row["date"], {})[row["province"]] = {
            **values, "name":row["province_name"], "source":row["source"],
            "latest_outage_time":row.get("latest_outage_time"),
            "latest_served_time":row.get("latest_served_time"),
            "source_posts":[url for item in row.get("source_posts",[]) if (url := safe_url(item,"t.me"))],
        }
    if len(country)<30 or len(provinces)<10:
        raise ValueError("Source coverage unexpectedly low")
    dataset = {"source":BASE, "license":"CC BY 4.0", "checked":datetime.now(timezone.utc).isoformat(),
               "nationalUpdated":national["updated"], "regionalUpdated":regional["updated"],
               "national":country[-90:], "provinces":provinces}
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=output.parent, delete=False) as handle:
        stage = Path(handle.name)
        json.dump(dataset, handle, ensure_ascii=False, separators=(",", ":"))
    try:
        if output.exists():
            previous = json.loads(output.read_text())
            if previous["nationalUpdated"] > dataset["nationalUpdated"] or previous["regionalUpdated"] > dataset["regionalUpdated"]:
                raise ValueError("Upstream is older than the edition already published")
        stage.chmod(0o644)
        os.replace(stage,output)
    finally:
        stage.unlink(missing_ok=True)
    print(f"Electricidad: {len(dataset['national'])} partes nacionales; {len(provinces)} días provinciales.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("public/data/energy.json"))
    publish(parser.parse_args().output)
