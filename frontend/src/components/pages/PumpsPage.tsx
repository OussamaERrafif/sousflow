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
    const filterColor = filterStatus === 0 
        ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" 
        : filterStatus === 1 
            ? "text-amber-500 bg-amber-500/10 border-amber-500/20" 
            : "text-red-500 bg-red-500/10 border-red-500/20";

    return (
        <div className="w-full">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">{t("nav_pumps")}</h1>
                <p className="text-muted-foreground mt-1">Pump control and system monitoring</p>
            </div>

            {/* Simulator Control */}
            <div className="mb-6 p-5 rounded-2xl bg-card border border-border shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isRunning ? "bg-emerald-500/10" : "bg-muted"}`}>
                            <Activity className={`w-6 h-6 ${isRunning ? "text-emerald-500" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground">IoT Simulator</h2>
                            <p className="text-sm font-medium">
                                {isRunning ? (
                                    <span className="text-emerald-500 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block"></span>
                                        Running — {activeZoneCount} zones active
                                    </span>
                                ) : (
                                    <span className="text-muted-foreground">Stopped</span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {isRunning ? (
                            <button
                                onClick={handleStopSimulator}
                                disabled={isStopping}
                                className="flex items-center gap-2 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 px-5 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50"
                            >
                                <Square className="w-5 h-5" />
                                {isStopping ? "Stopping..." : "Stop Simulator"}
                            </button>
                        ) : (
                            <button
                                onClick={handleStartSimulator}
                                disabled={isStarting}
                                className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 px-5 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50"
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
                    { label: "Total Flow", value: hasLiveData ? `${totalFlow.toFixed(1)} L/min` : "--", icon: Droplet, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
                    { label: "Avg Pressure", value: hasLiveData ? `${avgPressure.toFixed(3)} MPa` : "--", icon: Gauge, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
                    { label: "Reservoir", value: hasLiveData ? `${reservoirLevel.toFixed(0)}%` : "--", icon: Activity, color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20" },
                    { label: "Irrigating Zones", value: hasLiveData ? `${irrigatingZones} / ${sseReadings.length}` : "--", icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="p-4 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border mb-3 ${color}`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <p className="text-xl font-bold text-foreground" dir="ltr">{value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* Per-Zone Flow/Pressure */}
            {hasLiveData && sseReadings.length > 0 && (
                <div className="mb-6 p-5 rounded-2xl bg-card border border-border shadow-sm">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Zone Flow & Pressure</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {sseReadings.map((zone, idx) => {
                            const flow = zone.zone_flow_lpm ?? 0;
                            const maxFlow = Math.max(...sseReadings.map(r => r.zone_flow_lpm ?? 0), 1);
                            const isIrrigating = zone.irrigation_needed === 1;
                            return (
                                <div key={zone.zone_id ?? idx} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border">
                                    <div className="w-8 h-8 bg-card rounded-lg border border-border flex items-center justify-center shrink-0">
                                        <span className="text-xs font-bold text-foreground">{zone.zone_id ?? idx + 1}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-medium text-muted-foreground truncate">Zone {zone.zone_id ?? idx + 1}</span>
                                            <span className="text-xs font-bold text-foreground shrink-0" dir="ltr">{flow.toFixed(1)} L/min</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${isIrrigating ? "bg-blue-500" : "bg-muted-foreground/30"}`}
                                                style={{ width: `${(flow / maxFlow) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="shrink-0">
                                        {isIrrigating ? (
                                            <span className="text-[10px] font-semibold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">Active</span>
                                        ) : (
                                            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Idle</span>
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
                <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Environmental Conditions</h3>
                    <div className="space-y-3">
                        {[
                            { label: "Air Temperature", value: hasLiveData ? `${avgTemp.toFixed(1)}°C` : "--", icon: Thermometer, color: "text-amber-500" },
                            { label: "Air Humidity", value: hasLiveData ? `${avgHumidity.toFixed(0)}%` : "--", icon: Wind, color: "text-blue-500" },
                            { label: "Reservoir Level", value: hasLiveData ? `${reservoirLevel.toFixed(0)}%` : "--", icon: Droplet, color: "text-cyan-500" },
                            { label: "Active Anomalies", value: hasLiveData ? String(anomalyZones) : "--", icon: AlertTriangle, color: anomalyZones > 0 ? "text-red-500" : "text-emerald-500" },
                        ].map(({ label, value, icon: Icon, color }) => (
                            <div key={label} className="flex justify-between items-center p-3 bg-muted/30 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <Icon className={`w-4 h-4 ${color}`} />
                                    <span className="font-medium text-foreground">{label}</span>
                                </div>
                                <span className="font-bold text-foreground" dir="ltr">{value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Maintenance Status</h3>
                    <div className="space-y-3">
                        {/* Filter status */}
                        <div className={`flex items-start gap-3 p-3 rounded-xl border ${filterColor}`}>
                            {filterStatus === 0
                                ? <CheckCircle2 className="w-5 h-5 shrink-0" />
                                : <AlertTriangle className="w-5 h-5 shrink-0" />
                            }
                            <div>
                                <p className="font-semibold text-sm">Filter Status</p>
                                <p className="text-xs text-muted-foreground">{filterLabel}</p>
                            </div>
                        </div>

                        {/* Reservoir level alert */}
                        {hasLiveData && (
                            <div className={`flex items-start gap-3 p-3 rounded-xl border ${
                                reservoirLevel < 20 
                                    ? "bg-red-500/10 border-red-500/20 text-red-500" 
                                    : reservoirLevel < 40 
                                        ? "bg-amber-500/10 border-amber-500/20 text-amber-500" 
                                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                            }`}>
                                {reservoirLevel < 40
                                    ? <AlertTriangle className="w-5 h-5 shrink-0" />
                                    : <CheckCircle2 className="w-5 h-5 shrink-0" />
                                }
                                <div>
                                    <p className="font-semibold text-sm">Reservoir Level</p>
                                    <p className="text-xs opacity-80">{reservoirLevel.toFixed(0)}% — {reservoirLevel < 20 ? "Critical — refill urgently" : reservoirLevel < 40 ? "Low — schedule refill" : "Normal"}</p>
                                </div>
                            </div>
                        )}

                        {/* Anomaly alert */}
                        {hasLiveData && anomalyZones > 0 && (
                            <div className="flex items-start gap-3 p-3 rounded-xl border bg-red-500/10 border-red-500/20 text-red-500">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                <div>
                                    <p className="font-semibold text-sm">Sensor Anomalies</p>
                                    <p className="text-xs opacity-80">{anomalyZones} zone(s) reporting abnormal sensor values</p>
                                </div>
                            </div>
                        )}

                        {!hasLiveData && (
                            <div className="p-4 text-center bg-muted/30 rounded-xl border border-dashed border-border">
                                <p className="text-muted-foreground text-sm">Start simulator to see live maintenance status</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
