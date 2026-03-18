"use client";

import { useTranslations } from "next-intl";
import { Droplets, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import type { BranchReading } from "@/lib/store/slices/iotSlice";

interface BranchCardProps {
    branch: BranchReading;
    isExpanded: boolean;
    onToggle: () => void;
}

export function BranchCard({ branch, isExpanded, onToggle }: BranchCardProps) {
    const t = useTranslations("ZoneGrid");
    const leakPercent = branch.inlet_flow_lpm > 0 
        ? ((branch.flow_delta_lpm / branch.inlet_flow_lpm) * 100).toFixed(1) 
        : "0";
    
    const getLeakStatus = () => {
        if (branch.leak_detected) {
            const pct = parseFloat(leakPercent);
            if (pct > 25) return { color: "text-red-500", bg: "bg-red-500/10", label: t("critical") };
            return { color: "text-amber-500", bg: "bg-amber-500/10", label: t("warning") };
        }
        return { color: "text-emerald-500", bg: "bg-emerald-500/10", label: t("normal") };
    };
    
    const leakStatus = getLeakStatus();
    
    const getMoistureColor = (val: number) => {
        if (val < 20) return "bg-red-500";
        if (val < 30) return "bg-amber-500";
        if (val < 55) return "bg-emerald-500";
        return "bg-blue-500";
    };

    const getUniformityLabel = (uc: number) => {
        if (uc >= 0.9) return { text: "text-emerald-500", label: t("uniformity_excellent") };
        if (uc >= 0.8) return { text: "text-amber-500", label: t("uniformity_good") };
        if (uc >= 0.7) return { text: "text-amber-500", label: t("uniformity_fair") };
        return { text: "text-red-500", label: t("uniformity_poor") };
    };

    const uniformity = getUniformityLabel(branch.uniformity_coefficient);

    return (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
            <button
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                onClick={onToggle}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${leakStatus.bg}`}>
                        {branch.leak_detected ? (
                            <AlertTriangle className={`w-4 h-4 ${leakStatus.color}`} />
                        ) : (
                            <CheckCircle2 className={`w-4 h-4 ${leakStatus.color}`} />
                        )}
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-semibold text-foreground">
                            {branch.branch_name || `Branch ${branch.branch_number}`}
                        </p>
                        <p className={`text-xs ${leakStatus.color}`}>{leakStatus.label}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground">{t("flow_delta")}</p>
                        <p className={`text-sm font-bold ${leakStatus.color}`}>
                            {branch.flow_delta_lpm.toFixed(2)} L/min ({leakPercent}%)
                        </p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
            </button>

            {isExpanded && (
                <div className="p-3 pt-0 space-y-3 border-t border-border">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-muted/30 rounded-lg p-2">
                            <div className="flex items-center gap-1 mb-1">
                                <Droplets className="w-3 h-3 text-blue-500" />
                                <span className="text-[10px] text-muted-foreground">{t("inlet")}</span>
                            </div>
                            <p className="text-sm font-bold" dir="ltr">{branch.inlet_flow_lpm.toFixed(2)} L/min</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                            <div className="flex items-center gap-1 mb-1">
                                <Droplets className="w-3 h-3 text-green-500" />
                                <span className="text-[10px] text-muted-foreground">{t("outlet")}</span>
                            </div>
                            <p className="text-sm font-bold" dir="ltr">{branch.outlet_flow_lpm.toFixed(2)} L/min</p>
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] text-muted-foreground mb-1">{t("soil_moisture")} ({t("moisture_start")} → {t("moisture_middle")} → {t("moisture_end")})</p>
                        <div className="flex items-center gap-1">
                            <div className="flex-1">
                                <div className={`h-4 rounded ${getMoistureColor(branch.moisture_start_pct)}`} style={{ width: `${branch.moisture_start_pct}%` }}></div>
                                <p className="text-[10px] text-center mt-0.5">{branch.moisture_start_pct.toFixed(1)}%</p>
                            </div>
                            <div className="flex-1">
                                <div className={`h-4 rounded ${getMoistureColor(branch.moisture_middle_pct)}`} style={{ width: `${branch.moisture_middle_pct}%` }}></div>
                                <p className="text-[10px] text-center mt-0.5">{branch.moisture_middle_pct.toFixed(1)}%</p>
                            </div>
                            <div className="flex-1">
                                <div className={`h-4 rounded ${getMoistureColor(branch.moisture_end_pct)}`} style={{ width: `${branch.moisture_end_pct}%` }}></div>
                                <p className="text-[10px] text-center mt-0.5">{branch.moisture_end_pct.toFixed(1)}%</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[10px] text-muted-foreground">{t("uniformity")}: </span>
                            <span className={`text-xs font-semibold ${uniformity.text}`}>
                                {(branch.uniformity_coefficient * 100).toFixed(0)}% ({uniformity.label})
                            </span>
                        </div>
                        <div>
                            <span className={`text-xs font-semibold ${branch.valve_open ? "text-blue-500" : "text-muted-foreground"}`}>
                                {branch.valve_open ? t("valve_open") : t("valve_closed")}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
