"use client";

import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { setCredentials, logout } from "./slices/authSlice";
import { API_URLS } from "../apiConfig";

async function baseQueryWithFallback(args: any, api: any, extraOptions: any) {
  let lastError: Error | null = null;

  for (const baseUrl of API_URLS) {
    try {
      const result = await fetchBaseQuery({
        baseUrl: baseUrl.replace(/\/$/, ""),
        prepareHeaders: (headers, { endpoint, getState }) => {
          if (endpoint !== 'signIn') {
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

      if (result.data || result.error?.status === 401 || result.error?.status === 403) {
        return result;
      }
      lastError = new Error(`Request failed with status ${result.error?.status}`);
    } catch (err) {
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

export const authenticatingApiSlice = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    signIn: build.mutation<{ access_token: string; user: any }, { username: string; password: string }>({
      query: (credentials) => ({
        url: "/api/auth/signin",
        method: "POST",
        body: credentials,
      }),
      async onQueryStarted(args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          try { localStorage.setItem("token", data.access_token); } catch {}
          dispatch(setCredentials({ user: data.user, token: data.access_token }));
        } catch {
          // Error handled by query
        }
      },
    }),
    signOut: build.mutation<void, void>({
      query: () => ({
        url: "/api/auth/signout",
        method: "POST",
      }),
      async onQueryStarted(args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          try { localStorage.removeItem("token"); } catch {}
          dispatch(logout());
        }
      },
    }),
  }),
});

export const { useSignInMutation, useSignOutMutation } = authenticatingApiSlice;
