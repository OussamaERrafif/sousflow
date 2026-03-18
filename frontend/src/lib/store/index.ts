"use client";

import { configureStore, createListenerMiddleware } from "@reduxjs/toolkit";
import { apiSlice } from "./apiSlice";
import authReducer from "./slices/authSlice";
import iotReducer from "./slices/iotSlice";
import { isDebugMode, debugLog } from "../debug";

const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  predicate: (action) => {
    return action.type.startsWith("iot/") || action.type.startsWith("auth/");
  },
  effect: async (action) => {
    if (isDebugMode()) {
      console.debug(`[SoussFlow/Store] ${action.type}:`, action.payload);
    }
  },
});

listenerMiddleware.startListening({
  predicate: (action) => {
    return action.type.endsWith("/fulfilled") || action.type.endsWith("/rejected");
  },
  effect: async (action) => {
    if (isDebugMode()) {
      console.debug(`[SoussFlow/API] ${action.type}:`, action.payload);
    }
  },
});

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    auth: authReducer,
    iot: iotReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware, listenerMiddleware.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
