"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Droplets, Thermometer, Gauge, Activity, AlertTriangle } from "lucide-react";
import { HealthScoreRing } from "@/components/HealthScoreRing";
import { AnomalyTimeline } from "@/components/AnomalyTimeline";
import { getApiBaseUrl } from "@/lib/apiConfig";

interface HealthData {
    farm_id: string;
    snapshot_at: string;
    hydraulic_health_score: number;
    agronomic_health_score: number;
    equipment_health_score: number;
    data_quality_score: number;
    overall_score: number;
    active_anomalies_critical: number;
    active_anomalies_high: number;
    active_anomalies_medium: number;
    active_anomalies_low: number;
}

export function SystemHealthPage({ healthData }: { healthData?: HealthData }) {
    const t = useTranslations("SystemHealth");
    const [data, setData] = useState<HealthData | null>(healthData || null);
    const [loading, setLoading] = useState(!healthData);

    useEffect(() => {
        if (healthData) {
            setData(healthData);
            return;
        }
        const fetchHealth = async () => {
            try {
                const token = localStorage.getItem("token");
                const farmId = localStorage.getItem("activeFarmId");
                const headers: Record<string, string> = {};
                if (token) headers["Authorization"] = `Bearer ${token}`;
                if (farmId) headers["X-Farm-ID"] = farmId;
                const res = await fetch(`${getApiBaseUrl()}/api/anomalies/health`, { headers });
                if (res.ok) setData(await res.json());
            } catch (err) {
                console.error("Failed to fetch health:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchHealth();
    }, [healthData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <AlertTriangle className="w-12 h-12 text-amber-500" />
                <p className="text-muted-foreground">{t("noData")}</p>
            </div>
        );
    }

    const domainScores = [
        {
            key: "hydraulic" as const,
            score: data.hydraulic_health_score,
            icon: Droplets,
            color: "text-blue-500",
            desc: t("hydraulic_desc"),
        },
        {
            key: "agronomic" as const,
            score: data.agronomic_health_score,
            icon: Thermometer,
            color: "text-green-500",
            desc: t("agronomic_desc"),
        },
        {
            key: "equipment" as const,
            score: data.equipment_health_score,
            icon: Gauge,
            color: "text-purple-500",
            desc: t("equipment_desc"),
        },
        {
            key: "data" as const,
            score: data.data_quality_score,
            icon: Activity,
            color: "text-orange-500",
            desc: t("data_desc"),
        },
    ];

    const totalAnomalies =
        data.active_anomalies_critical +
        data.active_anomalies_high +
        data.active_anomalies_medium +
        data.active_anomalies_low;

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">{t("title")}</h1>
                <p className="text-sm text-muted-foreground">
                    {t("lastUpdated")}:{" "}
                    {data.snapshot_at ? new Date(data.snapshot_at).toLocaleString() : "—"}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Overall score */}
                <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                    <h2 className="text-lg font-semibold mb-6 text-center">{t("overallScore")}</h2>
                    <div className="flex justify-center">
                        <div className="relative inline-block">
                            <HealthScoreRing score={data.overall_score} label={t("overall")} size="lg" />
                            <InfoTooltip text={t("overall_desc")} />
                        </div>
                    </div>
                </div>

                {/* Domain scores */}
                <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                    <h2 className="text-lg font-semibold mb-6">{t("domainScores")}</h2>
                    <div className="grid grid-cols-2 gap-6 justify-items-center">
                        {domainScores.map(({ key, score, icon: Icon, color, desc }) => (
                            <div key={key} className="flex flex-col items-center gap-2">
                                <div className="relative">
                                    <HealthScoreRing score={score} label={t(key)} size="md" />
                                    <InfoTooltip text={desc} />
                                </div>
                                <Icon className={`w-5 h-5 ${color}`} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mb-6">
                <AnomalyTimeline days={7} />
            </div>

            {/* Active anomalies */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <h2 className="text-lg font-semibold mb-4">{t("activeAnomalies")}</h2>
                <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-red-500/10 text-center">
                        <p className="text-2xl font-bold text-red-500">{data.active_anomalies_critical}</p>
                        <p className="text-xs text-muted-foreground">{t("critical")}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-orange-500/10 text-center">
                        <p className="text-2xl font-bold text-orange-500">{data.active_anomalies_high}</p>
                        <p className="text-xs text-muted-foreground">{t("high")}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-500/10 text-center">
                        <p className="text-2xl font-bold text-amber-500">{data.active_anomalies_medium}</p>
                        <p className="text-xs text-muted-foreground">{t("medium")}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-blue-500/10 text-center">
                        <p className="text-2xl font-bold text-blue-500">{data.active_anomalies_low}</p>
                        <p className="text-xs text-muted-foreground">{t("low")}</p>
                    </div>
                </div>
                {totalAnomalies === 0 && (
                    <p className="text-center text-emerald-500 mt-4 font-medium">{t("noAnomalies")}</p>
                )}
            </div>
        </div>
    );
}

/** (!) button with hover tooltip */
function InfoTooltip({ text }: { text: string }) {
    return (
        <div className="absolute -top-1 -end-1 group/tip z-10">
            <button
                type="button"
                aria-label="More info"
                className="w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center cursor-help text-[9px] font-black text-muted-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
            >
                !
            </button>
            {/* Tooltip panel */}
            <div className="absolute bottom-full end-0 mb-2 z-30 w-56 opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity duration-200">
                <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs p-3 rounded-xl shadow-xl leading-relaxed">
                    {text}
                </div>
                <div className="absolute top-full end-2 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-100" />
            </div>
        </div>
    );
}

export default SystemHealthPage;
