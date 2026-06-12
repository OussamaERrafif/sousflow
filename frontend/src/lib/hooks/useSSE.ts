"use client";

import { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { setLiveData, setConnected } from "@/lib/store/slices/iotSlice";
import { API_URLS } from "../apiConfig";
import { isDebugMode, debugLog } from "../debug";

const MIN_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;

export function useSSE() {
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    function scheduleReconnect(urlIndex: number) {
      const delay = Math.min(MIN_BACKOFF_MS * 2 ** retryCount.current, MAX_BACKOFF_MS);
      retryCount.current += 1;
      if (isDebugMode()) {
        debugLog(`SSE reconnecting in ${delay}ms (attempt ${retryCount.current})`);
      }
      reconnectTimer.current = setTimeout(() => connect(urlIndex), delay);
    }

    function connect(urlIndex: number = currentUrlIndex) {
      if (esRef.current) {
        esRef.current.close();
      }

      const baseUrl = API_URLS[urlIndex].replace(/\/$/, "");
      if (isDebugMode()) {
        debugLog("SSE Connecting to:", `${baseUrl}/api/events`);
      }

      const es = new EventSource(`${baseUrl}/api/events`);
      esRef.current = es;

      es.onopen = () => {
        if (isDebugMode()) {
          debugLog("SSE Connection opened");
        }
        retryCount.current = 0; // reset backoff on successful open
        dispatch(setConnected(true));
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (isDebugMode()) {
            debugLog("SSE Message received:", data);
          }
          dispatch(setLiveData(data));
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        if (isDebugMode()) {
          debugLog("SSE Connection error");
        }
        es.close();
        esRef.current = null;
        dispatch(setConnected(false));

        // Cycle through fallback URLs; after exhausting all, use exponential backoff
        const nextIndex = (urlIndex + 1) % API_URLS.length;
        setCurrentUrlIndex(nextIndex);
        if (nextIndex === 0) scheduleReconnect(0);
      };
    }

    connect(currentUrlIndex);

    return () => {
      esRef.current?.close();
      esRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      dispatch(setConnected(false));
    };
  }, [isAuthenticated, currentUrlIndex, dispatch]);
}
