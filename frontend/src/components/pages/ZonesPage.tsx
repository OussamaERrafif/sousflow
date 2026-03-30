"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { getApiBaseUrl } from "@/lib/apiConfig";
import {
    useGetSimulatorStatusApiIotSimulatorStatusGetQuery,
} from "@/lib/store/generated/api";
import { useAppSelector } from "@/lib/store/hooks";
import type { BranchReading, ZoneReading } from "@/lib/store/slices/iotSlice";
import {
    CheckCircle2, AlertTriangle, AlertOctagon, PauseCircle,
    Wifi, WifiOff, Droplets, Gauge, Activity, Thermometer,
    Power, ToggleLeft, ToggleRight, Waves, ChevronDown, ChevronUp,
} from "lucide-react";
import { BranchCard } from "../BranchCard";
import { WaterConsumptionChart } from "../WaterConsumptionChart";
import { useDebugLog } from "@/lib/debug";
import { ControlConfirmDialog } from "../ControlConfirmDialog";

function MoistureBar({ level, status }: { level: number; status: string }) {
    const t = useTranslations("ZoneGrid");
    const getColor = () => {
        if (status === "off") return { fill: "bg-muted-foreground/30", text: "text-muted-foreground", label: "Off" };
        if (level < 40) return { fill: "bg-red-500", text: "text-red-500", label: "Critical" };
        if (level < 55) return { fill: "bg-amber-500", text: "text-amber-500", label: "Low" };
        if (level < 75) return { fill: "bg-emerald-500", text: "text-emerald-500", label: "Optimal" };
        return { fill: "bg-blue-500", text: "text-blue-500", label: "High" };
    };
    const c = getColor();
    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{t("moisture")}</span>
                <span className={`text-xs font-semibold ${c.text}`}>{c.label} · {level}%</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full ${c.fill} rounded-full transition-all duration-700 ease-out`}
                    style={{ width: `${Math.min(level, 100)}%` }}
                />
            </div>
        </div>
    );
}

const STATUS_CONFIG = {
    good: {
        dot: "bg-emerald-500",
        border: "border-emerald-500/25",
        topBorder: "border-t-2 border-t-emerald-500",
        icon: CheckCircle2,
        text: "text-emerald-600 dark:text-emerald-400",
        iconBg: "bg-emerald-500/10 border-emerald-500/20",
        label: "Good",
    },
    warning: {
        dot: "bg-amber-500 animate-pulse",
        border: "border-amber-500/30",
        topBorder: "border-t-2 border-t-amber-500",
        icon: AlertTriangle,
        text: "text-amber-600 dark:text-amber-400",
        iconBg: "bg-amber-500/10 border-amber-500/20",
        label: "Warning",
    },
    critical: {
        dot: "bg-red-500 animate-pulse",
        border: "border-red-500/30",
        topBorder: "border-t-2 border-t-red-500",
        icon: AlertOctagon,
        text: "text-red-600 dark:text-red-400",
        iconBg: "bg-red-500/10 border-red-500/20",
        label: "Critical",
    },
    off: {
        dot: "bg-muted-foreground/40",
        border: "border-border",
        topBorder: "border-t-2 border-t-muted-foreground/20",
        icon: PauseCircle,
        text: "text-muted-foreground",
        iconBg: "bg-muted border-border",
        label: "Off",
    },
} as const;

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

    const { zones: sseZones, environment, controlStates, simulatorRunning, connected, lastUpdate } = useAppSelector((state) => state.iot);
    const hasLiveData = connected && sseZones && sseZones.length > 0;

    useDebugLog("ZonesPage - sseZones", sseZones);
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

            const res = await fetch(`${getApiBaseUrl()}/api/control/zone/${zoneId}`, {
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

            await fetch(`${getApiBaseUrl()}/api/control/zone/${zoneId}/override`, {
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
            next.has(branchId) ? next.delete(branchId) : next.add(branchId);
            return next;
        });
    };

    const lastUpdateTime = lastUpdate
        ? new Date(lastUpdate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : null;

    if (!hasLiveData) {
        return (
            <div className="w-full">
                <div className="mb-6 h-8 bg-muted rounded-xl animate-pulse w-48" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-56 bg-muted rounded-2xl animate-pulse" />)}
                </div>
            </div>
        );
    }

    const totalLeakCount = sseZones.reduce((sum: number, z: ZoneReading) => sum + (z.leak_count ?? 0), 0);
    const avgEfficiency = sseZones.length > 0
        ? sseZones.reduce((sum: number, z: ZoneReading) => sum + (z.water_efficiency_pct ?? 0), 0) / sseZones.length
        : 0;
    const totalFlow = sseZones.reduce((sum: number, z: ZoneReading) => sum + (z.total_inlet_flow_lpm ?? 0), 0);
    const criticalCount = sseZones.filter((z: ZoneReading) => getZoneStatus(z) === "critical").length;
    const warningCount = sseZones.filter((z: ZoneReading) => getZoneStatus(z) === "warning").length;

    return (
        <div className="w-full">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-foreground tracking-tight">{t("title")}</h1>
                    <div className="flex items-center gap-2 mt-1.5">
                        {simulatorStatus?.running ? (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                {t("active")} — {sseZones.length} zones
                            </span>
                        ) : (
                            <span className="text-xs text-muted-foreground">{sseZones.length} zones</span>
                        )}
                        {criticalCount > 0 && (
                            <span className="text-[11px] font-semibold bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full">
                                {criticalCount} critical
                            </span>
                        )}
                        {warningCount > 0 && (
                            <span className="text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                {warningCount} warning
                            </span>
                        )}
                    </div>
                </div>
                {connected ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 shrink-0">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        Live
                        {lastUpdateTime && <span className="opacity-60 hidden sm:inline" dir="ltr">{lastUpdateTime}</span>}
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full border border-border shrink-0">
                        <WifiOff className="w-3 h-3" />
                        Offline
                    </span>
                )}
            </div>

            {/* Leak alert */}
            {totalLeakCount > 0 && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                    <AlertOctagon className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                        {totalLeakCount} {t("leak_detected")}
                    </span>
                </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                    { icon: Droplets, value: `${totalFlow.toFixed(1)}`, unit: "L/min", label: t("total_flow"), iconBg: "bg-blue-500/10", iconColor: "text-blue-500" },
                    { icon: Gauge, value: `${avgEfficiency.toFixed(0)}`, unit: "%", label: t("avg_efficiency"), iconBg: "bg-emerald-500/10", iconColor: "text-emerald-500" },
                    { icon: Thermometer, value: environment?.air_temperature_c?.toFixed(1) ?? "--", unit: "°C", label: t("temperature"), iconBg: "bg-amber-500/10", iconColor: "text-amber-500" },
                    { icon: Activity, value: environment?.air_humidity_pct?.toFixed(0) ?? "--", unit: "%", label: t("humidity"), iconBg: "bg-cyan-500/10", iconColor: "text-cyan-500" },
                ].map(({ icon: Icon, value, unit, label, iconBg, iconColor }) => (
                    <div key={label} className="p-5 rounded-2xl border border-border bg-card shadow-sm hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300">
                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-border ${iconBg}`}>
                                <Icon className={`w-5 h-5 ${iconColor}`} />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-foreground tracking-tight" dir="ltr">
                            {value}<span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
                        </h3>
                        <p className="text-sm font-medium text-muted-foreground mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* Water chart */}
            <div className="mb-6">
                <WaterConsumptionChart
                    zones={sseZones.map((z: ZoneReading) => ({
                        zone_id: z.zone_id,
                        zone_name: z.zone_name || `Zone ${z.zone_number}`,
                        inlet_lpm: z.total_inlet_flow_lpm ?? 0,
                        outlet_lpm: z.total_outlet_flow_lpm ?? 0,
                        efficiency_pct: z.water_efficiency_pct ?? 0,
                    }))}
                />
            </div>

            {/* Zone cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sseZones.map((zone: ZoneReading) => {
                    const statusKey = getZoneStatus(zone) as keyof typeof STATUS_CONFIG;
                    const cfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.good;
                    const Icon = cfg.icon;
                    const isSelected = selectedZoneId === zone.zone_id;
                    const isIrrigating = controlStates?.zone_valves?.[zone.zone_number] ?? false;
                    const isManualMode = controlStates?.manual_overrides?.[zone.zone_number] ?? false;

                    return (
                        <div
                            key={zone.zone_id}
                            className={`bg-card rounded-2xl border ${cfg.border} ${cfg.topBorder} flex flex-col overflow-hidden transition-shadow duration-200 hover:shadow-md hover:shadow-black/5`}
                        >
                            {/* Card header — clickable to expand branches */}
                            <div
                                className="p-4 cursor-pointer"
                                onClick={() => setSelectedZoneId(isSelected ? null : zone.zone_id)}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${cfg.iconBg}`}>
                                            <Icon className={`w-4 h-4 ${cfg.text}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-semibold text-foreground leading-tight truncate">
                                                {zone.zone_name || `Zone ${zone.zone_number}`}
                                            </h3>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                                                <span className={`text-[11px] font-medium ${cfg.text}`}>{cfg.label}</span>
                                                {zone.leak_count > 0 && (
                                                    <span className="text-[10px] font-semibold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full border border-red-500/20">
                                                        {zone.leak_count} leak{zone.leak_count > 1 ? "s" : ""}
                                                    </span>
                                                )}
                                                {zone.health_score > 0 && (
                                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                                                        zone.health_score >= 7
                                                            ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                                            : zone.health_score >= 4
                                                                ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20"
                                                                : "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20"
                                                    }`}>
                                                        {zone.health_score.toFixed(1)}/10
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {zone.irrigation_needed && (
                                        <div className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-full shrink-0">
                                            <Waves className="w-3 h-3 text-blue-500" />
                                            <span className="text-[10px] font-semibold text-blue-500">Active</span>
                                        </div>
                                    )}
                                </div>

                                <MoistureBar level={zone.avg_moisture_pct ?? 0} status={statusKey} />

                                {/* Stats */}
                                <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-border">
                                    {[
                                        { icon: Droplets, color: "text-blue-500", label: t("flow"), value: `${(zone.total_inlet_flow_lpm ?? 0).toFixed(1)}`, unit: "L/m" },
                                        { icon: Gauge, color: "text-emerald-500", label: t("efficiency"), value: `${(zone.water_efficiency_pct ?? 0).toFixed(0)}`, unit: "%" },
                                        { icon: Activity, color: "text-purple-500", label: t("health_score"), value: `${(zone.health_score ?? 0).toFixed(1)}`, unit: "/10" },
                                    ].map(({ icon: StatIcon, color, label, value, unit }) => (
                                        <div key={label} className="flex flex-col gap-1 min-w-0">
                                            <div className="flex items-center gap-1">
                                                <StatIcon className={`w-3 h-3 ${color} shrink-0`} />
                                                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</span>
                                            </div>
                                            <p className="text-sm font-bold text-foreground leading-none" dir="ltr">
                                                {value}<span className="text-[10px] font-normal text-muted-foreground ml-0.5">{unit}</span>
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="px-4 pb-4 flex items-center gap-2">
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
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                                        isIrrigating
                                            ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/20"
                                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
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
                                    className={`flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                                        isManualMode
                                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                            : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                                    }`}
                                    title={isManualMode ? t("switch_to_auto") : t("switch_to_manual")}
                                >
                                    {isManualMode
                                        ? <ToggleRight className="w-4 h-4" />
                                        : <ToggleLeft className="w-4 h-4" />
                                    }
                                    <span className="hidden sm:inline">{isManualMode ? "Manual" : "Auto"}</span>
                                </button>
                            </div>

                            {/* Branches toggle */}
                            {zone.branches && zone.branches.length > 0 && (
                                <button
                                    onClick={() => setSelectedZoneId(isSelected ? null : zone.zone_id)}
                                    className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/30 hover:bg-muted/60 transition-colors text-xs font-medium text-muted-foreground"
                                >
                                    <span>{zone.branches.length} {zone.branches.length === 1 ? "branch" : t("branches")}</span>
                                    {isSelected ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                            )}

                            {/* Branches panel */}
                            {isSelected && zone.branches && zone.branches.length > 0 && (
                                <div className="border-t border-border bg-muted/10 p-3 space-y-2">
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
