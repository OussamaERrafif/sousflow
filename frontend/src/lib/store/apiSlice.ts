"use client";

import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { setCredentials, logout } from "./slices/authSlice";

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, ""),
    prepareHeaders: (headers, { endpoint }) => {
      if (endpoint !== 'signIn' && endpoint !== 'signUp') {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (token) {
          headers.set("authorization", `Bearer ${token}`);
        }
      }
      return headers;
    },
  }),
  tagTypes: ["IoT", "Alerts", "Auth", "Predictions", "WhatsApp"],
  endpoints: () => ({}),
});

export const authenticatingApiSlice = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    signIn: build.mutation<{ access_token: string; refresh_token: string; user: any }, { email: string; password: string }>({
      query: (credentials) => ({
        url: "/api/auth/signin",
        method: "POST",
        body: credentials,
      }),
      async onQueryStarted(args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          try { localStorage.setItem("token", data.access_token); } catch {}
          try { localStorage.setItem("refreshToken", data.refresh_token); } catch {}
          dispatch(setCredentials({ user: data.user, token: data.access_token }));
        } catch {
          // Error handled by query
        }
      },
    }),
    signUp: build.mutation<{ access_token: string; refresh_token: string; user: any }, { email: string; password: string; full_name?: string; phone?: string }>({
      query: (userData) => ({
        url: "/api/auth/signup",
        method: "POST",
        body: userData,
      }),
      async onQueryStarted(args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          try { localStorage.setItem("token", data.access_token); } catch {}
          try { localStorage.setItem("refreshToken", data.refresh_token); } catch {}
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
          try { localStorage.removeItem("refreshToken"); } catch {}
          dispatch(logout());
        }
      },
    }),
    refreshToken: build.mutation<{ access_token: string; refresh_token: string }, string>({
      query: (refresh_token) => ({
        url: "/api/auth/refresh",
        method: "POST",
        body: { refresh_token },
      }),
      async onQueryStarted(args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          try { localStorage.setItem("token", data.access_token); } catch {}
          try { localStorage.setItem("refreshToken", data.refresh_token); } catch {}
          const state = (window as any).__REDUX_STORE__?.getState?.() || {};
          if (state.auth?.user) {
            dispatch(setCredentials({ user: state.auth.user, token: data.access_token }));
          }
        } catch {
          try { localStorage.removeItem("token"); } catch {}
          try { localStorage.removeItem("refreshToken"); } catch {}
          dispatch(logout());
        }
      },
    }),
  }),
});

export const { useSignInMutation, useSignUpMutation, useSignOutMutation, useRefreshTokenMutation } = authenticatingApiSlice;
