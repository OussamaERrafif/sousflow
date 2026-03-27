"use client";

import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_URLS } from "../apiConfig";
import { isDebugMode } from "@/lib/debug";

async function baseQueryWithFallback(args: any, api: any, extraOptions: any) {
  let lastError: Error | null = null;

  if (isDebugMode()) {
    console.debug("[SoussFlow/API] Request:", { url: args.url, method: args.method || "GET", body: args.body });
  }

  for (const baseUrl of API_URLS) {
    try {
      const result = await fetchBaseQuery({
        baseUrl: baseUrl.replace(/\/$/, ""),
        prepareHeaders: (headers, { endpoint, getState }) => {
          if (endpoint !== 'signInApiAuthSigninPost') {
            const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
            if (token) {
              headers.set("authorization", `Bearer ${token}`);
            }
            const state = getState() as any;
            const farmId = state?.auth?.activeFarmId;
            if (farmId) {
              headers.set("X-Farm-ID", farmId);
            }
          }
          return headers;
        },
      })(args, api, extraOptions);

      if (isDebugMode()) {
        console.debug("[SoussFlow/API] Response:", { url: args.url, status: result.error?.status || 200, data: result.data, error: result.error });
      }

      // If we got any HTTP response (data or error), stop trying fallback URLs.
      // Only fall through to the next URL on a network-level failure (fetch throws).
      if (result.data !== undefined || result.error) {
        return result;
      }
      lastError = new Error("Request failed: no response from server");
    } catch (err) {
      if (isDebugMode()) {
        console.debug("[SoussFlow/API] Error:", { url: args.url, error: err });
      }
      lastError = err as Error;
    }
  }

  return { error: { status: 500, data: { message: lastError?.message || "All API endpoints failed" } } };
}

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithFallback,
  tagTypes: ["IoT", "Alerts", "Auth", "Predictions", "WhatsApp"],
  endpoints: () => ({}),
});

