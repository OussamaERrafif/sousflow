"use client";

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface IoTReading {
  zone_id: number;
  timestamp?: string;
  soil_moisture_pct?: number;
  zone_pressure_mpa?: number;
  zone_flow_lpm?: number;
  irrigation_needed?: number;
  is_anomaly?: number;
  health_score?: number;
  stress_score?: number;
  stress_class?: string;
  air_temperature_c?: number;
  air_humidity_pct?: number;
  reservoir_level_pct?: number;
  filter_status?: number;
  minutes_active?: number;
  [key: string]: unknown;
}

interface SSEPayload {
  readings: IoTReading[];
  simulator_running: boolean;
  timestamp: string;
}

interface IoTState {
  readings: IoTReading[];
  simulatorRunning: boolean;
  lastUpdate: string | null;
  connected: boolean;
}

const initialState: IoTState = {
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
      state.readings = action.payload.readings;
      state.simulatorRunning = action.payload.simulator_running;
      state.lastUpdate = action.payload.timestamp;
      state.connected = true;
    },
    setConnected(state, action: PayloadAction<boolean>) {
      state.connected = action.payload;
    },
  },
});

export const { setLiveData, setConnected } = iotSlice.actions;
export default iotSlice.reducer;
