"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, AlertOctagon, PauseCircle, Play, Settings2, CalendarRange, Wifi, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLatestPerZoneApiIotReadingsLatestGetQuery } from "@/lib/store/generated/api";
import { useAppSelector } from "@/lib/store/hooks";
import type { IoTReading } from "@/lib/store/slices/iotSlice";
import { ReservoirIndicator } from "./ReservoirIndicator";

function MoistureBar({ level, status }: { level: number; status: string }) {
    const t = useTranslations("ZoneGrid");
    
    const getMoistureColor = (level: number) => {
        if (status === "off") return { bg: "bg-muted", fill: "bg-muted-foreground/30", dot: "bg-muted-foreground/40" };
        if (level < 40) return { bg: "bg-red-500/20", fill: "bg-red-500", dot: "bg-red-500" };
        if (level < 55) return { bg: "bg-amber-500/20", fill: "bg-amber-500", dot: "bg-amber-500" };
        if (level < 75) return { bg: "bg-emerald-500/20", fill: "bg-emerald-500", dot: "bg-emerald-500" };
        return { bg: "bg-blue-500/20", fill: "bg-blue-500", dot: "bg-blue-500" };
    };
    
    const getMoistureLabel = (level: number) => {
        if (status === "off") return { text: "text-muted-foreground", label: "Off" };
        if (level < 40) return { text: "text-red-500", label: "Critical" };
        if (level < 55) return { text: "text-amber-500", label: "Low" };
        if (level < 75) return { text: "text-emerald-500", label: "Optimal" };
        return { text: "text-blue-500", label: "High" };
    };
    
    const colors = getMoistureColor(level);
    const label = getMoistureLabel(level);

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-muted-foreground">{t("moisture")}</span>
                <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${colors.dot}`}></div>
                    <span className={`text-xs font-bold ${label.text}`}>{label.label}</span>
                </div>
            </div>
            <div className={`h-3 w-full ${colors.bg} rounded-full overflow-hidden relative`}>
                <div 
                    className={`h-full ${colors.fill} transition-all duration-1000 ease-out rounded-full`} 
                    style={{ width: `${Math.min(level, 100)}%` }}
                ></div>
                {/* Optimal range indicator */}
                <div className="absolute top-0 bottom-0 left-[55%] right-[25%] border-x-2 border-white/30"></div>
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground/60 font-medium px-0.5">
                <span>0%</span>
                <span className="text-[9px]">{t("optimal")}: 55-75%</span>
                <span>100%</span>
            </div>
        </div>
    );
}

export default function ZoneGrid() {
    const [selected, setSelected] = useState<number | null>(null);
    const t = useTranslations("ZoneGrid");
    const tz = useTranslations("Zones");

    // SSE live data
    const { readings: sseReadings, connected, lastUpdate } = useAppSelector((state) => state.iot);
    const hasLiveData = connected && sseReadings.length > 0;

    // RTK Query fallback
    const { data: latestData, isLoading, error } = useLatestPerZoneApiIotReadingsLatestGetQuery(
        undefined,
        { skip: hasLiveData }
    );

    // Resolve zones from SSE or RTK Query
    let zones: IoTReading[] = [];
    if (hasLiveData) {
        zones = sseReadings;
    } else if (latestData) {
        const d = latestData as { data?: IoTReading[]; zones?: IoTReading[] } | IoTReading[];
        if (Array.isArray(d)) {
            zones = d;
        } else if (Array.isArray(d.data)) {
            zones = d.data;
        } else if (Array.isArray(d.zones)) {
            zones = d.zones;
        }
    }

    const effectiveLoading = !hasLiveData && isLoading;
    const effectiveError = !hasLiveData && error;

    if (effectiveLoading) {
        return (
            <div className="mb-10">
                <div className="flex items-center justify-between mb-6">
                    <div className="h-9 w-48 bg-muted rounded-lg animate-pulse"></div>
                    <div className="h-7 w-24 bg-muted rounded-full animate-pulse"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="h-72 bg-muted rounded-2xl animate-pulse"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (effectiveError) {
        return (
            <div className="mb-10 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                <p className="text-destructive font-medium">Failed to load zone data. Please login or check your connection.</p>
            </div>
        );
    }

    const getZoneStatus = (zone: IoTReading) => {
        if (!zone) return "off";
        if (zone.is_anomaly) return "critical";
        if ((zone.soil_moisture_pct ?? 100) < 40 || (zone.zone_pressure_mpa ?? 10) < 2) return "warning";
        return "good";
    };

    type ZoneData = {
        id: number;
        name: string;
        status: string;
        pressure: string;
        flow: string;
        moisture: number;
        active: boolean;
        alert: string | null;
        minutesActive: number;
        healthScore: number;
        reservoirLevel: number;
    };

    const ZONES: ZoneData[] = zones.map((zone: IoTReading, idx: number) => ({
        id: zone.zone_id || idx + 1,
        name: tz(`zone${zone.zone_id || idx + 1}`) || `Zone ${zone.zone_id || idx + 1}`,
        status: getZoneStatus(zone),
        pressure: zone.zone_pressure_mpa?.toFixed(2) || "0",
        flow: zone.zone_flow_lpm?.toFixed(1) || "0",
        moisture: Math.round(zone.soil_moisture_pct || 0),
        active: zone.irrigation_needed === 1,
        alert: zone.is_anomaly ? tz("alert_c2") : ((zone.soil_moisture_pct ?? 100) < 45 ? tz("alert_c1") : null),
        minutesActive: zone.minutes_active || 0,
        healthScore: Math.round((zone.health_score || 0) * 10),
        reservoirLevel: Math.round(zone.reservoir_level_pct || 0),
    }));

    if (zones.length === 0) {
        return (
            <div className="mb-10">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-foreground tracking-tight">{t("title")}</h2>
                </div>
                <div className="p-8 text-center bg-card rounded-2xl border border-dashed border-border">
                    <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <WifiOff className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-medium">No zone data available. Make sure the simulator is running.</p>
                </div>
            </div>
        );
    }

    const getStatusConfig = (status: string) => {
        return {
            good: { 
                dot: "bg-emerald-500", 
                border: "border-emerald-500/20", 
                bg: "bg-card", 
                icon: CheckCircle2, 
                text: "text-emerald-500", 
                bgSoft: "bg-emerald-500/10",
                label: "Good"
            },
            warning: { 
                dot: "bg-amber-500 animate-pulse", 
                border: "border-amber-500/30", 
                bg: "bg-card", 
                icon: AlertTriangle, 
                text: "text-amber-500", 
                bgSoft: "bg-amber-500/10",
                label: "Warning"
            },
            critical: { 
                dot: "bg-red-500 animate-pulse", 
                border: "border-red-500/30", 
                bg: "bg-card", 
                icon: AlertOctagon, 
                text: "text-red-500", 
                bgSoft: "bg-red-500/10",
                label: "Critical"
            },
            off: { 
                dot: "bg-muted-foreground/40", 
                border: "border-border", 
                bg: "bg-card opacity-60", 
                icon: PauseCircle, 
                text: "text-muted-foreground", 
                bgSoft: "bg-muted/50",
                label: "Offline"
            },
        }[status] || { 
            dot: "bg-muted-foreground", 
            border: "border-border", 
            bg: "bg-card", 
            icon: CheckCircle2, 
            text: "text-muted-foreground", 
            bgSoft: "bg-muted",
            label: "Unknown"
        };
    };

    const lastUpdateTime = lastUpdate ? new Date(lastUpdate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;

    return (
        <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground tracking-tight">{t("title")}</h2>
                <div className="flex items-center gap-2">
                    {connected ? (
                        <span className="flex items-center gap-2 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            <span>Live</span>
                            {lastUpdateTime && <span className="text-emerald-500/70" dir="ltr">{lastUpdateTime}</span>}
                        </span>
                    ) : (
                        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border">
                            <WifiOff className="w-3.5 h-3.5" />
                            <span>Offline</span>
                        </span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {ZONES.map((zone) => {
                    const isExpanded = selected === zone.id;
                    const config = getStatusConfig(zone.status);
                    const Icon = config.icon;

                    return (
                        <div
                            key={zone.id}
                            className={`group rounded-2xl border ${config.border} bg-card flex flex-col transition-all duration-300 hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1 ${
                                isExpanded ? "ring-2 ring-primary/20" : ""
                            }`}
                        >
                            {/* Card Header */}
                            <div className="p-5 border-b border-border/50">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-3 items-center">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${config.bgSoft} ${config.border}`}>
                                            <Icon className={`w-5 h-5 ${config.text}`} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-foreground leading-none mb-1">{zone.name}</h3>
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-2 h-2 rounded-full ${config.dot}`}></div>
                                                <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ReservoirIndicator level={zone.reservoirLevel} showLabel={false} />
                                </div>

                                {zone.alert && (
                                    <div className={`mb-4 p-3 rounded-xl flex items-start border shadow-sm ${
                                        zone.status === "critical" 
                                            ? "bg-red-500/10 border-red-500/30 text-red-500" 
                                            : "bg-amber-500/10 border-amber-500/30 text-amber-500"
                                    }`}>
                                        <AlertTriangle className="w-4 h-4 mt-0.5 rtl:ml-2 ltr:mr-2 shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium leading-tight">{zone.alert}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="mb-2">
                                    <MoistureBar level={zone.moisture} status={zone.status} />
                                </div>

                                {zone.active && (
                                    <div className="flex items-center gap-2 mt-3 bg-blue-500/10 text-blue-500 px-3 py-2 rounded-lg border border-blue-500/20">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                        <span className="text-xs font-semibold">{t("irrigation_active")}</span>
                                        <span className="text-[10px] bg-blue-500/20 px-2 py-0.5 rounded-md font-bold rtl:mr-auto ltr:ml-auto">{t("irrigation_duration", { min: zone.minutesActive })}</span>
                                    </div>
                                )}
                            </div>

                            {/* Quick Stats Row */}
                            <div className="px-5 py-3 bg-muted/30 flex items-center justify-between">
                                <div className="text-center">
                                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t("pressure")}</p>
                                    <p className="text-sm font-bold text-foreground" dir="ltr">{zone.pressure} <span className="text-[9px] text-muted-foreground">MPa</span></p>
                                </div>
                                <div className="w-px h-8 bg-border"></div>
                                <div className="text-center">
                                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t("flow")}</p>
                                    <p className="text-sm font-bold text-foreground" dir="ltr">{zone.flow} <span className="text-[9px] text-muted-foreground">L/min</span></p>
                                </div>
                            </div>

                            {/* Card Actions */}
                            <div className="mt-auto bg-muted/20 p-3 rounded-b-2xl border-t border-border/50">
                                <div className="grid grid-cols-2 gap-2">
                                    {zone.active ? (
                                        <button className="flex items-center justify-center gap-1.5 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95">
                                            <PauseCircle className="w-4 h-4" />
                                            <span>{t("stop")}</span>
                                        </button>
                                    ) : (
                                        <button className="flex items-center justify-center gap-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95">
                                            <Play className="w-4 h-4" />
                                            <span>{t("start")}</span>
                                        </button>
                                    )}
                                    <button
                                        className="flex items-center justify-center gap-1.5 bg-muted text-muted-foreground border border-border hover:bg-accent hover:text-foreground py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
                                        onClick={() => setSelected(isExpanded ? null : zone.id)}
                                    >
                                        <Settings2 className="w-4 h-4" />
                                        <span>{isExpanded ? t("hide_details") : t("details")}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Expandable Details */}
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out bg-muted/30 ${isExpanded ? "max-h-48 border-t border-border" : "max-h-0"}`}>
                                <div className="p-4">
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div className="bg-card rounded-xl p-3 border border-border flex flex-col items-center justify-center text-center">
                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase">{t("pressure")}</p>
                                            <p className="text-xl font-bold text-foreground mt-1" dir="ltr">{zone.pressure} <span className="text-[10px] font-medium text-muted-foreground">MPa</span></p>
                                        </div>
                                        <div className="bg-card rounded-xl p-3 border border-border flex flex-col items-center justify-center text-center">
                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase">{t("flow")}</p>
                                            <p className="text-xl font-bold text-foreground mt-1" dir="ltr">{zone.flow} <span className="text-[10px] font-medium text-muted-foreground">L/min</span></p>
                                        </div>
                                    </div>
                                    <button className="w-full flex justify-center items-center gap-2 py-2.5 rounded-xl bg-card border border-border hover:bg-accent hover:text-foreground transition-colors text-muted-foreground font-medium text-sm">
                                        <CalendarRange className="w-4 h-4" />
                                        <span>{t("schedule")}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
