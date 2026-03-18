"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, AlertOctagon, PauseCircle, Settings2, WifiOff, Droplets, Gauge, Activity } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppSelector } from "@/lib/store/hooks";
import type { BranchReading, ZoneReading } from "@/lib/store/slices/iotSlice";
import { ReservoirIndicator } from "./ReservoirIndicator";
import { BranchCard } from "./BranchCard";
import { isDebugMode, debugLog, useDebugLog } from "@/lib/debug";

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
    const [selected, setSelected] = useState<string | null>(null);
    const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
    const t = useTranslations("ZoneGrid");

    const { zones: sseZones, environment, infrastructure, simulatorRunning, connected, lastUpdate } = useAppSelector((state) => state.iot);
    const hasLiveData = connected && sseZones && sseZones.length > 0;

    useDebugLog("ZoneGrid - zones", sseZones);
    useDebugLog("ZoneGrid - environment", environment);
    useDebugLog("ZoneGrid - connected", connected);
    useDebugLog("ZoneGrid - simulatorRunning", simulatorRunning);

    const getZoneStatus = (zone: ZoneReading) => {
        if (!zone) return "off";
        if (zone.leak_count > 0) return "critical";
        if ((zone.avg_moisture_pct ?? 100) < 40) return "warning";
        return "good";
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

    if (!hasLiveData) {
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
                label: t("status_good")
            },
            warning: { 
                dot: "bg-amber-500 animate-pulse", 
                border: "border-amber-500/30", 
                bg: "bg-card", 
                icon: AlertTriangle, 
                text: "text-amber-500", 
                bgSoft: "bg-amber-500/10",
                label: t("status_warning")
            },
            critical: { 
                dot: "bg-red-500 animate-pulse", 
                border: "border-red-500/30", 
                bg: "bg-card", 
                icon: AlertOctagon, 
                text: "text-red-500", 
                bgSoft: "bg-red-500/10",
                label: t("status_critical")
            },
            off: { 
                dot: "bg-muted-foreground/40", 
                border: "border-border", 
                bg: "bg-card opacity-60", 
                icon: PauseCircle, 
                text: "text-muted-foreground", 
                bgSoft: "bg-muted/50",
                label: t("status_off")
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
                            <span>{t("live")}</span>
                            {lastUpdateTime && <span className="text-emerald-500/70" dir="ltr">{lastUpdateTime}</span>}
                        </span>
                    ) : (
                        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border">
                            <WifiOff className="w-3.5 h-3.5" />
                            <span>{t("status_off")}</span>
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {sseZones.map((zone: ZoneReading) => {
                    const isExpanded = selected === zone.zone_id;
                    const config = getStatusConfig(getZoneStatus(zone));
                    const Icon = config.icon;
                    const hasLeaks = zone.leak_count > 0;

                    return (
                        <div
                            key={zone.zone_id}
                            className={`group rounded-2xl border ${config.border} bg-card flex flex-col transition-all duration-300 hover:shadow-xl hover:shadow-black/5 ${
                                isExpanded ? "ring-2 ring-primary/20" : ""
                            }`}
                        >
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-3 items-center">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${config.bgSoft} ${config.border}`}>
                                            <Icon className={`w-6 h-6 ${config.text}`} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-foreground leading-none mb-1">
                                                {zone.zone_name || `Zone ${zone.zone_number}`}
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${config.dot}`}></div>
                                                <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
                                                {hasLeaks && (
                                                    <span className="text-xs font-medium text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                                                        {zone.leak_count} {t("leak_detected")}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <ReservoirIndicator level={infrastructure?.reservoir_level_pct ?? 0} showLabel={false} />
                                </div>

                                <div className="mb-4">
                                    <MoistureBar level={zone.avg_moisture_pct ?? 0} status={getZoneStatus(zone)} />
                                </div>

                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                                        <div className="flex items-center justify-center gap-1 mb-1">
                                            <Droplets className="w-3.5 h-3.5 text-blue-500" />
                                            <span className="text-[10px] font-medium text-muted-foreground uppercase">{t("flow")}</span>
                                        </div>
                                        <p className="text-lg font-bold text-foreground" dir="ltr">
                                            {(zone.total_inlet_flow_lpm ?? 0).toFixed(1)} <span className="text-[10px] text-muted-foreground">L/min</span>
                                        </p>
                                    </div>
                                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                                        <div className="flex items-center justify-center gap-1 mb-1">
                                            <Gauge className="w-3.5 h-3.5 text-green-500" />
                                            <span className="text-[10px] font-medium text-muted-foreground uppercase">{t("efficiency")}</span>
                                        </div>
                                        <p className="text-lg font-bold text-foreground" dir="ltr">
                                            {(zone.water_efficiency_pct ?? 0).toFixed(0)} <span className="text-[10px] text-muted-foreground">%</span>
                                        </p>
                                    </div>
                                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                                        <div className="flex items-center justify-center gap-1 mb-1">
                                            <Activity className="w-3.5 h-3.5 text-purple-500" />
                                            <span className="text-[10px] font-medium text-muted-foreground uppercase">{t("health_score")}</span>
                                        </div>
                                        <p className="text-lg font-bold text-foreground" dir="ltr">
                                            {(zone.health_score ?? 0).toFixed(1)} <span className="text-[10px] text-muted-foreground">/10</span>
                                        </p>
                                    </div>
                                </div>

                                <button
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-muted/50 hover:bg-muted border border-border transition-colors text-muted-foreground font-medium text-sm"
                                    onClick={() => setSelected(isExpanded ? null : zone.zone_id)}
                                >
                                    <Settings2 className="w-4 h-4" />
                                    <span>{isExpanded ? t("hide_details") : t("details")} ({zone.branches?.length ?? 0} branches)</span>
                                </button>
                            </div>

                            {isExpanded && zone.branches && zone.branches.length > 0 && (
                                <div className="border-t border-border bg-muted/20 p-4 space-y-3">
                                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("branches")}</h4>
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
        </div>
    );
}
