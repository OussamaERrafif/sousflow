"use client";

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { isDebugMode } from "@/lib/debug";

export interface BranchReading {
  branch_id: string;
  branch_number: number;
  branch_name: string;
  valve_open: number;
  inlet_flow_lpm: number;
  outlet_flow_lpm: number;
  flow_delta_lpm: number;
  leak_detected: boolean;
  inlet_pressure_mpa: number;
  outlet_pressure_mpa: number;
  moisture_start_pct: number;
  moisture_middle_pct: number;
  moisture_end_pct: number;
  avg_moisture_pct: number;
  uniformity_coefficient: number;
}

export interface ZoneReading {
  zone_id: string;
  zone_number: number;
  zone_name: string;
  is_active: boolean;
  branches: BranchReading[];
  avg_moisture_pct: number;
  total_inlet_flow_lpm: number;
  total_outlet_flow_lpm: number;
  water_efficiency_pct: number;
  leak_count: number;
  stress_score: number;
  stress_class: string;
  health_score: number;
  irrigation_needed: boolean;
}

export interface EnvironmentReading {
  air_temperature_c: number;
  air_humidity_pct: number;
  air_pressure_hpa: number;
  light_intensity_lux: number;
  solar_radiation_wm2: number;
  precipitation_mm: number;
  wind_speed_kmh: number;
  cloud_cover_pct: number;
}

export interface InfrastructureReading {
  reservoir_level_pct: number;
  main_pump_flow_lpm: number;
  main_pressure_mpa: number;
  filter_status: number;
}

export interface SSEPayload {
  environment: EnvironmentReading | null;
  infrastructure: InfrastructureReading | null;
  zones: ZoneReading[];
  simulator_running: boolean;
  timestamp: string;
}

// Legacy flat reading format for backward compatibility with AlertPanel, PumpsPage, etc.
export interface LegacyReading {
  zone_id: number;
  soil_moisture_pct: number;
  zone_flow_lpm: number;
  zone_pressure_mpa: number;
  valve_open: number;
  air_temperature_c: number;
  air_humidity_pct: number;
  reservoir_level_pct: number;
  filter_status: number;
  health_score: number;
  stress_score: number;
  stress_class: string;
  irrigation_needed: number;
  is_anomaly: number;
}

interface IoTState {
  environment: EnvironmentReading | null;
  infrastructure: InfrastructureReading | null;
  zones: ZoneReading[];
  readings: LegacyReading[]; // backward compat for old components
  simulatorRunning: boolean;
  lastUpdate: string | null;
  connected: boolean;
}

const initialState: IoTState = {
  environment: null,
  infrastructure: null,
  zones: [],
  readings: [],
  simulatorRunning: false,
  lastUpdate: null,
  connected: false,
};

const iotSlice = createSlice({
  name: "iot",
  initialState,
  reducers: {
    setLiveData(state, action: PayloadAction<SSEPayload>) {
      const { environment, infrastructure, zones, simulator_running, timestamp } = action.payload;
      
      if (isDebugMode()) {
        console.debug("[SoussFlow/IoT] setLiveData received:", {
          zonesCount: zones?.length ?? 0,
          simulatorRunning: simulator_running,
          timestamp,
        });
      }

      state.environment = environment;
      state.infrastructure = infrastructure;
      state.zones = zones;
      state.simulatorRunning = simulator_running;
      state.lastUpdate = timestamp;
      state.connected = true;

      // Derive legacy flat readings for backward-compatible components
      state.readings = (zones || []).map((z) => ({
        zone_id: z.zone_number,
        soil_moisture_pct: z.avg_moisture_pct ?? 0,
        zone_flow_lpm: z.total_inlet_flow_lpm ?? 0,
        zone_pressure_mpa: infrastructure?.main_pressure_mpa ?? 0,
        valve_open: z.irrigation_needed ? 1 : 0,
        air_temperature_c: environment?.air_temperature_c ?? 0,
        air_humidity_pct: environment?.air_humidity_pct ?? 0,
        reservoir_level_pct: infrastructure?.reservoir_level_pct ?? 0,
        filter_status: infrastructure?.filter_status ?? 0,
        health_score: z.health_score ?? 0,
        stress_score: z.stress_score ?? 0,
        stress_class: z.stress_class ?? "none",
        irrigation_needed: z.irrigation_needed ? 1 : 0,
        is_anomaly: z.leak_count > 0 ? 1 : 0,
      }));

      if (isDebugMode()) {
        console.debug("[SoussFlow/IoT] state updated:", {
          readingsCount: state.readings.length,
          environment: state.environment,
        });
      }
    },
    setConnected(state, action: PayloadAction<boolean>) {
      if (isDebugMode()) {
        console.debug("[SoussFlow/IoT] setConnected:", action.payload);
      }
      state.connected = action.payload;
    },
  },
});

export const { setLiveData, setConnected } = iotSlice.actions;
export default iotSlice.reducer;
