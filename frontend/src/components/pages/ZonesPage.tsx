"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
    useGetSimulatorStatusApiIotSimulatorStatusGetQuery,
} from "@/lib/store/generated/api";
import { useAppSelector } from "@/lib/store/hooks";
import type { BranchReading, ZoneReading } from "@/lib/store/slices/iotSlice";
import { CheckCircle2, AlertTriangle, AlertOctagon, PauseCircle, Wifi, WifiOff, Droplets, Gauge, Activity, Thermometer, Power, ToggleLeft, ToggleRight } from "lucide-react";
import { BranchCard } from "../BranchCard";
import { WaterConsumptionChart } from "../WaterConsumptionChart";
import { useDebugLog } from "@/lib/debug";
import { ControlConfirmDialog } from "../ControlConfirmDialog";

function MoistureBar({ level, status }: { level: number; status: string }) {
    const t = useTranslations("ZoneGrid");
    let color = "bg-emerald-500";
    if (status === "off") color = "bg-muted-foreground/40";
    else if (level < 40) color = "bg-red-500";
    else if (level < 55) color = "bg-amber-500";

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-muted-foreground">{t("moisture")}</span>
                <span className="text-xs font-black text-foreground bg-muted px-2 py-0.5 rounded-md border border-border">{level}%</span>
            </div>
            <div className="h-4 w-full bg-muted rounded-full overflow-hidden shadow-inner ring-1 ring-border relative">
                <div className={`h-full ${color} transition-all duration-700 ease-out`} style={{ width: `${level}%` }}></div>
                <div className="absolute top-0 bottom-0 left-[55%] right-[30%] border-x-2 border-white/40 bg-card/10"></div>
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground/60 font-bold px-1">
                <span>0%</span>
                <span>55-70%</span>
                <span>100%</span>
            </div>
        </div>
    );
}

export default function ZonesPage() {
    const t = useTranslations("ZoneGrid");
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
    const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
    const [controlDialog, setControlDialog] = useState<{
        zoneId: string;
        zoneName: string;
        action: "start_irrigation" | "stop_irrigation";
    } | null>(null);
    const [controlLoading, setControlLoading] = useState(false);

    const { zones: sseZones, environment, infrastructure, controlStates, simulatorRunning, connected, lastUpdate } = useAppSelector((state) => state.iot);
    const hasLiveData = connected && sseZones && sseZones.length > 0;

    useDebugLog("ZonesPage - sseZones", sseZones);
    useDebugLog("ZonesPage - environment", environment);
    useDebugLog("ZonesPage - infrastructure", infrastructure);
    useDebugLog("ZonesPage - connected", connected);
    useDebugLog("ZonesPage - simulatorRunning", simulatorRunning);

    const { data: simulatorStatus } = useGetSimulatorStatusApiIotSimulatorStatusGetQuery();

    const getZoneStatus = (zone: ZoneReading) => {
        if (!zone) return "off";
        if (zone.leak_count > 0) return "critical";
        if ((zone.avg_moisture_pct ?? 100) < 40) return "warning";
        return "good";
    };

    const handleControlZone = async (zoneId: string, action: "start_irrigation" | "stop_irrigation", durationMinutes?: number) => {
        setControlLoading(true);
        try {
            const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
            const farmId = typeof window !== "undefined" ? localStorage.getItem("activeFarmId") : null;
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;
            if (farmId) headers["X-Farm-ID"] = farmId;

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/control/zone/${zoneId}`, {
                method: "POST",
                headers,
                body: JSON.stringify({ action, duration_minutes: durationMinutes || null }),
            });
            if (!res.ok) throw new Error("Control command failed");
        } catch (e) {
            console.error("Zone control error:", e);
        } finally {
            setControlLoading(false);
            setControlDialog(null);
        }
    };

    const handleToggleOverride = async (zoneId: string, enabled: boolean) => {
        try {
            const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
            const farmId = typeof window !== "undefined" ? localStorage.getItem("activeFarmId") : null;
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;
            if (farmId) headers["X-Farm-ID"] = farmId;

            await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/control/zone/${zoneId}/override`, {
                method: "POST",
                headers,
                body: JSON.stringify({ enabled }),
            });
        } catch (e) {
            console.error("Override toggle error:", e);
        }
    };

    const toggleBranch = (branchId: string) => {
        setExpandedBranches(prev => {
            const next = new Set(prev);
            if (next.has(branchId)) {
                next.delete(branchId);
            } else {
                next.add(branchId);
            }
            return next;
        });
    };

    const getStatusConfig = (status: string) => ({
        good: { dot: "bg-emerald-500", border: "border-emerald-200", icon: CheckCircle2, text: "text-emerald-700", bgSoft: "bg-emerald-50" },
        warning: { dot: "bg-amber-500 animate-pulse ring-4 ring-amber-500/20", border: "border-amber-400", icon: AlertTriangle, text: "text-amber-700", bgSoft: "bg-amber-50" },
        critical: { dot: "bg-red-500 animate-pulse ring-4 ring-red-500/20", border: "border-red-500", icon: AlertOctagon, text: "text-red-700", bgSoft: "bg-red-50" },
        off: { dot: "bg-muted-foreground/40", border: "border-border", icon: PauseCircle, text: "text-muted-foreground", bgSoft: "bg-muted" },
    }[status] ?? { dot: "bg-muted-foreground/40", border: "border-border", icon: CheckCircle2, text: "text-muted-foreground", bgSoft: "bg-muted/50" });

    const lastUpdateTime = lastUpdate
        ? new Date(lastUpdate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : null;

    if (!hasLiveData) {
        return (
            <div className="w-full">
                <div className="mb-6 h-8 bg-muted rounded-xl animate-pulse w-48"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-64 bg-muted rounded-2xl animate-pulse"></div>
                    ))}
                </div>
            </div>
        );
    }

    const totalLeakCount = sseZones.reduce((sum: number, z: ZoneReading) => sum + (z.leak_count ?? 0), 0);
    const avgEfficiency = sseZones.length > 0 
        ? sseZones.reduce((sum: number, z: ZoneReading) => sum + (z.water_efficiency_pct ?? 0), 0) / sseZones.length 
        : 0;
    const totalFlow = sseZones.reduce((sum: number, z: ZoneReading) => sum + (z.total_inlet_flow_lpm ?? 0), 0);

    return (
        <div className="w-full">
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight">{t("title")}</h1>
                    <p className="text-muted-foreground font-bold mt-1">
                        {simulatorStatus?.running ? (
                            <span className="text-emerald-600 flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse inline-block"></span>
                                {t("active")} — {sseZones.length} {t("title")}
                            </span>
                        ) : (
                            <span className="text-muted-foreground/60">{t("title")}</span>
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
                    <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 rounded-full border border-border shrink-0">
                        <WifiOff className="w-3.5 h-3.5" />
                        Offline
                    </span>
                )}
            </div>

            {totalLeakCount > 0 && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
                    <AlertOctagon className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-bold text-red-800">
                        {totalLeakCount} {t("leak_detected")}
                    </span>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <Droplets className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold text-muted-foreground uppercase">{t("total_flow")}</span>
                    </div>
                    <p className="text-2xl font-black text-foreground" dir="ltr">{totalFlow.toFixed(1)} <span className="text-sm font-normal">L/min</span></p>
                </div>
                <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <Gauge className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-bold text-muted-foreground uppercase">{t("avg_efficiency")}</span>
                    </div>
                    <p className="text-2xl font-black text-foreground" dir="ltr">{avgEfficiency.toFixed(0)} <span className="text-sm font-normal">%</span></p>
                </div>
                <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <Thermometer className="w-4 h-4 text-orange-500" />
                        <span className="text-xs font-bold text-muted-foreground uppercase">{t("temperature")}</span>
                    </div>
                    <p className="text-2xl font-black text-foreground" dir="ltr">{environment?.air_temperature_c?.toFixed(1) ?? "--"} <span className="text-sm font-normal">°C</span></p>
                </div>
                <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <Droplets className="w-4 h-4 text-cyan-500" />
                        <span className="text-xs font-bold text-muted-foreground uppercase">{t("humidity")}</span>
                    </div>
                    <p className="text-2xl font-black text-foreground" dir="ltr">{environment?.air_humidity_pct?.toFixed(0) ?? "--"} <span className="text-sm font-normal">%</span></p>
                </div>
            </div>

            <div className="mb-6">
                <WaterConsumptionChart 
                    zones={sseZones.map((z: ZoneReading) => ({
                        zone_id: z.zone_id,
                        zone_name: z.zone_name || `Zone ${z.zone_number}`,
                        inlet_lpm: z.total_inlet_flow_lpm ?? 0,
                        outlet_lpm: z.total_outlet_flow_lpm ?? 0,
                        efficiency_pct: z.water_efficiency_pct ?? 0
                    }))}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {sseZones.map((zone: ZoneReading) => {
                    const config = getStatusConfig(getZoneStatus(zone));
                    const Icon = config.icon;
                    const isSelected = selectedZoneId === zone.zone_id;

                    return (
                        <div
                            key={zone.zone_id}
                            className={`rounded-2xl border ${isSelected ? "border-[#C17A3A] shadow-xl" : "border-border shadow-sm hover:shadow-md"} transition-all bg-card flex flex-col`}
                        >
                            <div 
                                className="p-5 border-b border-border cursor-pointer"
                                onClick={() => setSelectedZoneId(isSelected ? null : zone.zone_id)}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-3 items-center">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${config.bgSoft} ${config.border}`}>
                                            <Icon className={`w-6 h-6 ${config.text}`} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-foreground">{zone.zone_name || `Zone ${zone.zone_number}`}</h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-muted-foreground font-bold capitalize">{t(`status_${getZoneStatus(zone)}`)}</span>
                                                {zone.leak_count > 0 && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-50 text-red-700">
                                                        {zone.leak_count} {t("leak_detected")}
                                                    </span>
                                                )}
                                                {zone.health_score > 0 && (
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${zone.health_score >= 7 ? "bg-emerald-50 text-emerald-700" : zone.health_score >= 4 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                                                        {zone.health_score.toFixed(1)}/10
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`w-3 h-3 rounded-full ${config.dot}`}></div>
                                </div>

                                <MoistureBar level={zone.avg_moisture_pct ?? 0} status={getZoneStatus(zone)} />

                                {/* Irrigation Control */}
                                {(() => {
                                    const isIrrigating = controlStates?.zone_valves?.[zone.zone_number] ?? false;
                                    const isManualMode = controlStates?.manual_overrides?.[zone.zone_number] ?? false;
                                    return (
                                        <>
                                            <div className="flex items-center gap-2 mt-3">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setControlDialog({
                                                            zoneId: zone.zone_id,
                                                            zoneName: zone.zone_name || `Zone ${zone.zone_number}`,
                                                            action: isIrrigating ? "stop_irrigation" : "start_irrigation",
                                                        });
                                                    }}
                                                    disabled={controlLoading}
                                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                                                        isIrrigating
                                                            ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                                                            : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                    }`}
                                                >
                                                    <Power className="w-3.5 h-3.5" />
                                                    {isIrrigating ? t("stop") : t("start")}
                                                </button>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleOverride(zone.zone_id, !isManualMode);
                                                    }}
                                                    className="flex items-center gap-1 px-2 py-2 rounded-lg text-xs font-bold border border-border hover:bg-muted"
                                                    title={isManualMode ? t("switch_to_auto") : t("switch_to_manual")}
                                                >
                                                    {isManualMode
                                                        ? <ToggleRight className="w-4 h-4 text-amber-600" />
                                                        : <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                                                    }
                                                </button>
                                            </div>

                                            {isManualMode && (
                                                <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                                                    <ToggleRight className="w-3 h-3" />
                                                    {t("manual_mode")}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}

                                {zone.irrigation_needed && (
                                    <div className="flex items-center gap-2 mt-3 bg-sky-50 text-sky-700 px-3 py-1.5 rounded-lg border border-sky-100">
                                        <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></div>
                                        <span className="text-xs font-bold">{t("irrigation_active")}</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-auto bg-muted/50 p-4">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="text-center">
                                        <div className="w-10 h-10 mx-auto bg-card rounded-xl border border-border flex items-center justify-center mb-1">
                                            <Droplets className="w-5 h-5 text-blue-500" />
                                        </div>
                                        <p className="text-xs font-black text-foreground" dir="ltr">{(zone.total_inlet_flow_lpm ?? 0).toFixed(1)} L/m</p>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase">{t("inlet")}</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="w-10 h-10 mx-auto bg-card rounded-xl border border-border flex items-center justify-center mb-1">
                                            <Gauge className="w-5 h-5 text-green-500" />
                                        </div>
                                        <p className="text-xs font-black text-foreground" dir="ltr">{(zone.water_efficiency_pct ?? 0).toFixed(0)}%</p>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase">{t("efficiency")}</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="w-10 h-10 mx-auto bg-card rounded-xl border border-border flex items-center justify-center mb-1">
                                            <Activity className="w-5 h-5 text-purple-500" />
                                        </div>
                                        <p className="text-xs font-black text-foreground" dir="ltr">{zone.branches?.length ?? 0}</p>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase">{t("branches")}</p>
                                    </div>
                                </div>
                            </div>

                            {isSelected && zone.branches && zone.branches.length > 0 && (
                                <div className="border-t border-border p-4 space-y-2">
                                    <p className="text-xs font-bold text-muted-foreground uppercase mb-2">{t("branch_details")}</p>
                                    {zone.branches.map((branch: BranchReading) => (
                                        <BranchCard
                                            key={branch.branch_id}
                                            branch={branch}
                                            isExpanded={expandedBranches.has(branch.branch_id)}
                                            onToggle={() => toggleBranch(branch.branch_id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {controlDialog && (
                <ControlConfirmDialog
                    zoneName={controlDialog.zoneName}
                    action={controlDialog.action}
                    loading={controlLoading}
                    onConfirm={(durationMinutes) => handleControlZone(controlDialog.zoneId, controlDialog.action, durationMinutes)}
                    onCancel={() => setControlDialog(null)}
                />
            )}
        </div>
    );
}
