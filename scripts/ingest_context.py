"""Prepare a small regional basemap from public-domain Natural Earth."""
import json
from pathlib import Path
from urllib.request import urlopen

URL = ("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/"
       "geojson/ne_50m_admin_0_countries.geojson")
COUNTRIES = {"USA", "MEX", "BHS", "JAM", "HTI", "DOM", "BLZ", "GTM", "HND", "TCA", "CYM"}

with urlopen(URL, timeout=20) as response:
    source = json.load(response)
features = []
for feature in source["features"]:
    props = feature["properties"]
    if props["ADM0_A3"] in COUNTRIES:
        features.append({"type":"Feature","geometry":feature["geometry"],"properties":{"name":props["NAME"]}})
assert len(features) >= 8
target = Path(__file__).resolve().parents[1] / "public/data/caribbean.geojson"
target.write_text(json.dumps({"type":"FeatureCollection","features":features}, separators=(",", ":")))
