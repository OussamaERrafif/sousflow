"use client";

import { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { setLiveData, setConnected } from "@/lib/store/slices/iotSlice";
import { API_URLS } from "../apiConfig";
import { isDebugMode, debugLog } from "../debug";

export function useSSE() {
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    function connect() {
      if (esRef.current) {
        esRef.current.close();
      }

      const baseUrl = API_URLS[currentUrlIndex].replace(/\/$/, "");
      if (isDebugMode()) {
        debugLog("SSE Connecting to:", `${baseUrl}/api/events`);
      }
      
      const es = new EventSource(`${baseUrl}/api/events`);
      esRef.current = es;

      es.onopen = () => {
        if (isDebugMode()) {
          debugLog("SSE Connection opened");
        }
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
        
        // Try fallback URL
        if (currentUrlIndex < API_URLS.length - 1) {
          setCurrentUrlIndex((prev) => prev + 1);
        } else {
          setCurrentUrlIndex(0);
          reconnectTimer.current = setTimeout(connect, 5000);
        }
      };
    }

    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      dispatch(setConnected(false));
    };
  }, [isAuthenticated, currentUrlIndex, dispatch]);
}
