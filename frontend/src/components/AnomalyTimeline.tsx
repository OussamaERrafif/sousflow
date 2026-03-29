"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getApiBaseUrl } from "@/lib/apiConfig";
import { BarChart3 } from "lucide-react";

interface TimelineData {
    date: string;
    total: number;
    high: number;
    medium: number;
    low: number;
    critical: number;
}

interface AnomalyTimelineProps {
    days?: number;
}

export function AnomalyTimeline({ days = 7 }: AnomalyTimelineProps) {
    const t = useTranslations("Anomalies");
    const [data, setData] = useState<TimelineData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTimeline = async () => {
            try {
                const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
                const farmId = typeof window !== "undefined" ? localStorage.getItem("activeFarmId") : null;
                const headers: Record<string, string> = {};
                if (token) headers["Authorization"] = `Bearer ${token}`;
                if (farmId) headers["X-Farm-ID"] = farmId;

                const res = await fetch(`${getApiBaseUrl()}/api/anomalies/timeline?days=${days}`, { headers });
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (e) {
                console.error("Timeline error:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchTimeline();
    }, [days]);

    if (loading) {
        return (
            <div className="bg-card rounded-xl border border-border p-4">
                <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-muted rounded w-1/3"></div>
                    <div className="h-24 bg-muted rounded"></div>
                </div>
            </div>
        );
    }

    if (!data.length) {
        return (
            <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-bold text-foreground">{t("timeline") || "Anomaly Timeline"}</h3>
                </div>
                <p className="text-sm text-muted-foreground text-center py-4">{t("noData") || "No anomaly data for this period"}</p>
            </div>
        );
    }

    const maxTotal = Math.max(...data.map(d => d.total), 1);

    return (
        <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-bold text-foreground">{t("timeline") || "Anomaly Timeline"}</h3>
            </div>
            
            <div className="flex items-end gap-1 h-28">
                {data.map((day, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex flex-col gap-0.5">
                            {day.critical > 0 && (
                                <div
                                    className="w-full bg-red-600 rounded-t"
                                    style={{ height: `${(day.critical / maxTotal) * 100}%`, minHeight: day.critical > 0 ? '2px' : '0' }}
                                    title={`${day.critical} critical`}
                                />
                            )}
                            {day.high > 0 && (
                                <div
                                    className="w-full bg-orange-500"
                                    style={{ height: `${(day.high / maxTotal) * 100}%`, minHeight: '2px' }}
                                    title={`${day.high} high`}
                                />
                            )}
                            {day.medium > 0 && (
                                <div
                                    className="w-full bg-yellow-500"
                                    style={{ height: `${(day.medium / maxTotal) * 100}%`, minHeight: '2px' }}
                                    title={`${day.medium} medium`}
                                />
                            )}
                            {day.low > 0 && (
                                <div
                                    className="w-full bg-blue-400"
                                    style={{ height: `${(day.low / maxTotal) * 100}%`, minHeight: '2px' }}
                                    title={`${day.low} low`}
                                />
                            )}
                            {day.total === 0 && (
                                <div className="w-full h-1 bg-muted rounded" />
                            )}
                        </div>
                        <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                            {new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                    </div>
                ))}
            </div>
            
            <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                    <span>{t("critical") || "Critical"}</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span>{t("high") || "High"}</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span>{t("medium") || "Medium"}</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <span>{t("low") || "Low"}</span>
                </div>
            </div>
        </div>
    );
}
