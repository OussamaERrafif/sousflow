"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, AlertOctagon, PauseCircle, Play, Settings2, CalendarRange, Wifi, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLatestPerZoneApiIotReadingsLatestGetQuery } from "@/lib/store/generated/api";
import { useAppSelector } from "@/lib/store/hooks";
import type { IoTReading } from "@/lib/store/slices/iotSlice";

function MoistureBar({ level, status }: { level: number; status: string }) {
    const t = useTranslations("ZoneGrid");
    let color = "bg-emerald-500";
    if (status === "off") color = "bg-zinc-400";
    else if (level < 40) color = "bg-red-500";
    else if (level < 60) color = "bg-amber-500";

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{t("moisture")}</span>
                <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-600" dir="ltr">{level}%</span>
            </div>
            <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden shadow-inner ring-1 ring-zinc-200 dark:ring-zinc-600 relative">
                <div className={`h-full ${color} transition-all duration-1000 ease-out`} style={{ width: `${level}%` }}></div>
                <div className="absolute top-0 bottom-0 left-[55%] right-[30%] border-x-2 border-white/40 bg-white/10" title={t("optimal")}></div>
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-zinc-400 dark:text-zinc-500 font-bold px-1">
                <span>0%</span>
                <span>{t("optimal")}: 55-70%</span>
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
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-2xl font-black text-zinc-800 dark:text-zinc-100 tracking-tight">{t("title")}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="h-64 bg-zinc-200 dark:bg-zinc-700 rounded-2xl animate-pulse"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (effectiveError) {
        return (
            <div className="mb-10 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-red-700 dark:text-red-400 font-bold">Failed to load zone data. Please login or check your connection.</p>
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
    }));

    if (zones.length === 0) {
        return (
            <div className="mb-10">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-2xl font-black text-zinc-800 tracking-tight">{t("title")}</h2>
                </div>
                <div className="p-8 text-center bg-white rounded-2xl border border-zinc-200">
                    <p className="text-zinc-500 font-bold">No zone data available. Make sure the simulator is running.</p>
                </div>
            </div>
        );
    }

    const getStatusConfig = (status: string) => {
        return {
            good: { dot: "bg-emerald-500", border: "border-emerald-200", bg: "bg-white", icon: CheckCircle2, text: "text-emerald-700", bgSoft: "bg-emerald-50" },
            warning: { dot: "bg-amber-500 animate-pulse ring-4 ring-amber-500/20", border: "border-amber-400", bg: "bg-white", icon: AlertTriangle, text: "text-amber-700", bgSoft: "bg-amber-50" },
            critical: { dot: "bg-red-500 animate-pulse ring-4 ring-red-500/20", border: "border-red-500", bg: "bg-white", icon: AlertOctagon, text: "text-red-700", bgSoft: "bg-red-50" },
            off: { dot: "bg-zinc-400", border: "border-zinc-200", bg: "bg-zinc-50", icon: PauseCircle, text: "text-zinc-500", bgSoft: "bg-zinc-100" },
        }[status] || { dot: "bg-zinc-400", border: "border-zinc-200", bg: "bg-white", icon: CheckCircle2, text: "text-zinc-500", bgSoft: "bg-zinc-50" };
    };

    const lastUpdateTime = lastUpdate ? new Date(lastUpdate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;

    return (
        <div className="mb-10">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-2xl font-black text-zinc-800 dark:text-zinc-100 tracking-tight">{t("title")}</h2>
                <div className="flex items-center gap-2">
                    {connected ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <Wifi className="w-3.5 h-3.5" />
                            <span>Live</span>
                            {lastUpdateTime && <span className="text-emerald-500 dark:text-emerald-400" dir="ltr">{lastUpdateTime}</span>}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700">
                            <WifiOff className="w-3.5 h-3.5" />
                            <span>Offline</span>
                        </span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
                {ZONES.map((zone) => {
                    const isExpanded = selected === zone.id;
                    const config = getStatusConfig(zone.status);
                    const Icon = config.icon;

                    return (
                        <div
                            key={zone.id}
                            className={`rounded-2xl border ${isExpanded ? "border-zinc-300 dark:border-zinc-600 shadow-xl z-20 scale-[1.02]" : "border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md dark:hover:shadow-lg"} transition-all bg-white dark:bg-zinc-800 flex flex-col`}
                        >
                            {/* Card Header */}
                            <div className="p-5 border-b border-zinc-100 dark:border-zinc-700">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-3 items-center">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${config.bgSoft} ${config.border}`}>
                                            <Icon className={`w-5 h-5 ${config.text}`} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 leading-none mb-1">{zone.name}</h3>
                                            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">
                                                {connected
                                                    ? <span className="text-emerald-600 dark:text-emerald-400">{t("live")}</span>
                                                    : t("last_update", { min: 1 })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="relative flex items-center justify-center shrink-0">
                                        <div className={`w-3 h-3 rounded-full ${config.dot}`}></div>
                                    </div>
                                </div>

                                {zone.alert && (
                                    <div className={`mb-4 p-3 rounded-xl flex items-start border shadow-sm ${zone.status === "critical" ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"}`}>
                                        <AlertTriangle className="w-5 h-5 mt-0.5 rtl:ml-2 ltr:mr-2 shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-sm font-bold leading-tight">{zone.alert}</p>
                                        </div>
                                        <button className="text-xs underline font-bold px-2 shrink-0">{t("details")}</button>
                                    </div>
                                )}

                                <div className="mb-2">
                                    <MoistureBar level={zone.moisture} status={zone.status} />
                                </div>

                                {zone.active && (
                                    <div className="flex items-center gap-2 mt-3 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 px-3 py-1.5 rounded-lg border border-sky-100 dark:border-sky-800">
                                        <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></div>
                                        <span className="text-xs font-bold leading-none">{t("irrigation_active")}</span>
                                        <span className="text-[10px] bg-white dark:bg-zinc-700 px-1.5 py-0.5 rounded-md border border-sky-200 dark:border-sky-600 rtl:mr-auto ltr:ml-auto font-black">{t("irrigation_duration", { min: zone.minutesActive })}</span>
                                    </div>
                                )}
                            </div>

                            {/* Card Actions */}
                            <div className="mt-auto bg-zinc-50 dark:bg-zinc-900 p-3 rounded-b-2xl border-t border-zinc-100 dark:border-zinc-700">
                                <div className="grid grid-cols-2 gap-2">
                                    {zone.active ? (
                                        <button className="flex items-center justify-center gap-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/50 py-2 rounded-xl font-bold text-sm transition-colors active:scale-95">
                                            <PauseCircle className="w-4 h-4" />
                                            <span>{t("stop")}</span>
                                        </button>
                                    ) : (
                                        <button className="flex items-center justify-center gap-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 py-2 rounded-xl font-bold text-sm transition-colors active:scale-95">
                                            <Play className="w-4 h-4" />
                                            <span>{t("start")}</span>
                                        </button>
                                    )}
                                    <button
                                        className="flex items-center justify-center gap-1.5 bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-600 py-2 rounded-xl font-bold text-sm transition-colors active:scale-95"
                                        onClick={() => setSelected(isExpanded ? null : zone.id)}
                                    >
                                        <Settings2 className="w-4 h-4" />
                                        <span>{isExpanded ? t("hide_details") : t("details")}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Expandable Details */}
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out bg-white rounded-b-2xl shadow-inner ${isExpanded ? "max-h-60 border-t border-zinc-200" : "max-h-0"}`}>
                                <div className="p-4 bg-zinc-50/80">
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div className="bg-white rounded-xl p-3 border border-zinc-200 shadow-sm flex flex-col items-center justify-center text-center">
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase">{t("pressure")}</p>
                                            <p className="text-xl font-black text-zinc-800 mt-1 block" dir="ltr">{zone.pressure} <span className="text-[10px] font-bold text-zinc-400 block -mt-1">MPa</span></p>
                                        </div>
                                        <div className="bg-white rounded-xl p-3 border border-zinc-200 shadow-sm flex flex-col items-center justify-center text-center">
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase">{t("flow")}</p>
                                            <p className="text-xl font-black text-zinc-800 mt-1 block" dir="ltr">{zone.flow} <span className="text-[10px] font-bold text-zinc-400 block -mt-1">L/min</span></p>
                                        </div>
                                    </div>
                                    <button className="w-full flex justify-center items-center gap-2 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 transition-colors text-zinc-700 font-bold text-sm">
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
