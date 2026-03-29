"use client";

import { useMemo } from "react";

interface ZoneRiskOverlayProps {
    zones: Array<{
        zone_id: string;
        health_score?: number;
    }>;
    getZoneColor?: (zoneId: string, score?: number) => string;
}

export function ZoneRiskOverlay({ zones, getZoneColor }: ZoneRiskOverlayProps) {
    const zoneColors = useMemo(() => {
        const colors: Record<string, string> = {};
        for (const zone of zones) {
            const score = zone.health_score ?? 100;
            if (getZoneColor) {
                colors[zone.zone_id] = getZoneColor(zone.zone_id, score);
            } else {
                colors[zone.zone_id] = getHealthColor(score);
            }
        }
        return colors;
    }, [zones, getZoneColor]);

    return null;
}

export function getHealthColor(score: number): string {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#eab308";
    if (score >= 40) return "#f97316";
    return "#dc2626";
}

export function getHealthLabel(score: number): string {
    if (score >= 80) return "good";
    if (score >= 60) return "fair";
    if (score >= 40) return "warning";
    return "critical";
}

export function getSeverityColor(severity: string): string {
    switch (severity) {
        case "critical": return "#dc2626";
        case "high": return "#ea580c";
        case "medium": return "#ca8a04";
        case "low": return "#2563eb";
        default: return "#6b7280";
    }
}

export function getSeverityLabel(severity: string): string {
    switch (severity) {
        case "critical": return "critical";
        case "high": return "high";
        case "medium": return "medium";
        case "low": return "low";
        default: return "unknown";
    }
}
