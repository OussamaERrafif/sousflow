"""
IoT Simulator Service — Realistic sensor data for olive farms in Agadir, Morocco
=================================================================================
Uses real current time, Agadir climate patterns, and time-scaled physics.
Each reading uses datetime.now() so timestamps are real.
Weather follows seasonal (month) and diurnal (hour) cycles specific to Agadir.
All physical processes (soil moisture loss, reservoir drain, etc.) are scaled
to the actual time elapsed between readings.
"""
import asyncio
import math
import random
from datetime import datetime
from typing import Dict, List, Optional

from app.logging_config import logger
from app.supabase_client import get_supabase_admin
from app.services.iot_service import ingest_batch, check_alert_rules

# ── Agadir climate baseline (monthly averages) ──────────────────
# Source: historical climate data for Agadir, Morocco (30.42°N, -9.60°W)
# temp_avg, temp_range (diurnal swing), humidity_avg, precip_chance, cloud_avg
AGADIR_MONTHLY = {
    1:  {"temp": 13.5, "swing": 6.0, "hum": 72, "precip_chance": 0.12, "cloud": 40},
    2:  {"temp": 14.5, "swing": 6.5, "hum": 68, "precip_chance": 0.10, "cloud": 38},
    3:  {"temp": 16.0, "swing": 7.0, "hum": 65, "precip_chance": 0.08, "cloud": 35},
    4:  {"temp": 17.5, "swing": 7.0, "hum": 62, "precip_chance": 0.05, "cloud": 30},
    5:  {"temp": 19.5, "swing": 7.5, "hum": 60, "precip_chance": 0.03, "cloud": 25},
    6:  {"temp": 21.5, "swing": 8.0, "hum": 58, "precip_chance": 0.01, "cloud": 15},
    7:  {"temp": 24.0, "swing": 8.5, "hum": 55, "precip_chance": 0.005, "cloud": 10},
    8:  {"temp": 24.5, "swing": 8.5, "hum": 58, "precip_chance": 0.005, "cloud": 12},
    9:  {"temp": 23.0, "swing": 7.5, "hum": 62, "precip_chance": 0.02, "cloud": 18},
    10: {"temp": 20.5, "swing": 7.0, "hum": 65, "precip_chance": 0.06, "cloud": 28},
    11: {"temp": 17.0, "swing": 6.5, "hum": 68, "precip_chance": 0.10, "cloud": 35},
    12: {"temp": 14.0, "swing": 6.0, "hum": 72, "precip_chance": 0.12, "cloud": 42},
}

# Sunrise/sunset hours by month for Agadir (~30°N)
AGADIR_SUN = {
    1:  (7.5, 17.8),  2: (7.2, 18.3),  3:  (6.7, 18.7),  4:  (6.2, 19.2),
    5:  (5.8, 19.6),  6: (5.6, 19.9),   7:  (5.7, 19.9),  8:  (6.0, 19.5),
    9:  (6.4, 18.9),  10: (6.8, 18.2), 11: (7.2, 17.7), 12: (7.5, 17.5),
}

OLIVE_PROFILE = {
    "name": "Olive (Olea europaea)",
    "temp_optimal": (15, 28),
    "temp_stress_low": 5,
    "temp_stress_high": 35,
    "humidity_optimal": (40, 60),
    "light_optimal": (25000, 90000),
    "light_min": 8000,
    "light_max": 110000,
    "soil_moisture_optimal": (35, 55),
    "soil_moisture_dry": 25,
    "soil_moisture_wet": 70,
    "irrigate_below": 32,
    "irrigate_stop": 52,
    "growth_phases": {1: 0.2, 2: 0.3, 3: 0.5, 4: 0.8, 5: 1.0, 6: 1.0,
                      7: 0.9, 8: 0.8, 9: 0.7, 10: 0.5, 11: 0.3, 12: 0.2},
}


class IoTSimulator:
    def __init__(
        self,
        farm_id: str,
        n_zones: int = 4,
        interval_seconds: float = 300.0,
        anomaly_rate: float = 0.03,
        seed: int = 42,
    ):
        self.farm_id = farm_id
        self.n_zones = n_zones
        self.interval = interval_seconds
        self.anomaly_rate = anomaly_rate
        self.seed = seed
        self.running = False
        self.task: Optional[asyncio.Task] = None

        random.seed(seed)
        self.profile = OLIVE_PROFILE

        # Persistent state
        self.reservoir = random.uniform(70, 90)
        self.filter_st = 0
        self.zone_soil = {z: random.uniform(*self.profile["soil_moisture_optimal"])
                         for z in range(1, n_zones + 1)}
        self.zone_irrig = {z: False for z in range(1, n_zones + 1)}
        # Per-zone soil characteristic offset (some zones drain faster/slower)
        self.zone_char = {z: random.gauss(0, 2.5) for z in range(1, n_zones + 1)}
        # Weather continuity state — smoothed values to avoid jumps
        self._prev_cloud: Optional[float] = None
        self._prev_pressure: float = 1013.0
        self._prev_wind: float = 3.0
        self._last_readings: list = []
        self._injected_anomalies: Dict[int, dict] = {}
        self.step = 0

    # ── Utilities ────────────────────────────────────────────────

    def clamp(self, v, lo, hi):
        return max(lo, min(hi, v))

    def noise(self, v, pct=0.02):
        return v + random.gauss(0, abs(v) * pct + 1e-6)

    def smooth(self, prev, target, alpha=0.3):
        """Exponential smoothing to avoid abrupt value jumps."""
        return prev + alpha * (target - prev) + random.gauss(0, abs(target - prev) * 0.05 + 0.01)

    def rad_to_lux(self, wm2):
        return max(0.0, wm2 * 120)

    # ── Time-scaled factor ───────────────────────────────────────
    # All rates in the physics model are calibrated for 1-hour steps.
    # This factor scales them to the actual interval.

    @property
    def time_scale(self) -> float:
        """Scale factor: interval_seconds / 3600 (rates are per-hour)."""
        return self.interval / 3600.0

    # ── Agadir weather model ─────────────────────────────────────

    def generate_weather(self, dt: datetime) -> dict:
        """
        Generate realistic weather for the current moment in Agadir.
        Uses monthly climate baselines with smooth diurnal cycles.
        """
        month = dt.month
        hour = dt.hour + dt.minute / 60.0
        climate = AGADIR_MONTHLY[month]
        sunrise, sunset = AGADIR_SUN[month]

        # Temperature: smooth diurnal curve
        # Peak around 14:00-15:00, trough around sunrise
        temp_min = climate["temp"] - climate["swing"] / 2
        temp_max = climate["temp"] + climate["swing"] / 2
        # Sinusoidal: min at sunrise, max at ~14:30
        peak_hour = 14.5
        phase = 2 * math.pi * (hour - (sunrise - 2)) / 24.0
        temp_frac = 0.5 * (1 - math.cos(phase))  # 0..1
        # Shift so peak aligns with ~14:30
        peak_phase = 2 * math.pi * (peak_hour - (sunrise - 2)) / 24.0
        peak_frac = 0.5 * (1 - math.cos(peak_phase))
        if peak_frac > 0:
            temp_frac = min(1.0, temp_frac / peak_frac)
        raw_temp = temp_min + (temp_max - temp_min) * temp_frac
        raw_temp += random.gauss(0, 0.4)  # small natural variation

        # Humidity: inverse of temperature (higher at night, lower midday)
        base_hum = climate["hum"]
        hum_swing = 15  # +/- from base across day
        raw_hum = base_hum + hum_swing * (1 - temp_frac) - hum_swing * temp_frac * 0.3
        raw_hum += random.gauss(0, 2.0)

        # Pressure: slow drift with small random walk
        self._prev_pressure = self.smooth(self._prev_pressure, 1013.0 + random.gauss(0, 1.5), 0.1)
        raw_pres = self._prev_pressure

        # Cloud cover: smoothed, higher chance of clouds in winter months
        target_cloud = climate["cloud"] + random.gauss(0, 10)
        target_cloud = self.clamp(target_cloud, 0, 100)
        if self._prev_cloud is None:
            self._prev_cloud = target_cloud
        self._prev_cloud = self.smooth(self._prev_cloud, target_cloud, 0.15)
        cloud = self.clamp(self._prev_cloud, 0, 100)

        # Solar radiation: based on sun angle and cloud cover
        if sunrise <= hour <= sunset:
            day_frac = (hour - sunrise) / (sunset - sunrise)
            sun_angle = math.pi * day_frac
            # Peak radiation ~900 W/m² at solar noon in Agadir
            peak_rad = 850 + 100 * math.sin(math.pi * (month - 3) / 6)  # higher in summer
            raw_rad = peak_rad * math.sin(sun_angle) * (1 - cloud / 150)
        else:
            raw_rad = 0.0
        raw_rad = max(0.0, raw_rad)

        # Precipitation: realistic for Agadir (very dry in summer, some rain in winter)
        precip_chance = climate["precip_chance"]
        if cloud > 60:
            precip_chance *= 2.0  # more likely when cloudy
        if random.random() < precip_chance * self.time_scale:
            raw_precip = random.uniform(0.1, 3.0) * (cloud / 50)
        else:
            raw_precip = 0.0

        # Wind: smoothed random walk, slightly higher in afternoon
        wind_base = 3.0 + 2.0 * temp_frac  # windier midday
        self._prev_wind = self.smooth(self._prev_wind, wind_base, 0.2)
        raw_wind = max(0, self._prev_wind + random.gauss(0, 0.3))

        return {
            "temp": raw_temp,
            "hum": raw_hum,
            "pres": raw_pres,
            "cloud": cloud,
            "rad": raw_rad,
            "precip": raw_precip,
            "wind": raw_wind,
        }

    # ── Infrastructure simulation ────────────────────────────────

    def sim_reservoir(self, prev_pct, total_flow_lpm, precip_mm):
        """Reservoir drains with irrigation flow, refills with rain. Time-scaled."""
        drain = total_flow_lpm * self.time_scale * 0.15
        refill = precip_mm * 0.08
        # Occasional manual refill (scaled to interval)
        manual = random.uniform(0, 0.5) if random.random() < 0.003 * self.time_scale else 0
        return round(self.clamp(self.noise(prev_pct - drain + refill + manual, 0.003), 5, 100), 2)

    def sim_main_pressure(self, reservoir_pct, any_valve_open, filter_status):
        base = 0.18 if any_valve_open else 0.05
        base *= (reservoir_pct / 100) ** 0.4
        clog_loss = filter_status * 0.03
        return round(self.clamp(base - clog_loss + random.gauss(0, 0.002), 0.0, 0.5), 4)

    def sim_filter_status(self, prev, hour):
        """Filter degrades slowly, cleaned roughly at midnight. Time-scaled."""
        if 0 <= hour < 1 and random.random() < 0.6 * self.time_scale:
            return 0
        if prev < 2 and random.random() < 0.0015 * self.time_scale:
            return prev + 1
        return prev

    def zone_needs_water(self, soil, reservoir_pct, main_pressure, filter_status):
        if reservoir_pct < 10:
            return False
        if main_pressure < 0.04:
            return False
        if filter_status == 2:
            return False
        return soil < self.profile["irrigate_below"]

    def sim_zone_flow(self, valve_open, main_pressure, fault):
        if not valve_open:
            return 0.0
        base = 1.6 * math.sqrt(max(0, main_pressure / 0.18)) + random.gauss(0, 0.04)
        if fault:
            base = random.choice([0.0, base * random.uniform(2.0, 3.5)])
        return round(self.clamp(base, 0, 6), 3)

    def sim_zone_pressure(self, valve_open, main_pressure, zone_flow, fault):
        if not valve_open:
            return round(self.clamp(self.noise(main_pressure * 0.95, 0.008), 0, 0.5), 4)
        drop = 0.015 * zone_flow
        val = main_pressure - drop + random.gauss(0, 0.002)
        if fault:
            val *= random.choice([0.1, 2.5])
        return round(self.clamp(val, 0.0, 0.5), 4)

    def sim_soil_moisture(self, prev, valve_open, temp, rad, precip):
        """
        Soil moisture dynamics, time-scaled.
        ET (evapotranspiration) and irrigation gains are per-hour rates.
        """
        ts = self.time_scale
        et = (0.10 + 0.007 * max(0, temp - 20) + 0.0003 * rad) * ts
        rain = min(precip * 1.4, 8.0)  # precip is already time-scaled from weather
        irr = (3.0 * ts) if valve_open else 0.0
        return round(self.clamp(prev - et + rain + irr + random.gauss(0, 0.1 * ts), 5, 99), 2)

    # ── Plant stress / health ────────────────────────────────────

    def compute_stress(self, temp, hum, lux, soil):
        p = self.profile
        s = 0.0
        if temp < p["temp_stress_low"]:
            s += min(1, (p["temp_stress_low"] - temp) / 10) * 0.30
        elif temp > p["temp_stress_high"]:
            s += min(1, (temp - p["temp_stress_high"]) / 10) * 0.30
        if hum < p["humidity_optimal"][0]:
            s += min(1, (p["humidity_optimal"][0] - hum) / 20) * 0.15
        elif hum > p["humidity_optimal"][1]:
            s += min(1, (hum - p["humidity_optimal"][1]) / 20) * 0.15
        if lux < p["light_min"]:
            s += min(1, (p["light_min"] - lux) / max(1, p["light_min"])) * 0.25
        elif lux > p["light_max"]:
            s += min(1, (lux - p["light_max"]) / p["light_max"]) * 0.15
        if soil < p["soil_moisture_dry"]:
            s += min(1, (p["soil_moisture_dry"] - soil) / 20) * 0.25
        elif soil > p["soil_moisture_wet"]:
            s += min(1, (soil - p["soil_moisture_wet"]) / 15) * 0.20
        return round(self.clamp(s, 0, 1), 4)

    def stress_class(self, score):
        if score < 0.10:
            return "none"
        if score < 0.30:
            return "mild"
        if score < 0.60:
            return "moderate"
        return "severe"

    def compute_health(self, temp, hum, lux, soil, month):
        s = self.compute_stress(temp, hum, lux, soil)
        g = self.profile["growth_phases"].get(month, 0.5)
        return round(self.clamp(self.noise((1 - s) * 8 + g * 2, 0.01), 0, 10), 2)

    # ── Injection controls (for demo/prototyping) ──────────────────

    def inject_anomaly(self, zone_id: int, anomaly_type: str, duration_steps: int = 3):
        """
        Force anomalies into a specific zone for the next N readings.
        Types: sensor_fault, pipe_burst, pressure_drop, flow_spike
        """
        self._injected_anomalies[zone_id] = {
            "type": anomaly_type,
            "remaining": duration_steps,
        }
        logger.info("Anomaly injected", zone=zone_id, type=anomaly_type, duration=duration_steps)

    def inject_irrigation(self, zone_id: int, action: str):
        """Force irrigation on/off for a zone. action: 'start' or 'stop'"""
        if 1 <= zone_id <= self.n_zones:
            self.zone_irrig[zone_id] = (action == "start")
            logger.info("Irrigation forced", zone=zone_id, action=action)

    def inject_reservoir(self, level: float):
        """Override reservoir level (0-100)."""
        self.reservoir = self.clamp(level, 5, 100)
        logger.info("Reservoir level set", level=self.reservoir)

    def inject_filter(self, status: int):
        """Override filter status (0=clean, 1=partial, 2=clogged)."""
        self.filter_st = self.clamp(status, 0, 2)
        logger.info("Filter status set", status=self.filter_st)

    def inject_soil_moisture(self, zone_id: int, moisture: float):
        """Override soil moisture for a zone."""
        if 1 <= zone_id <= self.n_zones:
            self.zone_soil[zone_id] = self.clamp(moisture, 5, 99)
            logger.info("Soil moisture set", zone=zone_id, moisture=self.zone_soil[zone_id])

    def _apply_injected_anomaly(self, zone_id: int, reading: dict) -> dict:
        """Apply any injected anomaly to a reading, decrement counter."""
        if zone_id not in self._injected_anomalies:
            return reading

        inj = self._injected_anomalies[zone_id]
        atype = inj["type"]
        reading["is_anomaly"] = 1

        if atype == "sensor_fault":
            reading["air_temperature_c"] = round(random.uniform(55, 70), 2)
            reading["air_humidity_pct"] = round(random.uniform(0, 5), 2)
        elif atype == "pipe_burst":
            reading["zone_flow_lpm"] = round(random.uniform(4.5, 6.0), 3)
            reading["zone_pressure_mpa"] = round(random.uniform(0.0, 0.02), 4)
        elif atype == "pressure_drop":
            reading["main_pressure_mpa"] = round(random.uniform(0.0, 0.01), 4)
            reading["zone_pressure_mpa"] = round(random.uniform(0.0, 0.005), 4)
        elif atype == "flow_spike":
            reading["zone_flow_lpm"] = round(random.uniform(5.0, 6.0), 3)

        # Recompute stress/health with corrupted values
        reading["stress_score"] = self.compute_stress(
            reading["air_temperature_c"], reading["air_humidity_pct"],
            reading["light_intensity_lux"], reading["soil_moisture_pct"]
        )
        reading["stress_class"] = self.stress_class(reading["stress_score"])
        reading["health_score"] = self.compute_health(
            reading["air_temperature_c"], reading["air_humidity_pct"],
            reading["light_intensity_lux"], reading["soil_moisture_pct"],
            reading["month"]
        )

        inj["remaining"] -= 1
        if inj["remaining"] <= 0:
            del self._injected_anomalies[zone_id]

        return reading

    # ── Main reading generation ──────────────────────────────────

    def generate_reading(self):
        """
        Generate one batch of readings (one per zone) using real current time
        and Agadir-specific weather patterns.
        """
        dt = datetime.now()
        dt_str = dt.strftime("%Y-%m-%dT%H:%M:%S")
        month = dt.month
        hour = dt.hour

        # Generate realistic Agadir weather for this moment
        weather = self.generate_weather(dt)
        raw_temp = weather["temp"]
        raw_hum = weather["hum"]
        raw_pres = weather["pres"]
        raw_rad = weather["rad"]
        raw_precip = weather["precip"]
        raw_wind = weather["wind"]
        cloud = weather["cloud"]

        # Apply sensor noise (simulating real sensor readings)
        temp = round(self.clamp(self.noise(raw_temp, 0.005), -5, 55), 2)
        hum = round(self.clamp(self.noise(raw_hum, 0.008), 10, 99), 2)
        pres = round(self.clamp(self.noise(raw_pres, 0.001), 960, 1060), 2)
        lux = round(self.rad_to_lux(raw_rad * max(0, 1 - cloud / 100)), 1)

        # Filter status update
        self.filter_st = self.sim_filter_status(self.filter_st, hour)

        # Update valve decisions for each zone
        for z in range(1, self.n_zones + 1):
            if self.zone_needs_water(self.zone_soil[z], self.reservoir, 0.10, self.filter_st):
                self.zone_irrig[z] = True
            if self.zone_irrig[z] and self.zone_soil[z] >= self.profile["irrigate_stop"]:
                self.zone_irrig[z] = False

        any_open = any(self.zone_irrig.values())
        main_pressure = self.sim_main_pressure(self.reservoir, any_open, self.filter_st)

        total_flow = 0.0
        readings = []

        for z in range(1, self.n_zones + 1):
            anomaly = random.random() < self.anomaly_rate
            valve_open = self.zone_irrig[z]

            z_flow = self.sim_zone_flow(valve_open, main_pressure, anomaly)
            z_pres = self.sim_zone_pressure(valve_open, main_pressure, z_flow, anomaly)
            total_flow += z_flow

            soil = self.sim_soil_moisture(
                self.zone_soil[z] + self.zone_char[z] * 0.05,
                valve_open, temp, raw_rad, raw_precip
            )
            self.zone_soil[z] = soil

            s_score = self.compute_stress(temp, hum, lux, soil)
            h_score = self.compute_health(temp, hum, lux, soil, month)
            irr_need = 1 if self.zone_needs_water(soil, self.reservoir, z_pres, self.filter_st) else 0

            reading = {
                "timestamp": dt_str,
                "month": month,
                "hour": hour,
                "zone_id": z,
                "plant_type": "olive",
                "plant_species": self.profile["name"],
                "air_temperature_c": temp,
                "air_humidity_pct": hum,
                "air_pressure_hpa": pres,
                "light_intensity_lux": lux,
                "reservoir_level_pct": round(self.reservoir, 2),
                "main_pressure_mpa": main_pressure,
                "filter_status": self.filter_st,
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
                "stress_class": self.stress_class(s_score),
                "health_score": h_score,
                "irrigation_needed": irr_need,
            }
            # Apply any injected anomalies for demo purposes
            reading = self._apply_injected_anomaly(z, reading)
            readings.append(reading)

        self.reservoir = self.sim_reservoir(self.reservoir, total_flow, raw_precip)
        self.step += 1
        return readings

    # ── Async runner ─────────────────────────────────────────────

    async def _verify_farm_exists(self) -> bool:
        """Check if the current farm_id still exists in the database"""
        try:
            supabase = get_supabase_admin()
            result = supabase.table("farms").select("id").eq("id", self.farm_id).limit(1).execute()
            return bool(result.data)
        except Exception:
            return True  # On error, assume it exists to avoid false stops

    async def run(self):
        self.running = True
        logger.info(
            "IoT Simulator started",
            farm=self.farm_id[:8],
            zones=self.n_zones,
            interval_min=self.interval / 60,
        )

        while self.running:
            try:
                # Re-check that the farm still exists; if deleted, switch to current default
                if not await self._verify_farm_exists():
                    new_farm_id = await get_default_farm_id()
                    if new_farm_id == "00000000-0000-0000-0000-000000000000":
                        logger.warning("IoT Simulator: no farms in DB, waiting...")
                        await asyncio.sleep(self.interval)
                        continue
                    logger.info(
                        "IoT Simulator: farm deleted, switching to new farm",
                        old_farm=self.farm_id[:8],
                        new_farm=new_farm_id[:8],
                    )
                    self.farm_id = new_farm_id

                readings = self.generate_reading()
                if readings:
                    self._last_readings = readings
                    await ingest_batch(self.farm_id, readings)
                    logger.debug(
                        "IoT batch stored",
                        zones=len(readings),
                        timestamp=readings[0]["timestamp"],
                    )
                await asyncio.sleep(self.interval)
            except Exception as e:
                logger.error("IoT Simulator error", error=str(e))
                await asyncio.sleep(30)

        logger.info("IoT Simulator stopped")

    def start(self):
        self.task = asyncio.create_task(self.run())

    async def stop(self):
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass

    def generate_hierarchical_readings(
        self,
        zones: list,
        timestamp: Optional[datetime] = None,
    ) -> dict:
        """
        Generate hierarchical readings for all zones and their branches.
        Returns dict with environment, infrastructure, branch_flow, soil_moisture, and zone_health readings.
        """
        if timestamp is None:
            timestamp = datetime.now()

        weather = self.generate_weather(timestamp)

        env_reading = {
            "timestamp": timestamp.isoformat(),
            "air_temperature_c": round(weather["temp"], 2),
            "air_humidity_pct": round(weather["hum"], 1),
            "air_pressure_hpa": round(weather["pres"], 1),
            "light_intensity_lux": round(self.rad_to_lux(weather["rad"]), 0),
            "solar_radiation_wm2": round(weather["rad"], 1),
            "precipitation_mm": round(weather["precip"], 2),
            "wind_speed_kmh": round(weather["wind"], 1),
            "cloud_cover_pct": round(weather["cloud"], 1),
        }

        main_flow = 0.0
        if any(self.zone_irrig.values()):
            active_zones = [z for z in range(1, self.n_zones + 1) if self.zone_irrig.get(z, False)]
            if active_zones:
                flow_per_zone = random.uniform(2.0, 3.5)
                main_flow = flow_per_zone * len(active_zones)

        infra_reading = {
            "timestamp": timestamp.isoformat(),
            "reservoir_level_pct": round(self.reservoir, 1),
            "main_pump_flow_lpm": round(main_flow, 2),
            "main_pressure_mpa": round(random.uniform(0.06, 0.12), 3),
            "filter_status": self.filter_st,
        }

        branch_flow_readings = []
        soil_moisture_readings = []
        zone_health_readings = []

        for zone in zones:
            zone_id = zone["id"]
            branches = zone.get("branches", [])

            zone_total_inlet = 0.0
            zone_total_outlet = 0.0
            zone_leak_count = 0
            zone_moisture_vals = []

            zone_num = zone.get("zone_number", 1)
            zone_is_irrigating = self.zone_irrig.get(zone_num, False)

            for branch in branches:
                branch_id = branch["id"]

                inlet_flow = 0.0
                outlet_flow = 0.0
                if zone_is_irrigating:
                    inlet_flow = random.uniform(1.5, 3.0)
                    leak_prob = 0.05
                    if random.random() < leak_prob:
                        outlet_flow = inlet_flow - random.uniform(0.3, 0.8)
                        zone_leak_count += 1
                    else:
                        outlet_flow = inlet_flow * random.uniform(0.92, 0.98)

                branch_flow_readings.append({
                    "branch_id": branch_id,
                    "zone_id": zone_id,
                    "timestamp": timestamp.isoformat(),
                    "valve_open": 1 if zone_is_irrigating else 0,
                    "inlet_flow_lpm": round(inlet_flow, 2),
                    "outlet_flow_lpm": round(outlet_flow, 2),
                    "inlet_pressure_mpa": round(random.uniform(0.05, 0.10), 3),
                    "outlet_pressure_mpa": round(random.uniform(0.04, 0.08), 3),
                    "leak_detected": outlet_flow < inlet_flow - 0.2,
                })

                zone_total_inlet += inlet_flow
                zone_total_outlet += outlet_flow

                base_moisture = self.zone_soil.get(zone_num, 40)
                if zone_is_irrigating:
                    base_moisture = min(base_moisture + random.uniform(1, 3), 65)

                moisture_start = base_moisture + random.uniform(-3, 3)
                moisture_middle = base_moisture + random.uniform(-2, 2)
                moisture_end = base_moisture + random.uniform(-3, 1)

                soil_moisture_readings.append({
                    "branch_id": branch_id,
                    "zone_id": zone_id,
                    "timestamp": timestamp.isoformat(),
                    "moisture_start_pct": round(self.clamp(moisture_start, 10, 80), 1),
                    "moisture_middle_pct": round(self.clamp(moisture_middle, 10, 80), 1),
                    "moisture_end_pct": round(self.clamp(moisture_end, 10, 80), 1),
                })

                zone_moisture_vals.append((moisture_start + moisture_middle + moisture_end) / 3)

            avg_moisture = sum(zone_moisture_vals) / len(zone_moisture_vals) if zone_moisture_vals else 0
            efficiency = (zone_total_outlet / zone_total_inlet * 100) if zone_total_inlet > 0 else 0

            stress_score = 0.0
            if avg_moisture < 30:
                stress_score = random.uniform(0.5, 0.8)
            elif avg_moisture < 40:
                stress_score = random.uniform(0.2, 0.5)
            else:
                stress_score = random.uniform(0.0, 0.2)

            zone_health_readings.append({
                "zone_id": zone_id,
                "timestamp": timestamp.isoformat(),
                "avg_soil_moisture_pct": round(avg_moisture, 1),
                "total_inlet_flow_lpm": round(zone_total_inlet, 2),
                "total_outlet_flow_lpm": round(zone_total_outlet, 2),
                "water_efficiency_pct": round(self.clamp(efficiency, 0, 100), 1),
                "leak_count": zone_leak_count,
                "stress_score": round(stress_score, 3),
            })

        return {
            "environment": env_reading,
            "infrastructure": infra_reading,
            "branch_flows": branch_flow_readings,
            "soil_moistures": soil_moisture_readings,
            "zone_healths": zone_health_readings,
        }


# ── Module-level singleton ───────────────────────────────────────

_simulator: Optional[IoTSimulator] = None


async def get_default_farm_id() -> str:
    """Get the first farm from the database to simulate data for"""
    supabase = get_supabase_admin()
    try:
        result = supabase.table("farms").select("id").limit(1).execute()
        if result.data:
            return result.data[0]["id"]
    except Exception:
        pass
    logger.warning("No farm found for IoT simulator - using demo mode with mock farm_id")
    return "00000000-0000-0000-0000-000000000000"


async def start_iot_simulator(
    n_zones: int = 4,
    interval_seconds: float = 300.0,
    farm_id: Optional[str] = None,
):
    """Start the IoT simulator in the background"""
    global _simulator

    if _simulator and _simulator.running:
        logger.warning("IoT Simulator already running")
        return

    if not farm_id:
        farm_id = await get_default_farm_id()
        logger.info("Using default farm for IoT simulator", farm=farm_id[:8])

    _simulator = IoTSimulator(
        farm_id=farm_id,
        n_zones=n_zones,
        interval_seconds=interval_seconds,
    )
    _simulator.start()
    logger.info(
        "IoT Simulator started",
        zones=n_zones,
        interval_min=interval_seconds / 60,
        farm=farm_id[:8],
    )


async def stop_iot_simulator():
    """Stop the IoT simulator"""
    global _simulator
    if _simulator:
        await _simulator.stop()
        _simulator = None
        logger.info("IoT Simulator stopped")


def is_simulator_running() -> bool:
    """Check if simulator is running"""
    return _simulator is not None and _simulator.running


def get_latest_readings() -> list:
    """Get the most recently generated readings without advancing simulation state."""
    if _simulator is None or not _simulator.running:
        return []
    return _simulator._last_readings


def get_simulator() -> Optional[IoTSimulator]:
    """Get the running simulator instance for injection controls."""
    return _simulator
