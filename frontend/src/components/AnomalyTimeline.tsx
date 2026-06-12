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

const BAR_MAX_PX = 88;

export function AnomalyTimeline({ days = 7 }: { days?: number }) {
    const t = useTranslations("Anomalies");
    const [data, setData] = useState<TimelineData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const fetchTimeline = async () => {
            try {
                const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
                const farmId = typeof window !== "undefined" ? localStorage.getItem("activeFarmId") : null;
                const headers: Record<string, string> = {};
                if (token) headers["Authorization"] = `Bearer ${token}`;
                if (farmId) headers["X-Farm-ID"] = farmId;
                const res = await fetch(`${getApiBaseUrl()}/api/anomalies/timeline?days=${days}`, { headers });
                if (res.ok && !cancelled) setData(await res.json());
            } catch {
                // silently ignore — chart stays empty
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchTimeline();
        return () => { cancelled = true; };
    }, [days]);

    if (loading) {
        return (
            <div className="bg-card rounded-xl border border-border p-4">
                <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-28 bg-muted rounded" />
                </div>
            </div>
        );
    }

    const maxTotal = Math.max(...data.map(d => d.total), 1);
    const grandTotal = data.reduce((s, d) => s + d.total, 0);

    return (
        <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-bold text-foreground">{t("timeline")}</h3>
                </div>
                {grandTotal > 0 && (
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {grandTotal} total
                    </span>
                )}
            </div>

            {data.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t("noData")}</p>
            ) : (
                <div className="flex items-end gap-1.5" style={{ height: `${BAR_MAX_PX + 20}px` }}>
                    {data.map((day, idx) => {
                        const barH = Math.round((day.total / maxTotal) * BAR_MAX_PX);
                        const hasCrit = day.critical > 0;
                        const critH = day.total > 0 ? Math.round((day.critical / day.total) * barH) : 0;
                        const highH = day.total > 0 ? Math.round((day.high / day.total) * barH) : 0;
                        const medH  = day.total > 0 ? Math.round((day.medium  / day.total) * barH) : 0;
                        const lowH  = Math.max(0, barH - critH - highH - medH);

                        return (
                            <div
                                key={idx}
                                className="flex-1 flex flex-col items-center justify-end relative group cursor-default"
                                style={{ height: `${BAR_MAX_PX + 20}px` }}
                            >
                                {/* Hover tooltip */}
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs whitespace-nowrap">
                                    <p className="font-semibold text-foreground mb-1">
                                        {new Date(day.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                                    </p>
                                    {day.total === 0 ? (
                                        <p className="text-muted-foreground">{t("noData")}</p>
                                    ) : (
                                        <div className="space-y-0.5 text-muted-foreground">
                                            {day.critical > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-red-600 rounded-full" />{day.critical} {t("critical")}</div>}
                                            {day.high > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-orange-500 rounded-full" />{day.high} {t("high")}</div>}
                                            {day.medium > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-yellow-500 rounded-full" />{day.medium} {t("medium")}</div>}
                                            {day.low > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-blue-400 rounded-full" />{day.low} {t("low")}</div>}
                                            <div className="border-t border-border pt-0.5 font-semibold text-foreground">{day.total} total</div>
                                        </div>
                                    )}
                                </div>

                                {/* Stacked bar (grows upward) */}
                                {day.total === 0 ? (
                                    <div className="w-full bg-muted rounded-sm mb-4" style={{ height: "3px" }} />
                                ) : (
                                    <div
                                        className={`w-full overflow-hidden rounded-t flex flex-col-reverse mb-4 ${hasCrit ? "ring-1 ring-red-500/30" : ""}`}
                                        style={{ height: `${barH}px` }}
                                    >
                                        {critH > 0 && <div className="w-full shrink-0 bg-red-600" style={{ height: `${critH}px` }} />}
                                        {highH > 0 && <div className="w-full shrink-0 bg-orange-500" style={{ height: `${highH}px` }} />}
                                        {medH  > 0 && <div className="w-full shrink-0 bg-yellow-500" style={{ height: `${medH}px`  }} />}
                                        {lowH  > 0 && <div className="w-full shrink-0 bg-blue-400"   style={{ height: `${lowH}px`  }} />}
                                    </div>
                                )}

                                {/* Date label */}
                                <span className="text-[9px] text-muted-foreground leading-none">
                                    {new Date(day.date + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {data.length > 0 && (
                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-600 rounded-full" /><span>{t("critical")}</span></div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-orange-500 rounded-full" /><span>{t("high")}</span></div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-500 rounded-full" /><span>{t("medium")}</span></div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-400 rounded-full" /><span>{t("low")}</span></div>
                </div>
            )}
        </div>
    );
}
