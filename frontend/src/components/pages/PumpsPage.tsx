"use client";

import { useTranslations } from "next-intl";
import {
    useGetSimulatorStatusApiIotSimulatorStatusGetQuery,
    useStartSimulatorApiIotSimulatorStartPostMutation,
    useStopSimulatorApiIotSimulatorStopPostMutation,
} from "@/lib/store/generated/api";
import { useAppSelector } from "@/lib/store/hooks";
import {
    Play, Square, Activity, Gauge, Droplet, AlertTriangle,
    CheckCircle2, Thermometer, Wind, WifiOff,
} from "lucide-react";
import { useDebugLog } from "@/lib/debug";

export default function PumpsPage() {
    const t = useTranslations("Sidebar");

    const { readings: sseReadings, connected, simulatorRunning } = useAppSelector((state) => state.iot);
    const hasLiveData = connected && sseReadings.length > 0;

    const { data: simulatorStatus, refetch } = useGetSimulatorStatusApiIotSimulatorStatusGetQuery();

    useDebugLog("PumpsPage - sseReadings", sseReadings);
    useDebugLog("PumpsPage - connected", connected);
    useDebugLog("PumpsPage - simulatorRunning", simulatorRunning);
    useDebugLog("PumpsPage - simulatorStatus", simulatorStatus);

    const [startSimulator, { isLoading: isStarting }] = useStartSimulatorApiIotSimulatorStartPostMutation();
    const [stopSimulator, { isLoading: isStopping }] = useStopSimulatorApiIotSimulatorStopPostMutation();

    const isRunning = hasLiveData ? simulatorRunning : (simulatorStatus?.running ?? false);
    const activeZoneCount = hasLiveData ? sseReadings.length : (simulatorStatus?.zones?.length ?? 0);

    const totalFlow = hasLiveData ? sseReadings.reduce((sum, r) => sum + (r.zone_flow_lpm ?? 0), 0) : 0;
    const avgPressure = hasLiveData && sseReadings.length > 0
        ? sseReadings.reduce((sum, r) => sum + (r.zone_pressure_mpa ?? 0), 0) / sseReadings.length : 0;
    const reservoirLevel = hasLiveData && sseReadings.length > 0 ? sseReadings[0].reservoir_level_pct ?? 0 : 0;
    const filterStatus = hasLiveData && sseReadings.length > 0 ? sseReadings[0].filter_status ?? 0 : 0;
    const avgTemp = hasLiveData && sseReadings.length > 0
        ? sseReadings.reduce((sum, r) => sum + (r.air_temperature_c ?? 0), 0) / sseReadings.length : 0;
    const avgHumidity = hasLiveData && sseReadings.length > 0
        ? sseReadings.reduce((sum, r) => sum + (r.air_humidity_pct ?? 0), 0) / sseReadings.length : 0;
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
    const filterStyle = filterStatus === 0
        ? { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 }
        : filterStatus === 1
            ? { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-600 dark:text-amber-400", icon: AlertTriangle }
            : { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-600 dark:text-red-400", icon: AlertTriangle };
    const FilterIcon = filterStyle.icon;

    const reservoirStyle = reservoirLevel < 20
        ? { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-600 dark:text-red-400", note: "Critical — refill urgently", icon: AlertTriangle }
        : reservoirLevel < 40
            ? { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-600 dark:text-amber-400", note: "Low — schedule refill", icon: AlertTriangle }
            : { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400", note: "Normal", icon: CheckCircle2 };
    const ReservoirIcon = reservoirStyle.icon;

    return (
        <div className="w-full">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-xl font-semibold text-foreground tracking-tight">{t("nav_pumps")}</h1>
                <p className="text-sm text-muted-foreground mt-1">Pump control and system monitoring</p>
            </div>

            {/* Simulator control card */}
            <div className="mb-6 p-5 rounded-2xl bg-card border border-border shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center border border-border ${isRunning ? "bg-emerald-500/10" : "bg-muted"}`}>
                            <Activity className={`w-5 h-5 ${isRunning ? "text-emerald-500" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">IoT Simulator</h2>
                            {isRunning ? (
                                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-0.5">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                    Running — {activeZoneCount} zones active
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground mt-0.5">Stopped</p>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {isRunning ? (
                            <button
                                onClick={handleStopSimulator}
                                disabled={isStopping}
                                className="flex items-center gap-2 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                <Square className="w-4 h-4" />
                                {isStopping ? "Stopping…" : "Stop Simulator"}
                            </button>
                        ) : (
                            <button
                                onClick={handleStartSimulator}
                                disabled={isStarting}
                                className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                <Play className="w-4 h-4" />
                                {isStarting ? "Starting…" : "Start Simulator"}
                            </button>
                        )}
                    </div>
                </div>

                {/* Connection indicator */}
                {!connected && (
                    <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
                        <WifiOff className="w-3.5 h-3.5" />
                        Not connected to live feed
                    </div>
                )}
            </div>

            {/* System metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                    { label: "Total Flow", value: hasLiveData ? totalFlow.toFixed(1) : "--", unit: "L/min", icon: Droplet, iconBg: "bg-blue-500/10", iconColor: "text-blue-500" },
                    { label: "Avg Pressure", value: hasLiveData ? avgPressure.toFixed(3) : "--", unit: "MPa", icon: Gauge, iconBg: "bg-purple-500/10", iconColor: "text-purple-500" },
                    { label: "Reservoir Level", value: hasLiveData ? reservoirLevel.toFixed(0) : "--", unit: "%", icon: Activity, iconBg: "bg-cyan-500/10", iconColor: "text-cyan-500" },
                    { label: "Irrigating Zones", value: hasLiveData ? `${irrigatingZones}/${sseReadings.length}` : "--", unit: "", icon: CheckCircle2, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-500" },
                ].map(({ label, value, unit, icon: Icon, iconBg, iconColor }) => (
                    <div key={label} className="p-5 rounded-2xl border border-border bg-card shadow-sm hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300">
                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-border ${iconBg}`}>
                                <Icon className={`w-5 h-5 ${iconColor}`} />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-foreground tracking-tight" dir="ltr">
                            {value}
                            {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
                        </h3>
                        <p className="text-sm font-medium text-muted-foreground mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* Zone flow breakdown */}
            {hasLiveData && sseReadings.length > 0 && (
                <div className="mb-6 p-5 rounded-2xl bg-card border border-border shadow-sm">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Zone Flow</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {sseReadings.map((zone, idx) => {
                            const flow = zone.zone_flow_lpm ?? 0;
                            const maxFlow = Math.max(...sseReadings.map(r => r.zone_flow_lpm ?? 0), 1);
                            const isIrrigating = zone.irrigation_needed === 1;
                            return (
                                <div key={zone.zone_id ?? idx} className="p-4 bg-muted/30 rounded-2xl border border-border flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                            Z{zone.zone_id ?? idx + 1}
                                        </span>
                                        {isIrrigating ? (
                                            <span className="text-[10px] font-semibold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full border border-blue-500/20">Active</span>
                                        ) : (
                                            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full border border-border">Idle</span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-foreground leading-none" dir="ltr">
                                            {flow.toFixed(1)}
                                            <span className="text-xs font-normal text-muted-foreground ml-1">L/min</span>
                                        </p>
                                    </div>
                                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${isIrrigating ? "bg-blue-500" : "bg-muted-foreground/25"}`}
                                            style={{ width: `${(flow / maxFlow) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Environment & Maintenance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Environmental conditions — 2×2 mini-card grid */}
                <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Environmental Conditions</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: "Temperature", value: hasLiveData ? avgTemp.toFixed(1) : "--", unit: "°C", icon: Thermometer, iconBg: "bg-amber-500/10", iconColor: "text-amber-500" },
                            { label: "Humidity", value: hasLiveData ? avgHumidity.toFixed(0) : "--", unit: "%", icon: Wind, iconBg: "bg-blue-500/10", iconColor: "text-blue-500" },
                            { label: "Reservoir", value: hasLiveData ? reservoirLevel.toFixed(0) : "--", unit: "%", icon: Droplet, iconBg: "bg-cyan-500/10", iconColor: "text-cyan-500" },
                            { label: "Anomalies", value: hasLiveData ? String(anomalyZones) : "--", unit: "", icon: AlertTriangle, iconBg: anomalyZones > 0 ? "bg-red-500/10" : "bg-emerald-500/10", iconColor: anomalyZones > 0 ? "text-red-500" : "text-emerald-500" },
                        ].map(({ label, value, unit, icon: Icon, iconBg, iconColor }) => (
                            <div key={label} className="p-4 bg-muted/30 rounded-2xl border border-border flex flex-col gap-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border border-border ${iconBg}`}>
                                    <Icon className={`w-4 h-4 ${iconColor}`} />
                                </div>
                                <p className="text-xl font-bold text-foreground leading-none mt-1" dir="ltr">
                                    {value}
                                    {unit && <span className="text-xs font-normal text-muted-foreground ml-0.5">{unit}</span>}
                                </p>
                                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Maintenance status */}
                <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Maintenance Status</h3>
                    {hasLiveData ? (
                        <div className="grid grid-cols-1 gap-3">
                            {/* Filter */}
                            <div className={`p-4 rounded-2xl border ${filterStyle.bg} ${filterStyle.border} flex items-center gap-3`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${filterStyle.bg} border ${filterStyle.border} shrink-0`}>
                                    <FilterIcon className={`w-4 h-4 ${filterStyle.text}`} />
                                </div>
                                <div className="min-w-0">
                                    <p className={`text-sm font-semibold ${filterStyle.text}`}>Filter</p>
                                    <p className="text-xs text-muted-foreground truncate">{filterLabel}</p>
                                </div>
                            </div>

                            {/* Reservoir */}
                            <div className={`p-4 rounded-2xl border ${reservoirStyle.bg} ${reservoirStyle.border} flex items-center gap-3`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${reservoirStyle.bg} border ${reservoirStyle.border} shrink-0`}>
                                    <ReservoirIcon className={`w-4 h-4 ${reservoirStyle.text}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-semibold ${reservoirStyle.text}`}>Reservoir</p>
                                    <div className="flex items-center justify-between gap-2 mt-0.5">
                                        <p className="text-xs text-muted-foreground truncate">{reservoirStyle.note}</p>
                                        <span className="text-xs font-bold text-foreground shrink-0" dir="ltr">{reservoirLevel.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1.5">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${reservoirLevel < 20 ? "bg-red-500" : reservoirLevel < 40 ? "bg-amber-500" : "bg-emerald-500"}`}
                                            style={{ width: `${Math.min(reservoirLevel, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Anomalies / all-clear */}
                            {anomalyZones > 0 ? (
                                <div className="p-4 rounded-2xl border bg-red-500/10 border-red-500/20 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10 border border-red-500/20 shrink-0">
                                        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">Sensor Anomalies</p>
                                        <p className="text-xs text-muted-foreground">{anomalyZones} zone{anomalyZones > 1 ? "s" : ""} with abnormal values</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 rounded-2xl border bg-emerald-500/10 border-emerald-500/20 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">All systems nominal</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center py-8">
                            <div className="text-center">
                                <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center mx-auto mb-3">
                                    <Activity className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <p className="text-sm text-muted-foreground">Start the simulator to see live status</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
