"use client";

import { useState } from "react";
import { AlertOctagon, AlertTriangle, Info, CheckCircle, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppSelector } from "@/lib/store/hooks";

export default function AlertPanel() {
    const t = useTranslations("AlertPanel");
    const tz = useTranslations("Zones");
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    const { zones: sseZones, connected, lastUpdate } = useAppSelector((state) => state.iot);
    const hasLiveData = connected && sseZones && sseZones.length > 0;

    type Alert = {
        id: string;
        type: "critical" | "warning" | "info";
        title: string;
        desc: string;
        time: string;
    };

    const alerts: Alert[] = [];

    if (hasLiveData) {
        const timeStr = lastUpdate ? new Date(lastUpdate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : t("today");

        sseZones.forEach((z) => {
            const zoneName = z.zone_name || tz(`zone${z.zone_number}`);
            const pct = z.avg_moisture_pct ?? 0;
            if (z.leak_count > 0) {
                alerts.push({
                    id: `leak-${z.zone_id}`,
                    type: "critical",
                    title: t("anomaly_title", { zone: zoneName }),
                    desc: t("anomaly_desc", { stress: z.stress_class ?? t("unknown") }),
                    time: timeStr,
                });
            } else if (pct < 35) {
                alerts.push({
                    id: `critical-dry-${z.zone_id}`,
                    type: "critical",
                    title: t("critical_dry_title", { zone: zoneName }),
                    desc: t("critical_dry_desc", { pct: pct.toFixed(0) }),
                    time: timeStr,
                });
            } else if (pct < 45) {
                alerts.push({
                    id: `low-${z.zone_id}`,
                    type: "warning",
                    title: t("low_moisture_title", { zone: zoneName }),
                    desc: t("low_moisture_desc", { pct: pct.toFixed(0) }),
                    time: timeStr,
                });
            } else if (z.irrigation_needed) {
                alerts.push({
                    id: `irr-${z.zone_id}`,
                    type: "info",
                    title: t("irrigation_active_title", { zone: zoneName }),
                    desc: t("irrigation_active_desc", { pct: pct.toFixed(0) }),
                    time: timeStr,
                });
            }
        });
    } else {
        // Fallback static alerts when not connected
        alerts.push(
            { id: "s1", type: "critical", title: t("static_alert1_title"), desc: t("static_alert1_desc"), time: "8 min" },
            { id: "s2", type: "warning",  title: t("static_alert2_title"), desc: t("static_alert2_desc"), time: "2 h" },
            { id: "s3", type: "info",     title: t("static_alert3_title"), desc: t("static_alert3_desc"), time: t("today") },
        );
    }

    const visible = alerts.filter(a => !dismissed.has(a.id));
    const unreadCount = visible.filter(a => a.type !== "info").length;

    const getIcon = (type: string) => {
        switch (type) {
            case "critical": return <AlertOctagon className="w-5 h-5 text-red-600" />;
            case "warning":  return <AlertTriangle className="w-5 h-5 text-amber-500" />;
            case "info":     return <Info className="w-5 h-5 text-sky-500" />;
            default:         return <CheckCircle className="w-5 h-5 text-emerald-500" />;
        }
    };

    const getBorderStyle = (type: string) =>
        ({ critical: "border-l-4 border-red-500 rtl:border-r-4 rtl:border-l-0", warning: "border-l-4 border-amber-400 rtl:border-r-4 rtl:border-l-0", info: "border-l-4 border-sky-400 rtl:border-r-4 rtl:border-l-0" }[type] ?? "");

    const getIconBg = (type: string) =>
        ({ critical: "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800", warning: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800", info: "bg-sky-50 dark:bg-sky-900/20 border-sky-100 dark:border-sky-800" }[type] ?? "bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700");

    return (
        <div className="mb-24 md:mb-8">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100 tracking-tight">{t("title")}</h2>
                    {hasLiveData && (
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            {t("live")}
                        </span>
                    )}
                </div>
                {unreadCount > 0 && (
                    <button
                        className="text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                        onClick={() => setDismissed(new Set(alerts.map(a => a.id)))}
                    >
                        {t("mark_all_read")}
                    </button>
                )}
            </div>

            {visible.length === 0 && hasLiveData ? (
                <div className="p-6 text-center bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">{t("all_clear")}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {(visible.length > 0 ? visible : alerts).map((alert) => {
                        const isUnread = !dismissed.has(alert.id);
                        return (
                            <div
                                key={alert.id}
                                className={`p-3 rounded-xl border transition-all bg-card ${isUnread ? `shadow-sm ${getBorderStyle(alert.type)}` : "opacity-60 bg-muted border-border"}`}
                            >
                                <div className="flex gap-3 items-start">
                                    <div className={`shrink-0 p-2 rounded-lg border ${getIconBg(alert.type)} ${isUnread && alert.type !== "info" ? "animate-pulse" : ""}`}>
                                        {getIcon(alert.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                            <h3 className="text-sm font-black text-foreground leading-tight">{alert.title}</h3>
                                            <span className="text-[11px] font-bold text-muted-foreground shrink-0">
                                                    {alert.time === t("today") ? alert.time : t("time_ago", { time: alert.time })}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-snug mt-0.5">{alert.desc}</p>
                                    </div>
                                </div>

                                {isUnread && (
                                    <div className="flex gap-2 mt-2 justify-end">
                                        <button
                                            onClick={() => setDismissed(prev => new Set([...prev, alert.id]))}
                                            className="px-4 py-1.5 bg-muted border border-border text-foreground font-bold rounded-lg text-xs hover:bg-accent transition-all active:scale-95"
                                        >
                                            {t("mark_read")}
                                        </button>
                                        {(alert.type === "critical" || alert.type === "warning") && (
                                            <button
                                                onClick={() => setDismissed(prev => new Set([...prev, alert.id]))}
                                                className="flex items-center gap-1.5 px-4 py-1.5 bg-zinc-800 dark:bg-zinc-700 text-white font-bold rounded-lg text-xs hover:bg-zinc-700 transition-all active:scale-95"
                                            >
                                                <Smartphone className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                                                {t("call_tech")}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
