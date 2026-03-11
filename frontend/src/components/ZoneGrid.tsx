"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, AlertOctagon, PauseCircle, ChevronDown, ChevronUp, Play, Settings2, CalendarRange } from "lucide-react";
import { useTranslations } from "next-intl";

function MoistureBar({ level, status }: { level: number, status: string }) {
    const t = useTranslations("ZoneGrid");
    let color = "bg-emerald-500";
    if (status === "off") color = "bg-zinc-400";
    else if (level < 40) color = "bg-red-500";
    else if (level < 60) color = "bg-amber-500";

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-zinc-500">{t("moisture")}</span>
                <span className="text-xs font-black text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200" dir="ltr">{level}%</span>
            </div>
            <div className="h-4 w-full bg-zinc-100 rounded-full overflow-hidden shadow-inner ring-1 ring-zinc-200 relative">
                <div className={`h-full ${color} transition-all duration-1000 ease-out`} style={{ width: `${level}%` }}></div>
                {/* Optimal Range Indicator */}
                <div className="absolute top-0 bottom-0 left-[55%] right-[30%] border-x-2 border-white/40 bg-white/10" title={t("optimal")}></div>
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-zinc-400 font-bold px-1">
                <span>0%</span>
                <span>{t("optimal")}: 55-70%</span>
                <span>100%</span>
            </div>
        </div>
    );
}

export default function ZoneGrid() {
    const [selected, setSelected] = useState<number | null>(null);
    const t = useTranslations("ZoneGrid");
    const tz = useTranslations("Zones");

    const ZONES = [
        { id: 3, name: tz("zone3"), status: "warning", pressure: "4.5", flow: "4.2", moisture: 45, active: true, alert: tz("alert_c1"), minutesActive: 12 },
        { id: 5, name: tz("zone5"), status: "critical", pressure: "1.2", flow: "19", moisture: 80, active: true, alert: tz("alert_c2"), minutesActive: 5 },
        { id: 1, name: tz("zone1"), status: "good", pressure: "3.2", flow: "12", moisture: 72, active: true, alert: null, minutesActive: 20 },
        { id: 2, name: tz("zone2"), status: "good", pressure: "3.1", flow: "11.5", moisture: 68, active: true, alert: null, minutesActive: 15 },
        { id: 6, name: tz("zone6"), status: "good", pressure: "3.0", flow: "12", moisture: 65, active: false, alert: null, minutesActive: 0 },
        { id: 7, name: tz("zone7"), status: "good", pressure: "2.8", flow: "14", moisture: 75, active: false, alert: null, minutesActive: 0 },
        { id: 8, name: tz("zone8"), status: "good", pressure: "2.9", flow: "13.5", moisture: 70, active: false, alert: null, minutesActive: 0 },
        { id: 4, name: tz("zone4"), status: "off", pressure: "0", flow: "0", moisture: 60, active: false, alert: null, minutesActive: 0 },
    ];

    const getStatusConfig = (status: string) => {
        return {
            good: { dot: "bg-emerald-500", border: "border-emerald-200", bg: "bg-white", icon: CheckCircle2, text: "text-emerald-700", bgSoft: "bg-emerald-50" },
            warning: { dot: "bg-amber-500 animate-pulse ring-4 ring-amber-500/20", border: "border-amber-400", bg: "bg-white", icon: AlertTriangle, text: "text-amber-700", bgSoft: "bg-amber-50" },
            critical: { dot: "bg-red-500 animate-pulse ring-4 ring-red-500/20", border: "border-red-500", bg: "bg-white", icon: AlertOctagon, text: "text-red-700", bgSoft: "bg-red-50" },
            off: { dot: "bg-zinc-400", border: "border-zinc-200", bg: "bg-zinc-50", icon: PauseCircle, text: "text-zinc-500", bgSoft: "bg-zinc-100" },
        }[status] || { dot: "bg-zinc-400", border: "border-zinc-200", bg: "bg-white", icon: CheckCircle2, text: "text-zinc-500", bgSoft: "bg-zinc-50" };
    };

    return (
        <div className="mb-10">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-2xl font-black text-zinc-800 tracking-tight">{t("title")}</h2>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
                {ZONES.map((zone) => {
                    const isExpanded = selected === zone.id;
                    const config = getStatusConfig(zone.status);
                    const Icon = config.icon;

                    return (
                        <div
                            key={zone.id}
                            className={`rounded-2xl border ${isExpanded ? 'border-zinc-300 shadow-xl z-20 scale-[1.02]' : 'border-zinc-200 shadow-sm hover:shadow-md'} transition-all bg-white flex flex-col`}
                        >
                            {/* Card Header */}
                            <div className="p-5 border-b border-zinc-100">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-3 items-center">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${config.bgSoft} ${config.border}`}>
                                            <Icon className={`w-5 h-5 ${config.text}`} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-zinc-800 leading-none mb-1">{zone.name}</h3>
                                            <span className="text-xs text-zinc-500 font-bold">{t("last_update", { min: Math.floor(Math.random() * 5) + 1 })}</span>
                                        </div>
                                    </div>
                                    <div className="relative flex items-center justify-center shrink-0">
                                        <div className={`w-3 h-3 rounded-full ${config.dot}`}></div>
                                    </div>
                                </div>

                                {zone.alert && (
                                    <div className={`mb-4 p-3 rounded-xl flex items-start border shadow-sm ${zone.status === 'critical' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                                        <AlertTriangle className="w-5 h-5 mt-0.5 rtl:ml-2 ltr:mr-2 shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-sm font-bold leading-tight">{zone.alert}</p>
                                        </div>
                                        <button className="text-xs underline font-bold px-2 shrink-0">{t("details")}</button>
                                    </div>
                                )}

                                <div className="mb-2">
                                    <MoistureBar level={zone.moisture} status={zone.status} />
                                </div>

                                {zone.active && (
                                    <div className="flex items-center gap-2 mt-3 bg-sky-50 text-sky-700 px-3 py-1.5 rounded-lg border border-sky-100">
                                        <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></div>
                                        <span className="text-xs font-bold leading-none">{t("irrigation_active")}</span>
                                        <span className="text-[10px] bg-white px-1.5 py-0.5 rounded-md border border-sky-200 rtl:mr-auto ltr:ml-auto font-black">{t("irrigation_duration", { min: zone.minutesActive })}</span>
                                    </div>
                                )}
                            </div>

                            {/* Card Actions Container */}
                            <div className="mt-auto bg-zinc-50 p-3 rounded-b-2xl border-t border-zinc-100">
                                <div className="grid grid-cols-2 gap-2">
                                    {zone.active ? (
                                        <button className="flex items-center justify-center gap-1.5 bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 py-2 rounded-xl font-bold text-sm transition-colors active:scale-95">
                                            <PauseCircle className="w-4 h-4" />
                                            <span>{t("stop")}</span>
                                        </button>
                                    ) : (
                                        <button className="flex items-center justify-center gap-1.5 bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 py-2 rounded-xl font-bold text-sm transition-colors active:scale-95">
                                            <Play className="w-4 h-4" />
                                            <span>{t("start")}</span>
                                        </button>
                                    )}
                                    <button
                                        className="flex items-center justify-center gap-1.5 bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100 py-2 rounded-xl font-bold text-sm transition-colors active:scale-95"
                                        onClick={() => setSelected(isExpanded ? null : zone.id)}
                                    >
                                        <Settings2 className="w-4 h-4" />
                                        <span>{isExpanded ? t("hide_details") : t("details")}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Expandable Details */}
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out bg-white rounded-b-2xl shadow-inner ${isExpanded ? 'max-h-60 border-t border-zinc-200' : 'max-h-0'}`}>
                                <div className="p-4 bg-zinc-50/80">
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div className="bg-white rounded-xl p-3 border border-zinc-200 shadow-sm flex flex-col items-center justify-center text-center">
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase">{t("pressure")}</p>
                                            <p className="text-xl font-black text-zinc-800 mt-1 block" dir="ltr">{zone.pressure} <span className="text-[10px] font-bold text-zinc-400 block -mt-1">bar</span></p>
                                        </div>
                                        <div className="bg-white rounded-xl p-3 border border-zinc-200 shadow-sm flex flex-col items-center justify-center text-center">
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase">{t("flow")}</p>
                                            <p className="text-xl font-black text-zinc-800 mt-1 block" dir="ltr">{zone.flow} <span className="text-[10px] font-bold text-zinc-400 block -mt-1">L/min</span></p>
                                        </div>
                                    </div>
                                    <button className="w-full flex justify-center items-center gap-2 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 transition-colors text-zinc-700 font-bold text-sm">
                                        <CalendarRange className="w-4 h-4" />
                                        <span>{t("schedule")}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
