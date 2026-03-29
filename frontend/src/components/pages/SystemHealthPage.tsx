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

interface SystemHealthPageProps {
    healthData?: HealthData;
}

export function SystemHealthPage({ healthData }: SystemHealthPageProps) {
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
                const res = await fetch(`${getApiBaseUrl()}/api/anomalies/health`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
        { key: "hydraulic", score: data.hydraulic_health_score, icon: Droplets, color: "text-blue-500" },
        { key: "agronomic", score: data.agronomic_health_score, icon: Thermometer, color: "text-green-500" },
        { key: "equipment", score: data.equipment_health_score, icon: Gauge, color: "text-purple-500" },
        { key: "data", score: data.data_quality_score, icon: Activity, color: "text-orange-500" },
    ];

    const totalAnomalies = data.active_anomalies_critical + data.active_anomalies_high + data.active_anomalies_medium + data.active_anomalies_low;

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">{t("title")}</h1>
                <p className="text-sm text-muted-foreground">
                    {t("lastUpdated")}: {data.snapshot_at ? new Date(data.snapshot_at).toLocaleString() : "—"}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                    <h2 className="text-lg font-semibold mb-6 text-center">{t("overallScore")}</h2>
                    <div className="flex justify-center">
                        <HealthScoreRing score={data.overall_score} label={t("overall")} size="lg" />
                    </div>
                </div>

                <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                    <h2 className="text-lg font-semibold mb-6">{t("domainScores")}</h2>
                    <div className="grid grid-cols-2 gap-6 justify-items-center">
                        {domainScores.map(({ key, score, icon: Icon, color }) => (
                            <div key={key} className="flex flex-col items-center gap-2">
                                <HealthScoreRing score={score} label={t(key)} size="md" />
                                <Icon className={`w-5 h-5 ${color}`} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mb-6">
                <AnomalyTimeline days={7} />
            </div>

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

export default SystemHealthPage;
