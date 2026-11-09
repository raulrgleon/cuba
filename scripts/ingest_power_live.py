#!/usr/bin/env python3
"""Refresh geolocatable power notices from official and public mirrors."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from html import unescape
import json
import os
from pathlib import Path
import re
from tempfile import NamedTemporaryFile
import unicodedata
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

HAVANA = ZoneInfo("America/Havana")
WINDOW_HOURS = 6
CHANNEL = "EmpresaElectricaDeLaHabana"
CATALOG = "https://apagoneshabana.lat/data/circuitos.json"
DIRECTORIO = "https://www.directoriocubano.com/servicios/apagones-habana/"
CIBERCUBA = "https://www.cibercuba.com/apagones/"
TANTO = "https://cubaaltanto.org/data.js"
CUBAVERSO = "https://cubaverso.com/apagones-cuba-hoy"
VILLA = "electrico1895"
TELEGRAM = "https://t.me/s/"
CODE = r"[A-Z]{1,4}\d{1,5}"


def normalized(value):
    return "".join(c for c in unicodedata.normalize("NFD", value.casefold())
                   if not unicodedata.combining(c)).strip()


def plain(value):
    return unescape(re.sub(r"<[^>]*>", "", re.sub(r"<br\s*/?>", "\n", value)))


def time(value):
    date = datetime.fromisoformat(value[:-1] + "+00:00" if value.endswith("Z") else value)
    return (date if date.tzinfo else date.replace(tzinfo=HAVANA)).astimezone(timezone.utc)


def get(url):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; CubaOS power monitor)"})
    with urlopen(request, timeout=13) as response:
        return response.read(8_000_000).decode("utf-8")


def event(province, municipality, circuit, state, stamp, source, url):
    if province == "La Habana":
        municipality = {"10 de octubre": "Diez de Octubre", "plaza": "Plaza de la Revolución",
                        "habana vieja": "La Habana Vieja"}.get(normalized(municipality), municipality)
    return dict(province=province, municipality=municipality, circuit=circuit,
                state=state, at=time(stamp).isoformat(), source=source, url=url)


def catalog(body):
    places, rows = {}, []
    for item in json.loads(body)["circuitos"]:
        code = item.get("codigo", "")
        municipality = item.get("municipio")
        if not municipality or not re.fullmatch(CODE, code):
            continue
        municipalities = item.get("municipios") or [municipality]
        places[code] = [name for name in municipalities if isinstance(name, str) and name.strip()]
        state = {"con servicio": "on", "sin servicio": "off"}.get(item.get("estado"))
        if item.get("discrepado"):
            state = "uncertain"
        if state and item.get("oficial") and item.get("estado_fecha"):
            for name in places[code]:
                rows.append(event("La Habana", name, code, state, item["estado_fecha"],
                                  "Apagones La Habana", f"https://apagoneshabana.lat/circuitos?c={code}"))
    return places, rows


def havana_event(places, code, state, stamp, source, url):
    return [event("La Habana", name, code, state, stamp, source, url)
            for name in places.get(code, [])]


def directorio(body, places):
    rows = []
    for row in re.findall(r"<tr\b[^>]*>(.*?)</tr>", body, re.S):
        code = re.search(r'data-label="Circuito">\s*(' + CODE + r')\s*<', row)
        status = re.search(r'data-label="Último aviso">([^<]+)', row)
        stamp = re.search(r'data-label="Hora \(Cuba\)">([^<]+)', row)
        link = re.search(r'href="(https://t\.me/' + CHANNEL + r'/\d+)"', row)
        if not all((code, status, stamp, link)):
            continue
        state = {"Restablecido según el aviso": "on", "Afectado según el aviso": "off"}.get(plain(status[1]).strip())
        if state:
            date = datetime.strptime(stamp[1].strip(), "%d/%m/%Y %H:%M").isoformat()
            rows.extend(havana_event(places, code[1], state, date, "Directorio Cubano", link[1]))
    return rows


def cibercuba(body, places):
    rows = []
    for kind, row in re.findall(r'<li\b[^>]*data-event-type="([^"]+)"[^>]*>(.*?)</li>', body, re.S):
        state = {"service_restored": "on", "local_blackout_report": "off"}.get(kind)
        if not state or "Fuente: Empresa Eléctrica de La Habana" not in plain(row):
            continue
        stamp = re.search(r'<time\b[^>]*datetime="([^"]+)"', row)
        location = re.search(r'class="event-location">([^<]+)', row)
        link = re.search(r'href="(/apagones/eventos/[^"<>]+/)"', row)
        if stamp and location and link:
            for code in re.findall(r"\b" + CODE + r"\b", location[1]):
                rows.extend(havana_event(places, code, state, stamp[1], "CiberCuba", "https://www.cibercuba.com" + link[1]))
    return rows


def cuba_al_tanto(body, places, now):
    match = re.fullmatch(r"\s*window\.MAPA_LIVE\s*=\s*(.*?);?\s*", body, re.S)
    if not match:
        raise ValueError("Missing public Cuba al Tanto snapshot")
    data = json.loads(match[1])
    posts = {}
    for province, ref, stamp in data["ao"]:
        when = time(stamp)
        if re.fullmatch(r"[A-Za-z0-9_]+/\d+", ref):
            posts.setdefault((province, when.astimezone(HAVANA).strftime("%H:%M")), []).append((stamp, ref))
    rows = []

    def add(province, municipality, code, state, minute):
        matches = posts.get((province, minute), [])
        if len(matches) != 1:
            return
        stamp, ref = matches[0]
        if not 0 <= (now - time(stamp)).total_seconds() <= WINDOW_HOURS * 3600:
            return
        if not code.strip() or normalized(code) == "afectado por deficit":
            return
        if province == "La Habana":
            rows.extend(havana_event(places, code, state, stamp, "Cuba al Tanto", "https://t.me/" + ref))
        elif municipality:
            rows.append(event(province, municipality, code, state, stamp, "Cuba al Tanto", "https://t.me/" + ref))

    # Each entry names a circuit and municipality. Never derive an outage
    # from aggregate counts, a schedule, or an unmatched local time.
    for province, block in data["av"].items():
        for code, municipality, minute in block.get("off", []):
            add(province, municipality, code, "off", minute)
    for kind, _, minute, title, detail, province, _ in data["news"]:
        if kind != "Avisos":
            continue
        state = {"Se restableció el servicio en 1 circuito": "on",
                 "Se afectó el servicio en 1 circuito": "off"}.get(title)
        fields = re.match(r"Circuitos: ([^.,]+)\. Municipios: ([^.,]+)\.", detail)
        if state and fields:
            add(province, fields[2], fields[1], state, minute)
    return rows


def cubaverso(body, places):
    parts = re.split(r'<h3 class="font-heading text-lg font-bold">([^<]+)</h3>', body)
    if len(parts) < 3:
        raise ValueError("Missing provincial reports")
    rows = []
    for province, block in zip(parts[1::2], parts[2::2]):
        if plain(province).strip() not in ("La Habana", "Villa Clara"):
            continue
        for stamp, original in re.findall(
                r'<li class="py-4">(?:(?!</li>).)*?<time dateTime="([^"]+)"(?:(?!</li>).)*?'
                r'Ver parte original</summary><p[^>]*>(.*?)</p>', block, re.S):
            rows.extend(utility_message(plain(original), CHANNEL if plain(province).strip() == "La Habana" else VILLA,
                                        places, stamp, CUBAVERSO, "Cubaverso"))
    return rows


def utility_message(message, channel, places, stamp, url, source):
    header, _, details = message.strip().partition("\n")
    title = normalized(header)
    on = re.search(r"\b(?:restablecid[oa]|restablece|queda con servicio)\b", title)
    off = re.search(r"\b(?:afectad[oa]|se afecto|queda afectado|fuera de servicio)\b", title)
    if bool(on) == bool(off) or "servicio electrico" not in title:
        return []
    state = "on" if on else "off"
    rows = []
    if channel == CHANNEL:
        for codes in re.findall(r"👉\s*((?:" + CODE + r")(?:\s*/\s*" + CODE + r")*)\s*:", details):
            for code in re.findall(CODE, codes):
                rows.extend(havana_event(places, code, state, stamp, source, url))
    else:
        parts = re.split(r"Municipio\s+([^:\n]+):", details, flags=re.I)
        for municipality, block in zip(parts[1::2], parts[2::2]):
            municipality = municipality.strip()
            municipality = {"quemado": "Quemado de Güines", "sagua": "Sagua la Grande"}.get(normalized(municipality), municipality)
            for code in re.findall(r"(?:👉|^)\s*Cto\.?\s+(\d{1,5}[A-Z]?)\b", block, re.M | re.I):
                rows.append(event("Villa Clara", municipality, code.upper(), state, stamp, source, url))
    return rows


def telegram(body, channel, places):
    rows = []
    for post_id, post in re.findall(r'data-post="' + channel + r'/(\d+)"(.*?)(?=data-post="|\Z)', body, re.S):
        message = re.search(r'class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', post, re.S)
        stamp = re.search(r'<time\b[^>]*datetime="([^"]+)"', post)
        if not message or not stamp:
            continue
        source = "Empresa Eléctrica de La Habana" if channel == CHANNEL else "Empresa Eléctrica Villa Clara"
        rows.extend(utility_message(plain(message[1]), channel, places, stamp[1],
                                    f"https://t.me/{channel}/{post_id}", source))
    return rows


def reconcile(rows, now):
    grouped = {}
    for row in rows:
        age = now - time(row["at"])
        if not timedelta(minutes=-2) <= age <= timedelta(hours=WINDOW_HOURS):
            continue
        key = (normalized(row["province"]), normalized(row["municipality"]), row["circuit"])
        grouped.setdefault(key, []).append(row)
    result = []
    for observations in grouped.values():
        # Aggregators can round or re-publish the same official notice.
        # Within two minutes, withhold conflicting mirror reports unless the utility resolves them.
        newest = max(time(row["at"]) for row in observations)
        near = [row for row in observations if newest - time(row["at"]) <= timedelta(minutes=2)]
        primary = [row for row in near if row["source"].startswith("Empresa Eléctrica")]
        if any(row["state"] == "uncertain" for row in near):
            continue
        if len({row["state"] for row in near}) > 1 and not primary:
            continue
        winner = max(primary or near, key=lambda row: row["at"])
        sources = {row["source"]: row["url"] for row in near if row["state"] == winner["state"]}
        result.append({**winner, "sources": sources})
    return sorted(result, key=lambda row: row["at"], reverse=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    previous = json.loads(args.output.read_text()) if args.output.exists() else {}
    sources = [
        ("Apagones La Habana", CATALOG),
        ("Directorio Cubano", DIRECTORIO),
        ("CiberCuba", CIBERCUBA),
        ("Cuba al Tanto", TANTO),
        ("Cubaverso", CUBAVERSO),
        ("Empresa Eléctrica de La Habana", TELEGRAM + CHANNEL),
        ("Empresa Eléctrica Villa Clara", TELEGRAM + VILLA),
    ]
    rows, health = [], []
    places = previous.get("catalog", {})
    with ThreadPoolExecutor(max_workers=len(sources)) as pool:
        futures = [pool.submit(get, url) for _, url in sources]
        for (name, url), future in zip(sources, futures):
            try:
                body = future.result()
                if url == CATALOG:
                    places, found = catalog(body)
                    if not places:
                        raise ValueError("Empty circuit catalog")
                elif url == DIRECTORIO:
                    if 'data-label="Circuito"' not in body:
                        raise ValueError("Missing circuit table")
                    found = directorio(body, places)
                elif url == CIBERCUBA:
                    if 'data-event-type="' not in body:
                        raise ValueError("Missing incident timeline")
                    found = cibercuba(body, places)
                elif url == TANTO:
                    found = cuba_al_tanto(body, places, now)
                elif url == CUBAVERSO:
                    found = cubaverso(body, places)
                else:
                    if 'data-post="' not in body:
                        raise ValueError("Missing Telegram posts")
                    found = telegram(body, url.removeprefix(TELEGRAM), places)
                rows.extend(found)
                health.append({"name": name, "ok": True, "records": len(found)})
            except (OSError, ValueError, KeyError, TypeError) as error:
                print(f"{name}: {error}", flush=True)
                health.append({"name": name, "ok": False, "records": 0})
    if not any(source["ok"] for source in health):
        raise SystemExit("No power source available")
    # Keep individual observations through transient outages or feed pagination.
    unique = {(row["source"], row["municipality"], row["province"], row["circuit"], row["at"], row["state"]): row
              for row in previous.get("observations", []) + rows
              if -timedelta(minutes=2) <= now - time(row["at"]) <= timedelta(hours=WINDOW_HOURS)}
    observations = list(unique.values())
    reports = reconcile(observations, now)
    payload = dict(checked=now.isoformat(), windowHours=WINDOW_HOURS, sources=health,
                   reports=reports, catalog=places, observations=observations)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(mode="w", encoding="utf-8", dir=args.output.parent, delete=False) as file:
        temp = Path(file.name)
        json.dump(payload, file, ensure_ascii=False, separators=(",", ":"))
    try:
        os.chmod(temp, 0o644)
        temp.replace(args.output)
    finally:
        temp.unlink(missing_ok=True)
    print(f"{len(reports)} recent circuit notices; {health}", flush=True)


if __name__ == "__main__":
    main()
