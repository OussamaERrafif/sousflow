"use client";

import { useTranslations } from "next-intl";
import {
    useGetSimulatorStatusApiIotSimulatorStatusGetQuery,
    useStartSimulatorApiIotSimulatorStartPostMutation,
    useStopSimulatorApiIotSimulatorStopPostMutation,
} from "@/lib/store/generated/api";
import { useAppSelector } from "@/lib/store/hooks";
import { Play, Square, Activity, Gauge, Droplet, AlertTriangle, CheckCircle2, Thermometer, Wind, CloudRain } from "lucide-react";

export default function PumpsPage() {
    const t = useTranslations("Sidebar");

    const { readings: sseReadings, connected, simulatorRunning } = useAppSelector((state) => state.iot);
    const hasLiveData = connected && sseReadings.length > 0;

    const { data: simulatorStatus, refetch } = useGetSimulatorStatusApiIotSimulatorStatusGetQuery();
    const [startSimulator, { isLoading: isStarting }] = useStartSimulatorApiIotSimulatorStartPostMutation();
    const [stopSimulator, { isLoading: isStopping }] = useStopSimulatorApiIotSimulatorStopPostMutation();

    const isRunning = hasLiveData ? simulatorRunning : (simulatorStatus?.running ?? false);
    const activeZoneCount = hasLiveData ? sseReadings.length : (simulatorStatus?.zones?.length ?? 0);

    // Aggregate metrics from live data
    const totalFlow = hasLiveData
        ? sseReadings.reduce((sum, r) => sum + (r.zone_flow_lpm ?? 0), 0)
        : 0;
    const avgPressure = hasLiveData && sseReadings.length > 0
        ? sseReadings.reduce((sum, r) => sum + (r.zone_pressure_mpa ?? 0), 0) / sseReadings.length
        : 0;
    const reservoirLevel = hasLiveData && sseReadings.length > 0
        ? sseReadings[0].reservoir_level_pct ?? 0
        : 0;
    const filterStatus = hasLiveData && sseReadings.length > 0
        ? sseReadings[0].filter_status ?? 0
        : 0;
    const avgTemp = hasLiveData && sseReadings.length > 0
        ? sseReadings.reduce((sum, r) => sum + (r.air_temperature_c ?? 0), 0) / sseReadings.length
        : 0;
    const avgHumidity = hasLiveData && sseReadings.length > 0
        ? sseReadings.reduce((sum, r) => sum + (r.air_humidity_pct ?? 0), 0) / sseReadings.length
        : 0;
    const irrigatingZones = hasLiveData ? sseReadings.filter(r => r.irrigation_needed === 1).length : 0;
    const anomalyZones = hasLiveData ? sseReadings.filter(r => r.is_anomaly).length : 0;

    const handleStartSimulator = async () => {
        try {
            await startSimulator({ zones: 8, interval: 5 }).unwrap();
            refetch();
        } catch (e) {
            console.error("Failed to start simulator:", e);
        }
    };

    const handleStopSimulator = async () => {
        try {
            await stopSimulator(undefined).unwrap();
            refetch();
        } catch (e) {
            console.error("Failed to stop simulator:", e);
        }
    };

    const filterLabel = filterStatus === 0 ? "Clean" : filterStatus === 1 ? "Partial clog" : "Clogged — needs cleaning";
    const filterColor = filterStatus === 0 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : filterStatus === 1 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-red-700 bg-red-50 border-red-200";

    return (
        <div className="w-full">
            <div className="mb-6">
                <h1 className="text-3xl font-black text-zinc-800 tracking-tight">{t("nav_pumps")}</h1>
                <p className="text-zinc-500 font-bold mt-1">Pump control and system monitoring</p>
            </div>

            {/* Simulator Control */}
            <div className="mb-6 p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isRunning ? "bg-emerald-100" : "bg-zinc-100"}`}>
                            <Activity className={`w-6 h-6 ${isRunning ? "text-emerald-600" : "text-zinc-400"}`} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-zinc-800">IoT Simulator</h2>
                            <p className="text-sm font-bold">
                                {isRunning ? (
                                    <span className="text-emerald-600 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block"></span>
                                        Running — {activeZoneCount} zones active
                                    </span>
                                ) : (
                                    <span className="text-zinc-400">Stopped</span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {isRunning ? (
                            <button
                                onClick={handleStopSimulator}
                                disabled={isStopping}
                                className="flex items-center gap-2 bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 px-5 py-2.5 rounded-xl font-bold transition-colors disabled:opacity-50"
                            >
                                <Square className="w-5 h-5" />
                                {isStopping ? "Stopping..." : "Stop Simulator"}
                            </button>
                        ) : (
                            <button
                                onClick={handleStartSimulator}
                                disabled={isStarting}
                                className="flex items-center gap-2 bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 px-5 py-2.5 rounded-xl font-bold transition-colors disabled:opacity-50"
                            >
                                <Play className="w-5 h-5" />
                                {isStarting ? "Starting..." : "Start Simulator"}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* System Metrics from SSE */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: "Total Flow", value: hasLiveData ? `${totalFlow.toFixed(1)} L/min` : "--", icon: Droplet, color: "text-sky-600 bg-sky-50 border-sky-200" },
                    { label: "Avg Pressure", value: hasLiveData ? `${avgPressure.toFixed(3)} MPa` : "--", icon: Gauge, color: "text-purple-600 bg-purple-50 border-purple-200" },
                    { label: "Reservoir", value: hasLiveData ? `${reservoirLevel.toFixed(0)}%` : "--", icon: Activity, color: "text-blue-600 bg-blue-50 border-blue-200" },
                    { label: "Irrigating Zones", value: hasLiveData ? `${irrigatingZones} / ${sseReadings.length}` : "--", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border mb-3 ${color}`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <p className="text-xl font-black text-zinc-800" dir="ltr">{value}</p>
                        <p className="text-xs text-zinc-500 font-bold mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* Per-Zone Flow/Pressure */}
            {hasLiveData && sseReadings.length > 0 && (
                <div className="mb-6 p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                    <h3 className="text-lg font-black text-zinc-800 mb-4">Zone Flow & Pressure</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {sseReadings.map((zone, idx) => {
                            const flow = zone.zone_flow_lpm ?? 0;
                            const maxFlow = Math.max(...sseReadings.map(r => r.zone_flow_lpm ?? 0), 1);
                            const isIrrigating = zone.irrigation_needed === 1;
                            return (
                                <div key={zone.zone_id ?? idx} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                                    <div className="w-8 h-8 bg-white rounded-lg border border-zinc-200 flex items-center justify-center shrink-0">
                                        <span className="text-xs font-black text-zinc-600">{zone.zone_id ?? idx + 1}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-zinc-600 truncate">Zone {zone.zone_id ?? idx + 1}</span>
                                            <span className="text-xs font-black text-zinc-800 shrink-0" dir="ltr">{flow.toFixed(1)} L/min</span>
                                        </div>
                                        <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${isIrrigating ? "bg-sky-500" : "bg-zinc-400"}`}
                                                style={{ width: `${(flow / maxFlow) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="shrink-0">
                                        {isIrrigating ? (
                                            <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">Active</span>
                                        ) : (
                                            <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">Idle</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Environment & Maintenance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                    <h3 className="text-lg font-black text-zinc-800 mb-4">Environmental Conditions</h3>
                    <div className="space-y-3">
                        {[
                            { label: "Air Temperature", value: hasLiveData ? `${avgTemp.toFixed(1)}°C` : "--", icon: Thermometer, color: "text-orange-500" },
                            { label: "Air Humidity", value: hasLiveData ? `${avgHumidity.toFixed(0)}%` : "--", icon: Wind, color: "text-sky-500" },
                            { label: "Reservoir Level", value: hasLiveData ? `${reservoirLevel.toFixed(0)}%` : "--", icon: Droplet, color: "text-blue-500" },
                            { label: "Active Anomalies", value: hasLiveData ? String(anomalyZones) : "--", icon: AlertTriangle, color: anomalyZones > 0 ? "text-red-500" : "text-emerald-500" },
                        ].map(({ label, value, icon: Icon, color }) => (
                            <div key={label} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <Icon className={`w-4 h-4 ${color}`} />
                                    <span className="font-bold text-zinc-600">{label}</span>
                                </div>
                                <span className="font-black text-zinc-800" dir="ltr">{value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                    <h3 className="text-lg font-black text-zinc-800 mb-4">Maintenance Status</h3>
                    <div className="space-y-3">
                        {/* Filter status */}
                        <div className={`flex items-start gap-3 p-3 rounded-xl border ${filterColor}`}>
                            {filterStatus === 0
                                ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                                : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                            }
                            <div>
                                <p className="font-bold text-sm">Filter Status</p>
                                <p className="text-xs">{filterLabel}</p>
                            </div>
                        </div>

                        {/* Reservoir level alert */}
                        {hasLiveData && (
                            <div className={`flex items-start gap-3 p-3 rounded-xl border ${reservoirLevel < 20 ? "bg-red-50 border-red-200 text-red-700" : reservoirLevel < 40 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                                {reservoirLevel < 40
                                    ? <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                    : <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                                }
                                <div>
                                    <p className="font-bold text-sm">Reservoir Level</p>
                                    <p className="text-xs">{reservoirLevel.toFixed(0)}% — {reservoirLevel < 20 ? "Critical — refill urgently" : reservoirLevel < 40 ? "Low — schedule refill" : "Normal"}</p>
                                </div>
                            </div>
                        )}

                        {/* Anomaly alert */}
                        {hasLiveData && anomalyZones > 0 && (
                            <div className="flex items-start gap-3 p-3 rounded-xl border bg-red-50 border-red-200 text-red-700">
                                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-sm">Sensor Anomalies</p>
                                    <p className="text-xs">{anomalyZones} zone(s) reporting abnormal sensor values</p>
                                </div>
                            </div>
                        )}

                        {!hasLiveData && (
                            <div className="p-4 text-center bg-zinc-50 rounded-xl border border-zinc-200">
                                <p className="text-zinc-400 font-bold text-sm">Start simulator to see live maintenance status</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
