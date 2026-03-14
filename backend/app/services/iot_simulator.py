"""
IoT Simulator Service — Generates continuous sensor data like real IoT devices
Runs in background, generates readings at configurable intervals, stores to database.
Farm-scoped version (farm_id instead of user_id).
"""
import asyncio
import math
import random
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from app.logging_config import logger
from app.supabase_client import get_supabase_admin
from app.services.iot_service import ingest_batch, check_alert_rules

TABLE = "iot_readings"

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
        interval_seconds: float = 5.0,
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

        self.reservoir = random.uniform(70, 90)
        self.filter_st = 0
        self.zone_soil = {z: random.uniform(*self.profile["soil_moisture_optimal"])
                         for z in range(1, n_zones + 1)}
        self.zone_irrig = {z: False for z in range(1, n_zones + 1)}
        self.zone_char = {z: random.gauss(0, 2.5) for z in range(1, n_zones + 1)}
        self.start_time = datetime.now()
        self.step = 0
        self._last_readings: list = []

    def clamp(self, v, lo, hi):
        return max(lo, min(hi, v))

    def noise(self, v, pct=0.02):
        return v + random.gauss(0, abs(v) * pct + 1e-6)

    def rad_to_lux(self, wm2):
        return max(0.0, wm2 * 120)

    def sim_reservoir(self, prev_pct, total_flow_lpm, precip_mm):
        drain = total_flow_lpm * (1 / 60) * 0.15
        refill = precip_mm * 0.08
        manual = random.uniform(0, 0.5) if random.random() < 0.003 else 0
        return round(self.clamp(self.noise(prev_pct - drain + refill + manual, 0.005), 5, 100), 2)

    def sim_main_pressure(self, reservoir_pct, any_valve_open, filter_status):
        base = 0.18 if any_valve_open else 0.05
        base *= (reservoir_pct / 100) ** 0.4
        clog_loss = filter_status * 0.03
        return round(self.clamp(base - clog_loss + random.gauss(0, 0.003), 0.0, 0.5), 4)

    def sim_filter_status(self, prev, hour):
        if hour == 0 and random.random() < 0.6:
            return 0
        if prev < 2 and random.random() < 0.0015:
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
        base = 1.6 * math.sqrt(max(0, main_pressure / 0.18)) + random.gauss(0, 0.06)
        if fault:
            base = random.choice([0.0, base * random.uniform(2.0, 3.5)])
        return round(self.clamp(base, 0, 6), 3)

    def sim_zone_pressure(self, valve_open, main_pressure, zone_flow, fault):
        if not valve_open:
            return round(self.clamp(self.noise(main_pressure * 0.95, 0.01), 0, 0.5), 4)
        drop = 0.015 * zone_flow
        val = main_pressure - drop + random.gauss(0, 0.003)
        if fault:
            val *= random.choice([0.1, 2.5])
        return round(self.clamp(val, 0.0, 0.5), 4)

    def sim_soil_moisture(self, prev, valve_open, temp, rad, precip):
        et = 0.10 + 0.007 * max(0, temp - 20) + 0.0003 * rad
        rain = min(precip * 1.4, 8.0)
        irr = 3.0 if valve_open else 0.0
        return round(self.clamp(prev - et + rain + irr + random.gauss(0, 0.2), 5, 99), 2)

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
        return round(self.clamp(self.noise((1 - s) * 8 + g * 2, 0.015), 0, 10), 2)

    def generate_reading(self):
        elapsed = self.step * self.interval
        dt = self.start_time + timedelta(seconds=elapsed)
        dt_str = dt.strftime("%Y-%m-%dT%H:%M")
        month = dt.month
        hour = dt.hour

        seasonal = 8 * math.cos(math.pi * (month - 7) / 6)
        diurnal = 7 * math.sin(math.pi * (hour - 6) / 12)
        base_temp = 21.0
        raw_temp = base_temp + seasonal + diurnal + random.gauss(0, 0.8)
        raw_hum = 55 - 0.5 * (raw_temp - base_temp) + random.gauss(0, 4)
        raw_pres = random.gauss(1013, 2.5)
        cloud = max(0, min(100, random.gauss(25, 20)))
        angle = math.pi * (hour - 6) / 14 if 6 <= hour <= 20 else 0
        raw_rad = max(0, 900 * math.sin(angle) * (1 - cloud / 150))
        raw_precip = random.choices([0.0, random.uniform(0.1, 4.0)], weights=[0.94, 0.06])[0]
        raw_wind = abs(random.gauss(3, 2))

        temp = round(self.clamp(self.noise(raw_temp, 0.01), -10, 60), 2)
        hum = round(self.clamp(self.noise(raw_hum, 0.01), 10, 99), 2)
        pres = round(self.clamp(self.noise(raw_pres, 0.002), 960, 1060), 2)
        lux = round(self.rad_to_lux(raw_rad * max(0, 1 - cloud / 100)), 1)

        self.filter_st = self.sim_filter_status(self.filter_st, hour)

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
            readings.append(reading)

        self.reservoir = self.sim_reservoir(self.reservoir, total_flow, raw_precip)
        self.step += 1
        return readings

    async def run(self):
        self.running = True
        logger.info(
            "IoT Simulator started",
            farm=self.farm_id[:8],
            zones=self.n_zones,
            interval=self.interval
        )

        while self.running:
            try:
                readings = self.generate_reading()
                if readings:
                    self._last_readings = readings
                    await ingest_batch(self.farm_id, readings)
                    logger.debug(
                        "IoT batch stored",
                        zones=len(readings),
                        timestamp=readings[0]["timestamp"]
                    )
                await asyncio.sleep(self.interval)
            except Exception as e:
                logger.error("IoT Simulator error", error=str(e))
                await asyncio.sleep(5)

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
    interval_seconds: float = 5.0,
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
        interval=interval_seconds,
        farm=farm_id[:8]
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
