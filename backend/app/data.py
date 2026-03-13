"""
Outdoor Olive Farm Simulation — Multi-Zone Drip Irrigation
===========================================================
Models a real drip-irrigation farm (like the diagram) with:

  ┌─────────────────────────────────────────────────────┐
  │  RESERVOIR  →  FILTER  →  MAIN VALVE               │
  │       └─── ZONE VALVE 1 ──► Zone 1 drip lines      │
  │       └─── ZONE VALVE 2 ──► Zone 2 drip lines      │
  │       └─── ZONE VALVE N ──► Zone N drip lines      │
  └─────────────────────────────────────────────────────┘

Each row = one zone at one timestamp.

Shared sensors (same value for all zones at a timestamp)
  ─ air_temperature_c       (BME280)
  ─ air_humidity_pct         (BME280 / DHT11)
  ─ air_pressure_hpa         (BME280)
  ─ light_intensity_lux      (BH1750)
  ─ reservoir_level_pct      (HC-SR04 ultrasonic)
  ─ main_pressure_mpa        (pressure sensor after filter)
  ─ filter_status            (0=clean, 1=partial clog, 2=clogged)

Per-zone sensors (independent per zone)
  ─ zone_id                  (1 … N)
  ─ valve_open               (0/1)
  ─ soil_moisture_pct        (capacitive soil sensor)
  ─ zone_flow_lpm            (YF-S201 flow sensor on drip line)
  ─ zone_pressure_mpa        (pressure sensor at zone inlet)

Training labels
  ─ stress_score [0-1]       ─ stress_class
  ─ health_score [0-10]      ─ irrigation_needed [0/1]

Usage
-----
  # Full year — Agadir (default), 4 zones
  python greenhouse_weather_simulation.py --start 2023-01-01 --end 2023-12-31

  # 6 zones
  python greenhouse_weather_simulation.py --zones 6 --start 2023-01-01 --end 2023-06-30

  # Custom lat/lon
  python greenhouse_weather_simulation.py --lat 31.5 --lon -8.0 --start 2023-01-01 --end 2023-12-31

  # Offline demo (no internet)
  python greenhouse_weather_simulation.py --demo --rows 500
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

# ─────────────────────────────────────────────────────────────
# 0.  Optional dependency
# ─────────────────────────────────────────────────────────────
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# ─────────────────────────────────────────────────────────────
# 1.  Location — Agadir only
# ─────────────────────────────────────────────────────────────
LOCATIONS: Dict[str, Dict] = {
    "agadir": {"lat": 30.42, "lon": -9.60, "tz": "Africa/Casablanca", "label": "Agadir, Morocco"},
    # "valencia":   {"lat": 39.47,  "lon": -0.38,  "tz": "Europe/Madrid",       "label": "Valencia, Spain"},
    # "catania":    {"lat": 37.50,  "lon": 15.09,  "tz": "Europe/Rome",         "label": "Catania, Sicily"},
    # "athens":     {"lat": 37.98,  "lon": 23.73,  "tz": "Europe/Athens",       "label": "Athens, Greece"},
    # "tunis":      {"lat": 36.82,  "lon": 10.18,  "tz": "Africa/Tunis",        "label": "Tunis, Tunisia"},
    # "seville":    {"lat": 37.39,  "lon": -5.99,  "tz": "Europe/Madrid",       "label": "Seville, Spain"},
    # "tel_aviv":   {"lat": 32.08,  "lon": 34.78,  "tz": "Asia/Jerusalem",      "label": "Tel Aviv, Israel"},
    # "florida":    {"lat": 28.54,  "lon": -81.38, "tz": "America/New_York",    "label": "Orlando, Florida"},
    # "california": {"lat": 34.05,  "lon": -117.0, "tz": "America/Los_Angeles", "label": "Riverside, California"},
}

# ─────────────────────────────────────────────────────────────
# 2.  Plant profile — Olive only
# ─────────────────────────────────────────────────────────────
@dataclass
class PlantProfile:
    name:                  str
    temp_optimal:          Tuple[float, float]
    temp_stress_low:       float
    temp_stress_high:      float
    humidity_optimal:      Tuple[float, float]
    light_optimal:         Tuple[float, float]
    light_min:             float
    light_max:             float
    soil_moisture_optimal: Tuple[float, float]
    soil_moisture_dry:     float
    soil_moisture_wet:     float
    irrigate_below:        float
    irrigate_stop:         float
    growth_phases:         Dict[int, float] = field(default_factory=dict)

PLANT_PROFILES: Dict[str, PlantProfile] = {
    # "orange": PlantProfile(
    #     name="Orange (Citrus sinensis)",
    #     temp_optimal=(18, 32), temp_stress_low=10, temp_stress_high=38,
    #     humidity_optimal=(50, 70),
    #     light_optimal=(20_000, 80_000), light_min=5_000, light_max=100_000,
    #     soil_moisture_optimal=(55, 75), soil_moisture_dry=40, soil_moisture_wet=85,
    #     irrigate_below=50, irrigate_stop=72,
    #     growth_phases={1:0.3,2:0.4,3:0.6,4:0.9,5:1.0,6:0.9,
    #                    7:0.8,8:0.7,9:0.8,10:0.7,11:0.5,12:0.3},
    # ),
    # "lemon": PlantProfile(
    #     name="Lemon (Citrus limon)",
    #     temp_optimal=(15, 30), temp_stress_low=8, temp_stress_high=36,
    #     humidity_optimal=(45, 65),
    #     light_optimal=(15_000, 70_000), light_min=4_000, light_max=90_000,
    #     soil_moisture_optimal=(50, 70), soil_moisture_dry=38, soil_moisture_wet=82,
    #     irrigate_below=48, irrigate_stop=68,
    #     growth_phases={1:0.4,2:0.5,3:0.7,4:1.0,5:1.0,6:0.8,
    #                    7:0.7,8:0.6,9:0.7,10:0.6,11:0.5,12:0.4},
    # ),
    "olive": PlantProfile(
        name="Olive (Olea europaea)",
        temp_optimal=(15, 28), temp_stress_low=5, temp_stress_high=35,
        humidity_optimal=(40, 60),
        light_optimal=(25_000, 90_000), light_min=8_000, light_max=110_000,
        soil_moisture_optimal=(35, 55), soil_moisture_dry=25, soil_moisture_wet=70,
        irrigate_below=32, irrigate_stop=52,
        growth_phases={1:0.2,2:0.3,3:0.5,4:0.8,5:1.0,6:1.0,
                       7:0.9,8:0.8,9:0.7,10:0.5,11:0.3,12:0.2},
    ),
}

# ─────────────────────────────────────────────────────────────
# 3.  Open-Meteo weather fetcher
# ─────────────────────────────────────────────────────────────
OPEN_METEO_URL = "https://archive-api.open-meteo.com/v1/archive"

def fetch_weather(lat: float, lon: float,
                  start_date: str, end_date: str, tz: str = "UTC") -> dict:
    if not HAS_REQUESTS:
        raise ImportError("pip install requests")

    start  = datetime.strptime(start_date, "%Y-%m-%d")
    end    = datetime.strptime(end_date,   "%Y-%m-%d")
    merged: dict = {}
    cursor = start

    while cursor <= end:
        chunk_end = min(cursor + timedelta(days=364), end)
        params = {
            "latitude": lat, "longitude": lon,
            "start_date": cursor.strftime("%Y-%m-%d"),
            "end_date":   chunk_end.strftime("%Y-%m-%d"),
            "hourly": "temperature_2m,relativehumidity_2m,surface_pressure,"
                      "shortwave_radiation,precipitation,windspeed_10m,cloudcover",
            "timezone": tz,
        }
        print(f"  Fetching {params['start_date']} -> {params['end_date']} ...")
        for attempt in range(1, 4):
            try:
                r = requests.get(OPEN_METEO_URL, params=params, timeout=30)
                r.raise_for_status()
                chunk = r.json()["hourly"]
                if not merged:
                    merged = {k: list(v) for k, v in chunk.items()}
                else:
                    for k in merged:
                        merged[k].extend(chunk[k])
                break
            except Exception as e:
                if attempt == 3:
                    raise RuntimeError(
                        f"Fetch failed: {e}\nTip: use --demo for offline mode") from e
                time.sleep(2 ** attempt)
        cursor = chunk_end + timedelta(days=1)

    print(f"  Fetched {len(merged['time'])} hourly records "
          f"({len(merged['time'])//24} days)")
    return merged

# ─────────────────────────────────────────────────────────────
# 4.  Synthetic weather (demo / offline)
# ─────────────────────────────────────────────────────────────
def generate_synthetic_weather(start_date: str, n_hours: int,
                                base_temp: float = 21.0) -> dict:
    random.seed(0)
    start = datetime.strptime(start_date, "%Y-%m-%d")
    data: Dict[str, list] = {k: [] for k in [
        "time", "temperature_2m", "relativehumidity_2m",
        "surface_pressure", "shortwave_radiation",
        "precipitation", "windspeed_10m", "cloudcover"]}

    for i in range(n_hours):
        dt    = start + timedelta(hours=i)
        month = dt.month
        hour  = dt.hour
        seasonal = 8 * math.cos(math.pi * (month - 7) / 6)
        diurnal  = 7 * math.sin(math.pi * (hour  - 6) / 12)
        temp     = base_temp + seasonal + diurnal + random.gauss(0, 0.8)
        hum      = 55 - 0.5 * (temp - base_temp) + random.gauss(0, 4)
        cloud    = max(0, min(100, random.gauss(25, 20)))
        angle    = math.pi * (hour - 6) / 14 if 6 <= hour <= 20 else 0
        rad      = max(0, 900 * math.sin(angle) * (1 - cloud / 150))
        precip   = random.choices([0.0, random.uniform(0.1, 4.0)],
                                   weights=[0.94, 0.06])[0]
        data["time"].append(dt.strftime("%Y-%m-%dT%H:%M"))
        data["temperature_2m"].append(round(temp, 2))
        data["relativehumidity_2m"].append(round(max(10, min(99, hum)), 2))
        data["surface_pressure"].append(round(random.gauss(1013, 2.5), 2))
        data["shortwave_radiation"].append(round(max(0, rad), 1))
        data["precipitation"].append(round(precip, 2))
        data["windspeed_10m"].append(round(abs(random.gauss(3, 2)), 2))
        data["cloudcover"].append(round(cloud, 1))
    return data

# ─────────────────────────────────────────────────────────────
# 5.  Helper utilities
# ─────────────────────────────────────────────────────────────
def clamp(v, lo, hi):   return max(lo, min(hi, v))
def noise(v, pct=0.02): return v + random.gauss(0, abs(v) * pct + 1e-6)
def rad_to_lux(wm2):    return max(0.0, wm2 * 120)

# ─────────────────────────────────────────────────────────────
# 6.  Shared infrastructure sensors
# ─────────────────────────────────────────────────────────────
def sim_reservoir(prev_pct: float, total_flow_lpm: float,
                  precip_mm: float) -> float:
    """Shared tank drains with total irrigation; rain partially refills it."""
    drain  = total_flow_lpm * (1 / 60) * 0.15
    refill = precip_mm * 0.08
    manual = random.uniform(0, 0.5) if random.random() < 0.003 else 0
    return round(clamp(noise(prev_pct - drain + refill + manual, 0.005), 5, 100), 2)

def sim_main_pressure(reservoir_pct: float, any_valve_open: bool,
                       filter_status: int) -> float:
    """Main line pressure after the filter, shared by all zones."""
    base = 0.18 if any_valve_open else 0.05
    base *= (reservoir_pct / 100) ** 0.4
    clog_loss = filter_status * 0.03
    return round(clamp(base - clog_loss + random.gauss(0, 0.003), 0.0, 0.5), 4)

def sim_filter_status(prev: int, hour: int) -> int:
    """0=clean, 1=partial, 2=clogged. Operator cleans roughly at midnight."""
    if hour == 0 and random.random() < 0.6:
        return 0
    if prev < 2 and random.random() < 0.0015:
        return prev + 1
    return prev

# ─────────────────────────────────────────────────────────────
# 7.  Per-zone sensors
# ─────────────────────────────────────────────────────────────
def zone_needs_water(profile: PlantProfile, soil: float,
                      reservoir_pct: float, main_pressure: float,
                      filter_status: int) -> bool:
    if reservoir_pct  < 10:   return False   # tank dry
    if main_pressure  < 0.04: return False   # no pressure
    if filter_status == 2:    return False   # fully clogged
    return soil < profile.irrigate_below

def sim_zone_flow(valve_open: bool, main_pressure: float,
                   fault: bool) -> float:
    """Flow through the 8 mm HydroBloom drip line (L/min)."""
    if not valve_open:
        return 0.0
    base = 1.6 * math.sqrt(max(0, main_pressure / 0.18)) + random.gauss(0, 0.06)
    if fault:
        base = random.choice([0.0, base * random.uniform(2.0, 3.5)])
    return round(clamp(base, 0, 6), 3)

def sim_zone_pressure(valve_open: bool, main_pressure: float,
                       zone_flow: float, fault: bool) -> float:
    """Pressure at zone inlet, downstream of the zone valve."""
    if not valve_open:
        return round(clamp(noise(main_pressure * 0.95, 0.01), 0, 0.5), 4)
    drop = 0.015 * zone_flow
    val  = main_pressure - drop + random.gauss(0, 0.003)
    if fault:
        val *= random.choice([0.1, 2.5])
    return round(clamp(val, 0.0, 0.5), 4)

def sim_soil_moisture(prev: float, profile: PlantProfile,
                       valve_open: bool, temp: float,
                       rad: float, precip: float) -> float:
    et   = 0.10 + 0.007 * max(0, temp - 20) + 0.0003 * rad
    rain = min(precip * 1.4, 8.0)
    irr  = 3.0 if valve_open else 0.0
    return round(clamp(prev - et + rain + irr + random.gauss(0, 0.2), 5, 99), 2)

# ─────────────────────────────────────────────────────────────
# 8.  Labels
# ─────────────────────────────────────────────────────────────
def compute_stress(p: PlantProfile, temp, hum, lux, soil) -> float:
    s = 0.0
    if   temp < p.temp_stress_low:     s += min(1,(p.temp_stress_low-temp)/10)*0.30
    elif temp > p.temp_stress_high:    s += min(1,(temp-p.temp_stress_high)/10)*0.30
    if   hum  < p.humidity_optimal[0]: s += min(1,(p.humidity_optimal[0]-hum)/20)*0.15
    elif hum  > p.humidity_optimal[1]: s += min(1,(hum-p.humidity_optimal[1])/20)*0.15
    if   lux  < p.light_min:           s += min(1,(p.light_min-lux)/max(1,p.light_min))*0.25
    elif lux  > p.light_max:           s += min(1,(lux-p.light_max)/p.light_max)*0.15
    if   soil < p.soil_moisture_dry:   s += min(1,(p.soil_moisture_dry-soil)/20)*0.25
    elif soil > p.soil_moisture_wet:   s += min(1,(soil-p.soil_moisture_wet)/15)*0.20
    return round(clamp(s, 0, 1), 4)

def stress_class(score: float) -> str:
    if score < 0.10: return "none"
    if score < 0.30: return "mild"
    if score < 0.60: return "moderate"
    return "severe"

def compute_health(p: PlantProfile, temp, hum, lux, soil, month) -> float:
    s = compute_stress(p, temp, hum, lux, soil)
    g = p.growth_phases.get(month, 0.5)
    return round(clamp(noise((1 - s) * 8 + g * 2, 0.015), 0, 10), 2)

# ─────────────────────────────────────────────────────────────
# 9.  Main simulation loop
# ─────────────────────────────────────────────────────────────
def run_simulation(weather: dict,
                   n_zones: int = 4,
                   anomaly_rate: float = 0.03,
                   seed: int = 42) -> List[dict]:

    random.seed(seed)
    profile = PLANT_PROFILES["olive"]
    n_hours = len(weather["time"])

    # Shared persistent state
    reservoir  = random.uniform(70, 90)
    filter_st  = 0

    # Per-zone persistent state
    zone_soil  = {z: random.uniform(*profile.soil_moisture_optimal)
                  for z in range(1, n_zones + 1)}
    zone_irrig = {z: False for z in range(1, n_zones + 1)}
    zone_char  = {z: random.gauss(0, 2.5) for z in range(1, n_zones + 1)}

    records = []

    for i in range(n_hours):
        # Real weather
        raw_temp   = weather["temperature_2m"][i]
        raw_hum    = weather["relativehumidity_2m"][i]
        raw_pres   = weather["surface_pressure"][i]
        raw_rad    = max(0, weather["shortwave_radiation"][i] or 0)
        raw_precip = max(0, weather["precipitation"][i] or 0)
        raw_wind   = weather.get("windspeed_10m", [0]*n_hours)[i] or 0
        raw_cloud  = weather.get("cloudcover",    [0]*n_hours)[i] or 0

        dt_str = weather["time"][i]
        dt     = datetime.fromisoformat(dt_str)
        month  = dt.month
        hour   = dt.hour

        # Shared environmental sensors (outdoor, real values + sensor noise)
        temp  = round(clamp(noise(raw_temp,  0.01), -10,  60), 2)
        hum   = round(clamp(noise(raw_hum,   0.01),  10,  99), 2)
        pres  = round(clamp(noise(raw_pres, 0.002), 960, 1060), 2)
        lux   = round(rad_to_lux(raw_rad * max(0, 1 - raw_cloud / 100)), 1)

        # Filter degrades slowly
        filter_st = sim_filter_status(filter_st, hour)

        # Update valve states for each zone
        for z in range(1, n_zones + 1):
            if zone_needs_water(profile, zone_soil[z],
                                reservoir, 0.10, filter_st):
                zone_irrig[z] = True
            if zone_irrig[z] and zone_soil[z] >= profile.irrigate_stop:
                zone_irrig[z] = False

        # Shared water infrastructure
        any_open      = any(zone_irrig.values())
        main_pressure = sim_main_pressure(reservoir, any_open, filter_st)

        # Per-zone simulation
        total_flow = 0.0
        for z in range(1, n_zones + 1):
            anomaly    = random.random() < anomaly_rate
            valve_open = zone_irrig[z]

            z_flow = sim_zone_flow(valve_open, main_pressure, anomaly)
            z_pres = sim_zone_pressure(valve_open, main_pressure, z_flow, anomaly)
            total_flow += z_flow

            soil = sim_soil_moisture(
                zone_soil[z] + zone_char[z] * 0.05,
                profile, valve_open, temp, raw_rad, raw_precip
            )
            zone_soil[z] = soil

            s_score  = compute_stress(profile, temp, hum, lux, soil)
            h_score  = compute_health(profile, temp, hum, lux, soil, month)
            irr_need = 1 if zone_needs_water(
                profile, soil, reservoir, z_pres, filter_st) else 0

            records.append({
                # Identity
                "timestamp":             dt_str,
                "month":                 month,
                "hour":                  hour,
                "zone_id":               z,
                "plant_type":            "olive",
                "plant_species":         profile.name,

                # Shared environmental sensors
                "air_temperature_c":     temp,
                "air_humidity_pct":      hum,
                "air_pressure_hpa":      pres,
                "light_intensity_lux":   lux,

                # Shared water infrastructure sensors
                "reservoir_level_pct":   round(reservoir, 2),
                "main_pressure_mpa":     main_pressure,
                "filter_status":         filter_st,       # 0=clean 1=partial 2=clogged

                # Per-zone water sensors
                "valve_open":            int(valve_open),
                "zone_flow_lpm":         z_flow,
                "zone_pressure_mpa":     z_pres,

                # Per-zone soil sensor
                "soil_moisture_pct":     soil,

                # Weather context
                "solar_radiation_wm2":   round(raw_rad,    2),
                "precipitation_mm":      round(raw_precip, 3),
                "wind_speed_kmh":        round(raw_wind,   2),
                "cloud_cover_pct":       round(raw_cloud,  1),

                # Flags
                "is_anomaly":            int(anomaly),

                # Training labels
                "stress_score":          s_score,
                "stress_class":          stress_class(s_score),
                "health_score":          h_score,
                "irrigation_needed":     irr_need,
            })

        # Update shared reservoir after all zones consumed water this step
        reservoir = sim_reservoir(reservoir, total_flow, raw_precip)

    return records

# ─────────────────────────────────────────────────────────────
# 10.  Export
# ─────────────────────────────────────────────────────────────
def save_csv(records, path):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=records[0].keys())
        writer.writeheader()
        writer.writerows(records)
    print(f"[OK] CSV  -> {path}  ({len(records):,} rows)")

def save_json(records, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
    print(f"[OK] JSON -> {path}  ({len(records):,} rows)")

def save_dataset_info(records: List[dict], path: str, meta: dict) -> None:
    """
    Write a detailed JSON report describing the generated dataset.

    Sections
    --------
    generation_config   -- parameters used to produce this dataset
    overview            -- row/zone/timestep counts, date range, column list
    columns             -- type, description, unit and value range per column
    statistics          -- min/p25/median/mean/p75/p95/max/std per numeric column
    label_distributions -- class counts for every categorical target column
    per_zone_summary    -- per-zone soil, flow, valve and stress breakdown
    monthly_profile     -- monthly averages for key weather + plant columns
    anomaly_report      -- count and rate of flagged anomalous readings
    sensor_descriptions -- sensor model linked to each column group
    """

    n       = len(records)
    columns = list(records[0].keys())
    zones   = sorted(set(r["zone_id"] for r in records))
    times   = [r["timestamp"] for r in records]

    # ── column catalogue ─────────────────────────────────────
    COLUMN_META = {
        "timestamp":            ("datetime", "ISO-8601 timestamp of the reading",            "--"),
        "month":                ("int",      "Calendar month (1-12)",                        "month"),
        "hour":                 ("int",      "Hour of day (0-23)",                           "h"),
        "zone_id":              ("int",      "Irrigation zone identifier",                   "--"),
        "plant_type":           ("str",      "Plant type key",                               "--"),
        "plant_species":        ("str",      "Full scientific species name",                 "--"),
        "air_temperature_c":    ("float",    "Outdoor air temperature (BME280)",             "C"),
        "air_humidity_pct":     ("float",    "Outdoor relative humidity (BME280/DHT11)",     "%"),
        "air_pressure_hpa":     ("float",    "Atmospheric pressure (BME280)",                "hPa"),
        "light_intensity_lux":  ("float",    "Ambient light intensity (BH1750)",             "lux"),
        "reservoir_level_pct":  ("float",    "Water tank fill level (HC-SR04 ultrasonic)",   "%"),
        "main_pressure_mpa":    ("float",    "Main line pressure after filter",              "MPa"),
        "filter_status":        ("int",      "Filter clog state: 0=clean 1=partial 2=clogged","--"),
        "valve_open":           ("int",      "Zone valve state: 0=closed 1=open",            "--"),
        "zone_flow_lpm":        ("float",    "Drip line flow rate (YF-S201)",                "L/min"),
        "zone_pressure_mpa":    ("float",    "Zone inlet pressure (0-0.5 MPa sensor)",       "MPa"),
        "soil_moisture_pct":    ("float",    "Soil volumetric moisture (capacitive sensor)", "%"),
        "solar_radiation_wm2":  ("float",    "Solar shortwave radiation (Open-Meteo API)",   "W/m2"),
        "precipitation_mm":     ("float",    "Hourly rainfall (Open-Meteo API)",             "mm"),
        "wind_speed_kmh":       ("float",    "Wind speed at 10 m (Open-Meteo API)",          "km/h"),
        "cloud_cover_pct":      ("float",    "Cloud cover fraction (Open-Meteo API)",        "%"),
        "is_anomaly":           ("int",      "Simulated sensor fault flag (0/1)",            "--"),
        "stress_score":         ("float",    "Plant stress index: 0=none to 1=severe",       "--"),
        "stress_class":         ("str",      "Stress category: none/mild/moderate/severe",   "--"),
        "health_score":         ("float",    "Plant health index: 0=poor to 10=perfect",     "--"),
        "irrigation_needed":    ("int",      "Controller decision: 1=irrigate now (0/1)",    "--"),
    }

    col_info = {}
    for col in columns:
        dtype, desc, unit = COLUMN_META.get(col, ("unknown", col, "--"))
        entry = {"type": dtype, "description": desc, "unit": unit}
        if dtype == "float":
            vals = [r[col] for r in records]
            entry["min"] = round(min(vals), 4)
            entry["max"] = round(max(vals), 4)
        elif dtype == "int" and col not in ("month", "hour", "zone_id"):
            vals = [r[col] for r in records]
            entry["min"] = int(min(vals))
            entry["max"] = int(max(vals))
        col_info[col] = entry

    # ── numeric statistics ────────────────────────────────────
    numeric_cols = [c for c in columns
                    if COLUMN_META.get(c, ("?",))[0] == "float"]

    def col_stats(col):
        vals = sorted(r[col] for r in records)
        n_v  = len(vals)
        mean = sum(vals) / n_v
        std  = math.sqrt(sum((v - mean) ** 2 for v in vals) / n_v)
        def pct(p): return vals[int(p / 100 * (n_v - 1))]
        return {
            "min":    round(vals[0],  4),
            "p25":    round(pct(25),  4),
            "median": round(pct(50),  4),
            "mean":   round(mean,     4),
            "p75":    round(pct(75),  4),
            "p95":    round(pct(95),  4),
            "max":    round(vals[-1], 4),
            "std":    round(std,      4),
        }

    statistics = {col: col_stats(col) for col in numeric_cols}

    # ── label distributions ───────────────────────────────────
    def distribution(col):
        counts: dict = {}
        for r in records:
            k = str(r[col])
            counts[k] = counts.get(k, 0) + 1
        return {k: {"count": v, "pct": round(v / n * 100, 2)}
                for k, v in sorted(counts.items())}

    label_distributions = {
        "stress_class":      distribution("stress_class"),
        "irrigation_needed": distribution("irrigation_needed"),
        "valve_open":        distribution("valve_open"),
        "filter_status":     distribution("filter_status"),
        "is_anomaly":        distribution("is_anomaly"),
    }

    # ── per-zone summary ──────────────────────────────────────
    per_zone = {}
    for z in zones:
        zr = [r for r in records if r["zone_id"] == z]
        nz = len(zr)
        def zavg(col): return round(sum(r[col] for r in zr) / nz, 3)
        def zmin(col): return round(min(r[col] for r in zr), 3)
        def zmax(col): return round(max(r[col] for r in zr), 3)
        irr_open = sum(r["valve_open"]        for r in zr)
        irr_need = sum(r["irrigation_needed"] for r in zr)
        sc: dict = {}
        for r in zr:
            sc[r["stress_class"]] = sc.get(r["stress_class"], 0) + 1
        per_zone[f"zone_{z}"] = {
            "total_readings":          nz,
            "soil_moisture_pct":       {"min": zmin("soil_moisture_pct"),
                                        "avg": zavg("soil_moisture_pct"),
                                        "max": zmax("soil_moisture_pct")},
            "zone_flow_lpm":           {"min": zmin("zone_flow_lpm"),
                                        "avg": zavg("zone_flow_lpm"),
                                        "max": zmax("zone_flow_lpm")},
            "zone_pressure_mpa":       {"min": zmin("zone_pressure_mpa"),
                                        "avg": zavg("zone_pressure_mpa"),
                                        "max": zmax("zone_pressure_mpa")},
            "stress_score_avg":        zavg("stress_score"),
            "health_score_avg":        zavg("health_score"),
            "valve_open_count":        irr_open,
            "valve_open_pct":          round(irr_open / nz * 100, 2),
            "irrigation_needed_count": irr_need,
            "stress_class_distribution": sc,
        }

    # ── monthly profile ───────────────────────────────────────
    monthly = {}
    for m in range(1, 13):
        mr = [r for r in records if r["month"] == m]
        if not mr:
            continue
        nm = len(mr)
        def mavg(col): return round(sum(r[col] for r in mr) / nm, 3)
        monthly[f"month_{m:02d}"] = {
            "readings":              nm,
            "avg_temperature_c":     mavg("air_temperature_c"),
            "avg_humidity_pct":      mavg("air_humidity_pct"),
            "avg_light_lux":         mavg("light_intensity_lux"),
            "avg_soil_moisture_pct": mavg("soil_moisture_pct"),
            "avg_stress_score":      mavg("stress_score"),
            "avg_health_score":      mavg("health_score"),
            "total_precipitation_mm": round(
                sum(r["precipitation_mm"] for r in mr), 2),
            "valve_open_pct":        round(
                sum(r["valve_open"] for r in mr) / nm * 100, 2),
        }

    # ── sensor group descriptions ─────────────────────────────
    sensor_descriptions = {
        "environmental": {
            "sensors": ["BME280", "DHT11", "BH1750"],
            "columns": ["air_temperature_c", "air_humidity_pct",
                        "air_pressure_hpa", "light_intensity_lux"],
            "scope":   "shared -- one reading per timestep across all zones",
        },
        "water_infrastructure": {
            "sensors": ["HC-SR04 ultrasonic", "0-0.5 MPa pressure sensor",
                        "filter inspection"],
            "columns": ["reservoir_level_pct", "main_pressure_mpa", "filter_status"],
            "scope":   "shared -- common reservoir, filter and main line",
        },
        "zone_water": {
            "sensors": ["YF-S201 flow sensor", "0-0.5 MPa zone pressure sensor",
                        "zone solenoid valve"],
            "columns": ["valve_open", "zone_flow_lpm", "zone_pressure_mpa"],
            "scope":   "per-zone -- independent reading on each drip line",
        },
        "zone_soil": {
            "sensors": ["Capacitive soil moisture sensor"],
            "columns": ["soil_moisture_pct"],
            "scope":   "per-zone -- buried sensor in each irrigation plot",
        },
        "weather_context": {
            "sensors": ["Open-Meteo Archive API (real historical weather)"],
            "columns": ["solar_radiation_wm2", "precipitation_mm",
                        "wind_speed_kmh", "cloud_cover_pct"],
            "scope":   "shared -- raw outdoor weather driving the simulation",
        },
    }

    # ── assemble full report ──────────────────────────────────
    report = {
        "generation_config":   meta,
        "overview": {
            "total_rows":      n,
            "n_zones":         len(zones),
            "zone_ids":        zones,
            "timesteps":       n // len(zones),
            "date_range":      {"start": min(times), "end": max(times)},
            "columns_count":   len(columns),
            "columns":         columns,
            "plant":           records[0]["plant_species"],
            "anomaly_rate_pct": round(
                sum(r["is_anomaly"] for r in records) / n * 100, 2),
        },
        "columns":             col_info,
        "statistics":          statistics,
        "label_distributions": label_distributions,
        "per_zone_summary":    per_zone,
        "monthly_profile":     monthly,
        "sensor_descriptions": sensor_descriptions,
    }

    with open(path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"[OK] INFO -> {path}")


def print_summary(records, label, n_zones):
    n = len(records)
    print(f"\n-- Summary: {label} -- {n_zones} zones")
    print(f"   Total rows          : {n:,}  ({n//n_zones:,} timesteps x {n_zones} zones)")
    for col in ["air_temperature_c", "air_humidity_pct", "light_intensity_lux",
                "reservoir_level_pct", "main_pressure_mpa",
                "soil_moisture_pct", "zone_flow_lpm", "zone_pressure_mpa",
                "stress_score", "health_score"]:
        vals = [r[col] for r in records]
        print(f"   {col:<28}: min={min(vals):8.2f}  max={max(vals):8.2f}  "
              f"avg={sum(vals)/n:8.2f}")
    irr  = sum(r["irrigation_needed"] for r in records)
    valv = sum(r["valve_open"]        for r in records)
    anom = sum(r["is_anomaly"]        for r in records)
    print(f"   Irrigation needed   : {irr:,}  ({irr/n*100:.1f}%)")
    print(f"   Valve open events   : {valv:,}  ({valv/n*100:.1f}%)")
    print(f"   Anomaly readings    : {anom:,}  ({anom/n*100:.1f}%)")
    sc: Dict[str, int] = {}
    for r in records:
        sc[r["stress_class"]] = sc.get(r["stress_class"], 0) + 1
    print(f"   Stress classes      : {sc}")
    fs: Dict[int, int] = {}
    for r in records:
        k = r["filter_status"]
        fs[k] = fs.get(k, 0) + 1
    print(f"   Filter status 0/1/2 : {fs}")
    print("-" * 60)

# ─────────────────────────────────────────────────────────────
# 11.  CLI
# ─────────────────────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────
# 11. CLI
# ─────────────────────────────────────────────────────────────
def run_stream(args):
    import sys
    random.seed(args.seed)
    profile = PLANT_PROFILES["olive"]

    reservoir = random.uniform(70, 90)
    filter_st = 0
    zone_soil = {z: random.uniform(*profile.soil_moisture_optimal)
                 for z in range(1, args.zones + 1)}
    zone_irrig = {z: False for z in range(1, args.zones + 1)}
    zone_char = {z: random.gauss(0, 2.5) for z in range(1, args.zones + 1)}

    start_time = datetime.now()
    step = 0

    print(f"[IoT Stream] Starting simulation with {args.zones} zones, "
          f"interval={args.stream_interval}s", file=sys.stderr)
    print(f"[IoT Stream] Press Ctrl+C to stop", file=sys.stderr)

    try:
        while True:
            elapsed = step * args.stream_interval
            dt = start_time + timedelta(seconds=elapsed)
            dt_str = dt.strftime("%Y-%m-%dT%H:%M")
            month = dt.month
            hour = dt.hour

            hour_of_year = int(elapsed // 3600) % (24 * 365)
            seasonal = 8 * math.cos(math.pi * (month - 7) / 6)
            diurnal = 7 * math.sin(math.pi * (hour - 6) / 12)
            base_temp = 21.0
            raw_temp = base_temp + seasonal + diurnal + random.gauss(0, 0.8)
            raw_hum = 55 - 0.5 * (raw_temp - base_temp) + random.gauss(0, 4)
            raw_pres = random.gauss(1013, 2.5)
            cloud = max(0, min(100, random.gauss(25, 20)))
            angle = math.pi * (hour - 6) / 14 if 6 <= hour <= 20 else 0
            raw_rad = max(0, 900 * math.sin(angle) * (1 - cloud / 150))
            raw_precip = random.choices([0.0, random.uniform(0.1, 4.0)],
                                         weights=[0.94, 0.06])[0]
            raw_wind = abs(random.gauss(3, 2))

            temp = round(clamp(noise(raw_temp, 0.01), -10, 60), 2)
            hum = round(clamp(noise(raw_hum, 0.01), 10, 99), 2)
            pres = round(clamp(noise(raw_pres, 0.002), 960, 1060), 2)
            lux = round(rad_to_lux(raw_rad * max(0, 1 - cloud / 100)), 1)

            filter_st = sim_filter_status(filter_st, hour)

            for z in range(1, args.zones + 1):
                if zone_needs_water(profile, zone_soil[z], reservoir, 0.10, filter_st):
                    zone_irrig[z] = True
                if zone_irrig[z] and zone_soil[z] >= profile.irrigate_stop:
                    zone_irrig[z] = False

            any_open = any(zone_irrig.values())
            main_pressure = sim_main_pressure(reservoir, any_open, filter_st)

            total_flow = 0.0
            readings = []
            for z in range(1, args.zones + 1):
                anomaly = random.random() < args.anomaly_rate
                valve_open = zone_irrig[z]

                z_flow = sim_zone_flow(valve_open, main_pressure, anomaly)
                z_pres = sim_zone_pressure(valve_open, main_pressure, z_flow, anomaly)
                total_flow += z_flow

                soil = sim_soil_moisture(
                    zone_soil[z] + zone_char[z] * 0.05,
                    profile, valve_open, temp, raw_rad, raw_precip
                )
                zone_soil[z] = soil

                s_score = compute_stress(profile, temp, hum, lux, soil)
                h_score = compute_health(profile, temp, hum, lux, soil, month)
                irr_need = 1 if zone_needs_water(profile, soil, reservoir, z_pres, filter_st) else 0

                reading = {
                    "timestamp": dt_str,
                    "month": month,
                    "hour": hour,
                    "zone_id": z,
                    "plant_type": "olive",
                    "plant_species": profile.name,
                    "air_temperature_c": temp,
                    "air_humidity_pct": hum,
                    "air_pressure_hpa": pres,
                    "light_intensity_lux": lux,
                    "reservoir_level_pct": round(reservoir, 2),
                    "main_pressure_mpa": main_pressure,
                    "filter_status": filter_st,
                    "valve_open": int(valve_open),
                    "zone_flow_lpm": z_flow,
                    "zone_pressure_mpa": z_pres,
                    "soil_moisture_pct": soil,
                    "solar_radiation_wm2": round(raw_rad, 2),
                    "precipitation_mm": round(raw_precip, 3),
                    "wind_speed_kmh": round(raw_wind, 2),
                    "cloud_cover_pct": round(cloud, 1),
                    "is_anomaly": int(anomaly),
                    "stress_score": s_score,
                    "stress_class": stress_class(s_score),
                    "health_score": h_score,
                    "irrigation_needed": irr_need,
                }
                readings.append(reading)

                if args.stream_json:
                    print(json.dumps(reading))
                else:
                    print(f"[{dt_str}] Zone {z}: temp={temp}C, soil={soil}%, "
                          f"valve={'ON' if valve_open else 'OFF'}, "
                          f"flow={z_flow}L/min, stress={s_score:.3f}")

            reservoir = sim_reservoir(reservoir, total_flow, raw_precip)
            step += 1
            time.sleep(args.stream_interval)

    except KeyboardInterrupt:
        print("\n[IoT Stream] Stopped", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(
        description="Multi-zone outdoor olive farm drip irrigation simulation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--location", choices=list(LOCATIONS.keys()), default="agadir")
    parser.add_argument("--lat",      type=float)
    parser.add_argument("--lon",      type=float)
    parser.add_argument("--timezone", type=str, default="UTC")
    parser.add_argument("--start",    default="2023-01-01")
    parser.add_argument("--end",      default="2023-12-31")
    parser.add_argument("--zones",    type=int, default=4,
                        help="Number of irrigation zones (default: 4)")
    parser.add_argument("--demo",     action="store_true",
                        help="Use synthetic weather (no internet needed)")
    parser.add_argument("--rows",     type=int, default=2000,
                        help="Hours to simulate in demo mode (default: 2000)")
    parser.add_argument("--output",   default="olive_simulation_weather.csv")
    parser.add_argument("--json",     action="store_true")
    parser.add_argument("--anomaly-rate", type=float, default=0.03)
    parser.add_argument("--seed",     type=int, default=42)
    parser.add_argument("--stream",   action="store_true",
                        help="Run in streaming mode (continuous IoT data stream)")
    parser.add_argument("--stream-interval", type=float, default=1.0,
                        help="Seconds between readings in stream mode (default: 1.0)")
    parser.add_argument("--stream-json", action="store_true",
                        help="Output JSON to stdout in stream mode")

    args = parser.parse_args()

    if args.stream:
        run_stream(args)
        return

    if args.lat and args.lon:
        lat, lon, tz = args.lat, args.lon, args.timezone
        label = f"{lat:.2f}N, {lon:.2f}E"
    else:
        loc   = LOCATIONS[args.location]
        lat, lon, tz = loc["lat"], loc["lon"], loc["tz"]
        label = loc["label"]

    print(f"Location  : {label}  ({lat}, {lon})")
    print(f"Zones     : {args.zones}")
    print(f"Plant     : Olive only")

    if args.demo:
        print(f"Demo mode : generating {args.rows} synthetic hourly records ...")
        weather = generate_synthetic_weather(args.start, args.rows)
    else:
        print(f"Fetching weather {args.start} -> {args.end} ...")
        weather = fetch_weather(lat, lon, args.start, args.end, tz)

    print("Simulating farm ...")
    records = run_simulation(weather,
                             n_zones=args.zones,
                             anomaly_rate=args.anomaly_rate,
                             seed=args.seed)

    print_summary(records, label, args.zones)
    save_csv(records, args.output)
    if args.json:
        save_json(records, args.output.replace(".csv", ".json"))

    # Always generate the dataset info report
    info_path = args.output.replace(".csv", "_info.json")
    meta = {
        "location":     label,
        "latitude":     lat,
        "longitude":    lon,
        "start_date":   args.start,
        "end_date":     args.end,
        "n_zones":      args.zones,
        "anomaly_rate": args.anomaly_rate,
        "seed":         args.seed,
        "demo_mode":    args.demo,
        "weather_source": "synthetic (demo)" if args.demo
                          else "Open-Meteo Archive API",
        "generated_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "output_csv":   args.output,
    }
    save_dataset_info(records, info_path, meta)


if __name__ == "__main__":
    main()