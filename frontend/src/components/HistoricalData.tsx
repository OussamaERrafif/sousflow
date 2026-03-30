"use client";

import { BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useGetReadingsApiIotReadingsGetQuery } from "@/lib/store/generated/api";
import { useAppSelector } from "@/lib/store/hooks";

type ReadingItem = { timestamp?: string; soil_moisture_pct?: number; zone_id?: number };

export default function HistoricalData() {
    const td = useTranslations("DataViz");

    const { connected } = useAppSelector((state) => state.iot);

    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: readingsData, isLoading } = useGetReadingsApiIotReadingsGetQuery({
        limit: 500,
        startDate,
    });

    const readings: ReadingItem[] = Array.isArray(readingsData)
        ? readingsData
        : (readingsData as { data?: ReadingItem[] } | undefined)?.data ?? [];

    // Compute hourly avg moisture across all zones
    const hourlyMoisture: Record<number, number[]> = {};
    readings.forEach((r) => {
        if (!r.timestamp || r.soil_moisture_pct == null) return;
        const h = new Date(r.timestamp).getHours();
        if (!hourlyMoisture[h]) hourlyMoisture[h] = [];
        hourlyMoisture[h].push(r.soil_moisture_pct);
    });

    const now = new Date();
    const chartData = Array.from({ length: 24 }, (_, i) => {
        const h = (now.getHours() - 23 + i + 24) % 24;
        const bucket = hourlyMoisture[h];
        const avg = bucket?.length
            ? Math.round(bucket.reduce((a, b) => a + b, 0) / bucket.length)
            : null;
        return { hour: h, value: avg };
    });

    const maxVal = Math.max(...chartData.map(d => d.value ?? 0), 1);
    const hasData = chartData.some(d => d.value != null);

    return (
        <div className="mb-10">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-zinc-800 dark:text-zinc-100 tracking-tight">{td("moisture_history")}</h2>
                </div>
                {connected && (
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        Live data
                    </span>
                )}
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-[2rem] border-2 border-zinc-200 dark:border-zinc-700 shadow-sm p-6 md:p-8 overflow-hidden">
                <div className="flex items-center gap-3 mb-8">
                    <BarChart3 className="w-6 h-6 text-zinc-400" strokeWidth={2.5} />
                    <span className="text-base font-bold text-zinc-600 dark:text-zinc-400">Average soil moisture (%) — last 24h</span>
                </div>

                {isLoading ? (
                    <div className="h-48 bg-zinc-100 rounded-xl animate-pulse" />
                ) : (
                    <div className="h-48 flex items-end justify-between gap-1.5 sm:gap-2 px-1">
                        {chartData.map((d, i) => {
                            const pct = d.value != null ? (d.value / maxVal) * 100 : 0;
                            const hasBar = d.value != null;
                            return (
                                <div key={i} className="relative flex-1 group h-full flex items-end cursor-pointer">
                                    <div
                                        className={`w-full rounded-t-sm transition-all duration-300 ${!hasBar ? "bg-zinc-100" : d.value! < 50 ? "bg-amber-400/60 group-hover:bg-amber-500" : "bg-emerald-400/60 group-hover:bg-emerald-500"}`}
                                        style={{ height: hasBar ? `${pct}%` : "4px" }}
                                    >
                                        {hasBar && (
                                            <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-xs md:text-sm font-bold px-3 py-1.5 rounded-lg whitespace-nowrap z-10 transition-opacity pointer-events-none shadow-md">
                                                {d.value}%
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!isLoading && !hasData && (
                    <div className="h-48 flex items-center justify-center -mt-48 relative z-10">
                        <p className="text-zinc-400 dark:text-zinc-500 font-bold text-base bg-white/80 dark:bg-zinc-800/80 px-4 py-2 rounded-xl backdrop-blur-sm">No historical data yet. The chart will populate as readings come in.</p>
                    </div>
                )}

                <div className="flex justify-between mt-6 text-xs md:text-sm font-bold text-zinc-400 dark:text-zinc-500 border-t-2 border-zinc-100 dark:border-zinc-700 pt-4 px-2 tracking-wider" dir="ltr">
                    {["00:00", "06:00", "12:00", "18:00", "23:59"].map((label) => (
                        <span key={label}>{label}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}
