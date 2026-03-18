"use client";

import { useEffect, useRef } from "react";

const DEBUG_KEY = "sousflow_debug_mode";

export function isDebugMode(): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(DEBUG_KEY) === "true";
}

export function setDebugMode(enabled: boolean): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(DEBUG_KEY, enabled ? "true" : "false");
    if (enabled) {
        console.debug("[SoussFlow] Debug mode enabled");
    } else {
        console.debug("[SoussFlow] Debug mode disabled");
    }
}

export function debugLog(...args: unknown[]): void {
    if (!isDebugMode()) return;
    console.debug("[SoussFlow]", ...args);
}

export function debugGroup(label: string): void {
    if (!isDebugMode()) return;
    console.group(`[SoussFlow] ${label}`);
}

export function debugGroupEnd(): void {
    if (!isDebugMode()) return;
    console.groupEnd();
}

export function useDebugLog(label: string, data: unknown): void {
    const prevDataRef = useRef<unknown>(null);
    
    useEffect(() => {
        if (!isDebugMode()) return;
        
        const hasChanged = JSON.stringify(data) !== JSON.stringify(prevDataRef.current);
        if (hasChanged || prevDataRef.current === null) {
            console.debug(`[SoussFlow] ${label}:`, data);
            prevDataRef.current = data;
        }
    }, [label, data]);
}
