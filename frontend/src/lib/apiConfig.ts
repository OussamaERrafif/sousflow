"use client";

const LOCAL_URL = "http://localhost:8000";
const DEPLOYED_URL = "https://sousflow.vercel.app";

const isLocalDev =
  typeof window !== "undefined" && window.location.hostname === "localhost";

// In production, try the deployed backend first; locally, try localhost first
export const API_URLS = process.env.NEXT_PUBLIC_API_URL
  ? [process.env.NEXT_PUBLIC_API_URL]
  : isLocalDev
    ? [LOCAL_URL, DEPLOYED_URL]
    : [DEPLOYED_URL, LOCAL_URL];

export function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL || (isLocalDev ? LOCAL_URL : DEPLOYED_URL)).replace(/\/$/, "");
}

export function getSseBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL || (isLocalDev ? LOCAL_URL : DEPLOYED_URL)).replace(/\/$/, "");
}
