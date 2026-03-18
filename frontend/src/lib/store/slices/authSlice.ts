"use client";

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { isDebugMode } from "@/lib/debug";

interface User {
  id: string;
  username: string;
  full_name?: string | null;
  phone?: string | null;
  role?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  // Role & farm context — populated after calling GET /api/auth/profile
  role: "superadmin" | "farm_owner" | "farm_employee" | null;
  activeFarmId: string | null;
  farmIds: string[];
  ownedFarmIds: string[];
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  role: null,
  activeFarmId: null,
  farmIds: [],
  ownedFarmIds: [],
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; token: string }>
    ) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      if (isDebugMode()) {
        console.debug("[SoussFlow/Auth] setCredentials:", { user: action.payload.user.username, token: action.payload.token ? "(present)" : "(none)" });
      }
    },
    setProfile: (
      state,
      action: PayloadAction<{
        role: "superadmin" | "farm_owner" | "farm_employee";
        farmIds: string[];
        ownedFarmIds: string[];
        activeFarmId: string | null;
        full_name?: string | null;
      }>
    ) => {
      state.role = action.payload.role;
      state.farmIds = action.payload.farmIds;
      state.ownedFarmIds = action.payload.ownedFarmIds;
      state.activeFarmId = action.payload.activeFarmId;
      if (state.user && action.payload.full_name !== undefined) {
        state.user.full_name = action.payload.full_name;
      }
      if (isDebugMode()) {
        console.debug("[SoussFlow/Auth] setProfile:", action.payload);
      }
    },
    setActiveFarm: (state, action: PayloadAction<string>) => {
      if (state.farmIds.includes(action.payload)) {
        state.activeFarmId = action.payload;
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("activeFarmId", action.payload);
          } catch {}
        }
        if (isDebugMode()) {
          console.debug("[SoussFlow/Auth] setActiveFarm:", action.payload);
        }
      }
    },
    logout: (state) => {
      if (isDebugMode()) {
        console.debug("[SoussFlow/Auth] logout:", { previousUser: state.user?.username });
      }
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.role = null;
      state.activeFarmId = null;
      state.farmIds = [];
      state.ownedFarmIds = [];
    },
  },
});

export const { setCredentials, setProfile, setActiveFarm, logout } = authSlice.actions;
export default authSlice.reducer;
