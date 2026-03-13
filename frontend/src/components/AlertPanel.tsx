"use client";

import { useState } from "react";
import { AlertOctagon, AlertTriangle, Info, CheckCircle, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppSelector } from "@/lib/store/hooks";

export default function AlertPanel() {
    const t = useTranslations("AlertPanel");
    const tz = useTranslations("Zones");
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    const { readings: sseReadings, connected, lastUpdate } = useAppSelector((state) => state.iot);
    const hasLiveData = connected && sseReadings.length > 0;

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

        sseReadings.forEach((r) => {
            const zoneName = tz(`zone${r.zone_id}`);
            if (r.is_anomaly) {
                alerts.push({
                    id: `anomaly-${r.zone_id}`,
                    type: "critical",
                    title: `${zoneName} — ${tz("alert_c2")}`,
                    desc: `Abnormal sensor values detected. Stress: ${r.stress_class ?? "unknown"}`,
                    time: timeStr,
                });
            } else if ((r.soil_moisture_pct ?? 100) < 35) {
                alerts.push({
                    id: `critical-dry-${r.zone_id}`,
                    type: "critical",
                    title: `${zoneName} — Critically Dry`,
                    desc: `Soil moisture at ${r.soil_moisture_pct?.toFixed(0)}%. Immediate irrigation needed.`,
                    time: timeStr,
                });
            } else if ((r.soil_moisture_pct ?? 100) < 45) {
                alerts.push({
                    id: `low-${r.zone_id}`,
                    type: "warning",
                    title: `${zoneName} — ${tz("alert_c1")}`,
                    desc: `Soil moisture ${r.soil_moisture_pct?.toFixed(0)}% — below optimal (55-70%).`,
                    time: timeStr,
                });
            } else if (r.irrigation_needed === 1) {
                alerts.push({
                    id: `irr-${r.zone_id}`,
                    type: "info",
                    title: `${zoneName} — Irrigation Active`,
                    desc: `Automated irrigation running. Moisture: ${r.soil_moisture_pct?.toFixed(0)}%.`,
                    time: timeStr,
                });
            }
        });
    } else {
        // Fallback static alerts when not connected
        alerts.push(
            { id: "s1", type: "critical", title: "Water Leak — Zone 5", desc: "Sudden pressure drop detected", time: "8 min" },
            { id: "s2", type: "warning", title: "Low Moisture — Zone 3", desc: "Soil moisture below threshold (45%)", time: "2 h" },
            { id: "s3", type: "info", title: "Irrigation Complete — Zone 1", desc: "Scheduled irrigation finished successfully", time: t("today") },
        );
    }

    const visible = alerts.filter(a => !dismissed.has(a.id));
    const unreadCount = visible.filter(a => a.type !== "info").length;

    const getIcon = (type: string) => {
        switch (type) {
            case "critical": return <AlertOctagon className="w-6 h-6 text-red-600" />;
            case "warning": return <AlertTriangle className="w-6 h-6 text-amber-500" />;
            case "info": return <Info className="w-6 h-6 text-sky-500" />;
            default: return <CheckCircle className="w-6 h-6 text-emerald-500" />;
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
                    <h2 className="text-2xl font-black text-zinc-800 dark:text-zinc-100 tracking-tight">{t("title")}</h2>
                    {hasLiveData && (
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            Live
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
                    <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                    <p className="font-bold text-emerald-700 dark:text-emerald-400">All zones healthy — no alerts</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {(visible.length > 0 ? visible : alerts).map((alert) => {
                        const isUnread = !dismissed.has(alert.id);
                        return (
                            <div
                                key={alert.id}
                                className={`p-4 md:p-5 rounded-2xl border transition-all bg-white ${isUnread ? `shadow-sm ${getBorderStyle(alert.type)}` : "opacity-60 bg-zinc-50 border-zinc-200"}`}
                            >
                                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                                    <div className="flex items-start gap-4 flex-1 w-full">
                                        <div className={`shrink-0 p-2.5 rounded-xl border ${getIconBg(alert.type)} ${isUnread && alert.type !== "info" ? "animate-pulse" : ""}`}>
                                            {getIcon(alert.type)}
                                        </div>
                                        <div className="flex-1 mt-1">
                                            <div className="flex justify-between items-start gap-2">
                                                <h3 className="text-lg font-black text-zinc-800 leading-tight">{alert.title}</h3>
                                                <span className="text-xs font-bold text-zinc-400 shrink-0">
                                                    {alert.time === t("today") ? alert.time : t("time_ago", { time: alert.time })}
                                                </span>
                                            </div>
                                            <p className="text-sm font-bold text-zinc-500 leading-relaxed mt-1">{alert.desc}</p>
                                        </div>
                                    </div>

                                    {isUnread && (
                                        <div className="flex gap-2 w-full lg:w-auto mt-3 lg:mt-0 pt-4 lg:pt-0 border-t lg:border-0 border-zinc-100 justify-end">
                                            <button
                                                onClick={() => setDismissed(prev => new Set([...prev, alert.id]))}
                                                className="flex-1 lg:flex-none px-4 py-2 bg-white border border-zinc-200 text-zinc-600 font-bold rounded-xl text-sm shadow-sm hover:bg-zinc-50 transition-all"
                                            >
                                                {t("mark_read")}
                                            </button>
                                            {(alert.type === "critical" || alert.type === "warning") && (
                                                <button
                                                    onClick={() => setDismissed(prev => new Set([...prev, alert.id]))}
                                                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 text-white font-bold rounded-xl text-sm shadow-sm hover:bg-zinc-700 transition-all"
                                                >
                                                    <Smartphone className="w-4 h-4 text-zinc-300 shrink-0" />
                                                    {t("call_tech")}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
