"use client";

import { useState } from "react";
import { AlertOctagon, AlertTriangle, Info, CheckCircle, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";


export default function AlertPanel() {
    const [alertsState, setAlertsState] = useState([1, 2, 3]);
    const t = useTranslations("AlertPanel");
    const ta = useTranslations("Alerts");

    const ALERTS = [
        {
            id: 1,
            type: "critical",
            title: ta("alert1_title"),
            desc: ta("alert1_desc"),
            time: "8 min",
            read: !alertsState.includes(1),
        },
        {
            id: 2,
            type: "warning",
            title: ta("alert2_title"),
            desc: ta("alert2_desc"),
            time: "2 h",
            read: !alertsState.includes(2),
        },
        {
            id: 3,
            type: "info",
            title: ta("alert3_title"),
            desc: ta("alert3_desc"),
            time: t("today"),
            read: true,
        }
    ];

    const markRead = (id: number) => {
        setAlertsState(prev => prev.filter(alertId => alertId !== id));
    };

    const getIcon = (type: string) => {
        switch (type) {
            case "critical": return <AlertOctagon className="w-6 h-6 text-red-600" />;
            case "warning": return <AlertTriangle className="w-6 h-6 text-amber-500" />;
            case "success": return <CheckCircle className="w-6 h-6 text-emerald-500" />;
            default: return <Info className="w-6 h-6 text-sky-500" />;
        }
    };

    const getStyle = (type: string, read: boolean) => {
        const base = read ? "opacity-60 bg-zinc-50 border-zinc-200" : "bg-white shadow-sm";

        if (read) return base;

        switch (type) {
            case "critical": return `${base} border-l-4 border-red-500 rtl:border-r-4 rtl:border-l-0`;
            case "warning": return `${base} border-l-4 border-amber-400 rtl:border-r-4 rtl:border-l-0`;
            case "success": return `${base} border-l-4 border-emerald-400 rtl:border-r-4 rtl:border-l-0`;
            default: return `${base} border-l-4 border-sky-400 rtl:border-r-4 rtl:border-l-0`;
        }
    };

    const getIconBg = (type: string) => {
        switch (type) {
            case "critical": return "bg-red-50 border-red-100";
            case "warning": return "bg-amber-50 border-amber-100";
            case "success": return "bg-emerald-50 border-emerald-100";
            default: return "bg-sky-50 border-sky-100";
        }
    };

    return (
        <div className="mb-24 md:mb-8">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-2xl font-black text-zinc-800 tracking-tight">{t("title")}</h2>
                </div>
                {alertsState.length > 0 && (
                    <button
                        className="text-sm font-bold text-zinc-500 hover:text-zinc-800 transition-colors"
                        onClick={() => setAlertsState([])}
                    >
                        {t("mark_all_read")}
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {ALERTS.map((alert) => (
                    <div key={alert.id} className={`p-4 md:p-5 rounded-2xl border transition-all ${getStyle(alert.type, alert.read)}`}>
                        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">

                            <div className="flex items-start gap-4 flex-1 w-full">
                                <div className={`shrink-0 p-2.5 rounded-xl border ${getIconBg(alert.type)} ${!alert.read && alert.type !== 'info' ? "animate-pulse" : ""}`}>
                                    {getIcon(alert.type)}
                                </div>
                                <div className="flex-1 mt-1">
                                    <div className="flex justify-between items-start gap-2">
                                        <h3 className="text-lg font-black text-zinc-800 leading-tight rtl:pr-1 ltr:pl-1">{alert.title}</h3>
                                        <div className="text-left shrink-0">
                                            <span className="text-xs font-bold text-zinc-400">
                                                {alert.time === t("today") ? alert.time : t("time_ago", { time: alert.time })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-1.5 rtl:pr-1 ltr:pl-1">
                                        <p className="text-sm font-bold text-zinc-500 leading-relaxed">{alert.desc}</p>
                                    </div>
                                </div>
                            </div>

                            {!alert.read && (
                                <div className="flex gap-2 w-full lg:w-auto mt-3 lg:mt-0 pt-4 lg:pt-0 border-t lg:border-0 border-zinc-100 justify-end">
                                    <button
                                        onClick={() => markRead(alert.id)}
                                        className="flex-1 lg:flex-none px-4 py-2 bg-white border border-zinc-200 text-zinc-600 font-bold rounded-xl text-sm shadow-sm hover:bg-zinc-50 transition-all text-center"
                                    >
                                        <span>{t("mark_read")}</span>
                                    </button>

                                    {(alert.type === "critical" || alert.type === "warning") && (
                                        <button
                                            onClick={() => markRead(alert.id)}
                                            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 text-white font-bold rounded-xl text-sm shadow-sm hover:bg-zinc-700 transition-all text-center"
                                        >
                                            <Smartphone className="w-4 h-4 text-zinc-300 shrink-0" />
                                            <span>{t("call_tech")}</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
