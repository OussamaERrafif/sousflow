"use client";

const LOCAL_URL = "http://localhost:8000";
const DEPLOYED_URL = "https://sousflow.vercel.app";

export const API_URLS = [LOCAL_URL, DEPLOYED_URL];

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || LOCAL_URL;
}

export function getSseBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || LOCAL_URL;
}
