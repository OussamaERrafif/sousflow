"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
    useLatestPerZoneApiIotReadingsLatestGetQuery,
    useAnalyzeZoneApiIotAnalyzeZoneIdGetQuery,
    useGetSimulatorStatusApiIotSimulatorStatusGetQuery,
} from "@/lib/store/generated/api";
import { useAppSelector } from "@/lib/store/hooks";
import type { IoTReading } from "@/lib/store/slices/iotSlice";
import { CheckCircle2, AlertTriangle, AlertOctagon, PauseCircle, TrendingUp, Activity, Zap, Gauge, Wifi, WifiOff } from "lucide-react";

function MoistureBar({ level, status }: { level: number; status: string }) {
    const t = useTranslations("ZoneGrid");
    let color = "bg-emerald-500";
    if (status === "off") color = "bg-zinc-400";
    else if (level < 40) color = "bg-red-500";
    else if (level < 60) color = "bg-amber-500";

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-zinc-500">{t("moisture")}</span>
                <span className="text-xs font-black text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">{level}%</span>
            </div>
            <div className="h-4 w-full bg-zinc-100 rounded-full overflow-hidden shadow-inner ring-1 ring-zinc-200 relative">
                <div className={`h-full ${color} transition-all duration-700 ease-out`} style={{ width: `${level}%` }}></div>
                <div className="absolute top-0 bottom-0 left-[55%] right-[30%] border-x-2 border-white/40 bg-white/10"></div>
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-zinc-400 font-bold px-1">
                <span>0%</span>
                <span>55-70%</span>
                <span>100%</span>
            </div>
        </div>
    );
}

export default function ZonesPage() {
    const t = useTranslations("ZoneGrid");
    const tz = useTranslations("Zones");
    const [selectedZone, setSelectedZone] = useState<number | null>(null);

    const { readings: sseReadings, connected, lastUpdate } = useAppSelector((state) => state.iot);
    const hasLiveData = connected && sseReadings.length > 0;

    const { data: latestData, isLoading: latestLoading } = useLatestPerZoneApiIotReadingsLatestGetQuery(
        undefined,
        { skip: hasLiveData }
    );
    const { data: simulatorStatus } = useGetSimulatorStatusApiIotSimulatorStatusGetQuery();

    const { data: analyzeData } = useAnalyzeZoneApiIotAnalyzeZoneIdGetQuery(
        { zoneId: selectedZone ?? 1, hours: 24 },
        { skip: !selectedZone }
    );

    // Resolve zones from SSE or RTK Query
    let rawZones: IoTReading[] = [];
    if (hasLiveData) {
        rawZones = sseReadings;
    } else if (latestData) {
        const d = latestData as { data?: IoTReading[]; zones?: IoTReading[] } | IoTReading[];
        if (Array.isArray(d)) rawZones = d;
        else if (Array.isArray(d.data)) rawZones = d.data;
        else if (Array.isArray(d.zones)) rawZones = d.zones;
    }

    const getZoneStatus = (zone: IoTReading) => {
        if (!zone) return "off";
        if (zone.is_anomaly) return "critical";
        if ((zone.soil_moisture_pct ?? 100) < 40 || (zone.zone_pressure_mpa ?? 10) < 0.05) return "warning";
        return "good";
    };

    const ZONES = rawZones.map((zone: IoTReading, idx: number) => ({
        id: zone.zone_id ?? idx + 1,
        name: tz(`zone${zone.zone_id ?? idx + 1}`),
        status: getZoneStatus(zone),
        pressure: zone.zone_pressure_mpa?.toFixed(3) ?? "0",
        flow: zone.zone_flow_lpm?.toFixed(1) ?? "0",
        moisture: Math.round(zone.soil_moisture_pct ?? 0),
        active: zone.irrigation_needed === 1,
        temperature: zone.air_temperature_c?.toFixed(1) ?? "--",
        humidity: Math.round(zone.air_humidity_pct ?? 0),
        healthScore: Math.round((zone.health_score ?? 0) * 10),
        stressClass: zone.stress_class ?? "none",
        reservoirLevel: Math.round(zone.reservoir_level_pct ?? 0),
        filterStatus: zone.filter_status ?? 0,
        alert: zone.is_anomaly
            ? tz("alert_c2")
            : (zone.soil_moisture_pct ?? 100) < 45
                ? tz("alert_c1")
                : null,
    }));

    const getStatusConfig = (status: string) => ({
        good: { dot: "bg-emerald-500", border: "border-emerald-200", icon: CheckCircle2, text: "text-emerald-700", bgSoft: "bg-emerald-50" },
        warning: { dot: "bg-amber-500 animate-pulse ring-4 ring-amber-500/20", border: "border-amber-400", icon: AlertTriangle, text: "text-amber-700", bgSoft: "bg-amber-50" },
        critical: { dot: "bg-red-500 animate-pulse ring-4 ring-red-500/20", border: "border-red-500", icon: AlertOctagon, text: "text-red-700", bgSoft: "bg-red-50" },
        off: { dot: "bg-zinc-400", border: "border-zinc-200", icon: PauseCircle, text: "text-zinc-500", bgSoft: "bg-zinc-100" },
    }[status] ?? { dot: "bg-zinc-400", border: "border-zinc-200", icon: CheckCircle2, text: "text-zinc-500", bgSoft: "bg-zinc-50" });

    const lastUpdateTime = lastUpdate
        ? new Date(lastUpdate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : null;

    if (!hasLiveData && latestLoading) {
        return (
            <div className="w-full">
                <div className="mb-6 h-8 bg-zinc-200 rounded-xl animate-pulse w-48"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-64 bg-zinc-200 rounded-2xl animate-pulse"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-black text-zinc-800 tracking-tight">{t("title")}</h1>
                    <p className="text-zinc-500 font-bold mt-1">
                        {simulatorStatus?.running ? (
                            <span className="text-emerald-600 flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse inline-block"></span>
                                Simulator Active — {simulatorStatus.zones?.length ?? 0} zones
                            </span>
                        ) : (
                            <span className="text-zinc-400">Monitoring all irrigation zones</span>
                        )}
                    </p>
                </div>
                {connected ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 shrink-0">
                        <Wifi className="w-3.5 h-3.5" />
                        <span>Live</span>
                        {lastUpdateTime && <span className="text-emerald-500" dir="ltr">{lastUpdateTime}</span>}
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 bg-zinc-100 px-3 py-1.5 rounded-full border border-zinc-200 shrink-0">
                        <WifiOff className="w-3.5 h-3.5" />
                        Offline
                    </span>
                )}
            </div>

            {/* Zone analysis panel */}
            {analyzeData && selectedZone && (
                <div className="mb-6 p-5 rounded-2xl bg-white border border-[#C17A3A] shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-[#C17A3A]" />
                            <h2 className="text-lg font-black text-zinc-800">Analysis — Zone {selectedZone}</h2>
                        </div>
                        <button onClick={() => setSelectedZone(null)} className="text-xs text-zinc-400 hover:text-zinc-600 font-bold">Close</button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Trend", value: analyzeData.trend_direction ?? "Stable" },
                            { label: "Slope/hr", value: analyzeData.trend_slope_per_hour?.toFixed(2) ?? "0" },
                            { label: "Anomalies", value: String(analyzeData.anomalies_count ?? 0) },
                            { label: "Health", value: `${analyzeData.health_score?.toFixed(0) ?? 100}%` },
                        ].map(({ label, value }) => (
                            <div key={label} className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
                                <p className="text-xs font-bold text-zinc-500 uppercase">{label}</p>
                                <p className="text-lg font-black text-zinc-800 mt-1">{value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {ZONES.length === 0 ? (
                <div className="p-10 text-center bg-white rounded-2xl border border-zinc-200">
                    <p className="text-zinc-500 font-bold">No zone data. Start the simulator or check your connection.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {ZONES.map((zone) => {
                        const config = getStatusConfig(zone.status);
                        const Icon = config.icon;
                        const isSelected = selectedZone === zone.id;

                        return (
                            <div
                                key={zone.id}
                                className={`rounded-2xl border ${isSelected ? "border-[#C17A3A] shadow-xl" : "border-zinc-200 shadow-sm hover:shadow-md"} transition-all bg-white flex flex-col cursor-pointer`}
                                onClick={() => setSelectedZone(isSelected ? null : zone.id)}
                            >
                                <div className="p-5 border-b border-zinc-100">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex gap-3 items-center">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${config.bgSoft} ${config.border}`}>
                                                <Icon className={`w-6 h-6 ${config.text}`} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-zinc-800">{zone.name}</h3>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-zinc-500 font-bold capitalize">{zone.status}</span>
                                                    {zone.healthScore > 0 && (
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${zone.healthScore >= 70 ? "bg-emerald-50 text-emerald-700" : zone.healthScore >= 40 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                                                            {zone.healthScore}% health
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`w-3 h-3 rounded-full shrink-0 ${config.dot}`}></div>
                                    </div>

                                    {zone.alert && (
                                        <div className={`mb-3 p-2.5 rounded-xl text-sm font-bold flex items-center gap-2 ${zone.status === "critical" ? "bg-red-50 text-red-800 border border-red-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
                                            <AlertTriangle className="w-4 h-4 shrink-0" />
                                            {zone.alert}
                                        </div>
                                    )}

                                    <MoistureBar level={zone.moisture} status={zone.status} />

                                    {zone.active && (
                                        <div className="flex items-center gap-2 mt-3 bg-sky-50 text-sky-700 px-3 py-1.5 rounded-lg border border-sky-100">
                                            <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></div>
                                            <span className="text-xs font-bold">Irrigation Active</span>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-auto bg-zinc-50 p-4">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="text-center">
                                            <div className="w-10 h-10 mx-auto bg-white rounded-xl border border-zinc-200 flex items-center justify-center mb-1">
                                                <Gauge className="w-5 h-5 text-zinc-600" />
                                            </div>
                                            <p className="text-xs font-black text-zinc-800" dir="ltr">{zone.pressure} MPa</p>
                                            <p className="text-[10px] text-zinc-400 font-bold uppercase">Pressure</p>
                                        </div>
                                        <div className="text-center">
                                            <div className="w-10 h-10 mx-auto bg-white rounded-xl border border-zinc-200 flex items-center justify-center mb-1">
                                                <Activity className="w-5 h-5 text-zinc-600" />
                                            </div>
                                            <p className="text-xs font-black text-zinc-800" dir="ltr">{zone.flow} L/min</p>
                                            <p className="text-[10px] text-zinc-400 font-bold uppercase">Flow</p>
                                        </div>
                                        <div className="text-center">
                                            <div className="w-10 h-10 mx-auto bg-white rounded-xl border border-zinc-200 flex items-center justify-center mb-1">
                                                <Zap className="w-5 h-5 text-zinc-600" />
                                            </div>
                                            <p className="text-xs font-black text-zinc-800" dir="ltr">{zone.temperature}°C</p>
                                            <p className="text-[10px] text-zinc-400 font-bold uppercase">Temp</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
