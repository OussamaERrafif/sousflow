"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useGetReadingsApiIotReadingsGetQuery, useGetDashboardApiIotDashboardGetQuery } from "@/lib/store/generated/api";
import { useAppSelector } from "@/lib/store/hooks";
import { FileText, Download, TrendingUp, TrendingDown, Activity, Droplet, ThermometerSun, Zap } from "lucide-react";

export default function ReportsPage() {
    const t = useTranslations("Sidebar");
    const [dateRange, setDateRange] = useState("24h");

    const { readings: sseReadings, connected } = useAppSelector((state) => state.iot);
    const hasLiveData = connected && sseReadings.length > 0;

    const startDate = dateRange === "24h"
        ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        : dateRange === "7d"
            ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            : dateRange === "30d"
                ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
                : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: readingsData, isLoading: readingsLoading } = useGetReadingsApiIotReadingsGetQuery({
        limit: 500,
        startDate,
    });

    const { data: dashboardData } = useGetDashboardApiIotDashboardGetQuery();

    // Build hourly chart data from readings
    type ReadingItem = {
        timestamp?: string;
        soil_moisture_pct?: number;
        zone_flow_lpm?: number;
        zone_id?: number;
        zone_pressure_mpa?: number;
        air_temperature_c?: number;
        air_humidity_pct?: number;
        irrigation_needed?: number;
        is_anomaly?: boolean;
        health_score?: number;
    };
    const readings: ReadingItem[] = Array.isArray(readingsData)
        ? readingsData
        : (readingsData as { data?: ReadingItem[] } | undefined)?.data ?? [];

    // Group by hour, compute avg moisture per hour
    const hourlyMap: Record<number, { moisture: number[]; flow: number[] }> = {};
    readings.forEach((r) => {
        if (!r.timestamp) return;
        const h = new Date(r.timestamp).getHours();
        if (!hourlyMap[h]) hourlyMap[h] = { moisture: [], flow: [] };
        if (r.soil_moisture_pct != null) hourlyMap[h].moisture.push(r.soil_moisture_pct);
        if (r.zone_flow_lpm != null) hourlyMap[h].flow.push(r.zone_flow_lpm);
    });

    const chartHours = dateRange === "24h" ? 24 : 12;
    const now = new Date();
    const chartData = Array.from({ length: chartHours }, (_, i) => {
        const h = (now.getHours() - chartHours + 1 + i + 24) % 24;
        const bucket = hourlyMap[h];
        const avgMoisture = bucket?.moisture.length
            ? bucket.moisture.reduce((a, b) => a + b, 0) / bucket.moisture.length
            : null;
        const avgFlow = bucket?.flow.length
            ? bucket.flow.reduce((a, b) => a + b, 0) / bucket.flow.length
            : null;
        return { hour: h, moisture: avgMoisture, flow: avgFlow };
    });

    const maxMoisture = Math.max(...chartData.map(d => d.moisture ?? 0), 1);

    // Zone performance from SSE or readings
    const zonePerf: Record<number, number[]> = {};
    if (hasLiveData) {
        sseReadings.forEach(r => {
            const id = r.zone_id ?? 0;
            if (!zonePerf[id]) zonePerf[id] = [];
            zonePerf[id].push(Math.round((r.health_score ?? 0) * 10));
        });
    } else {
        readings.forEach((r) => {
            const id = r.zone_id ?? 0;
            if (!zonePerf[id]) zonePerf[id] = [];
        });
    }

    const zoneEfficiency = Object.entries(zonePerf)
        .map(([id, scores]) => ({
            zone: `Zone ${id}`,
            efficiency: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        }))
        .sort((a, b) => Number(a.zone.split(" ")[1]) - Number(b.zone.split(" ")[1]))
        .slice(0, 8);

    // Stats
    const totalReadings = (readingsData as { total?: number } | undefined)?.total
        ?? readings.length
        ?? dashboardData?.total_readings
        ?? 0;
    const avgTemp = hasLiveData && sseReadings.length > 0
        ? sseReadings.reduce((s, r) => s + (r.air_temperature_c ?? 0), 0) / sseReadings.length
        : readings.filter(r => r.soil_moisture_pct != null).length > 0
            ? null
            : null;
    const avgHealthScore = dashboardData?.avg_health_score ?? (
        hasLiveData && sseReadings.length > 0
            ? sseReadings.reduce((s, r) => s + (r.health_score ?? 0), 0) / sseReadings.length
            : 0
    );
    const totalFlow = hasLiveData
        ? sseReadings.reduce((s, r) => s + (r.zone_flow_lpm ?? 0), 0)
        : 0;

    const stats = [
        {
            icon: Droplet,
            label: "Total Readings",
            value: totalReadings > 0 ? String(totalReadings) : "--",
            change: `${dateRange} range`,
            trend: "up" as const,
            color: "text-sky-600 bg-sky-50",
        },
        {
            icon: Zap,
            label: "Zones Active",
            value: dashboardData?.zones != null ? String(dashboardData.zones) : (hasLiveData ? String(sseReadings.length) : "--"),
            change: hasLiveData ? "live" : "from API",
            trend: "up" as const,
            color: "text-emerald-600 bg-emerald-50",
        },
        {
            icon: ThermometerSun,
            label: "Avg Temperature",
            value: hasLiveData && sseReadings.length > 0
                ? `${(sseReadings.reduce((s, r) => s + (r.air_temperature_c ?? 0), 0) / sseReadings.length).toFixed(1)}°C`
                : avgTemp != null ? `${(avgTemp as number).toFixed(1)}°C` : "--",
            change: "air sensor",
            trend: "down" as const,
            color: "text-orange-600 bg-orange-50",
        },
        {
            icon: Activity,
            label: "Avg Health Score",
            value: avgHealthScore > 0 ? `${(avgHealthScore * 10).toFixed(0)}%` : "--",
            change: hasLiveData ? "live" : "last sync",
            trend: avgHealthScore >= 0.7 ? "up" as const : "down" as const,
            color: "text-purple-600 bg-purple-50",
        },
    ];

    const flowLabel = hasLiveData ? `Total: ${totalFlow.toFixed(1)} L/min` : null;

    return (
        <div className="w-full">
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-zinc-800 tracking-tight">{t("nav_reports")}</h1>
                    <p className="text-zinc-500 font-bold mt-1">Historical data and analytics</p>
                </div>
                    <button
                        onClick={() => {
                            const headers = ["Zone ID", "Timestamp", "Soil Moisture (%)", "Zone Flow (L/min)", "Zone Pressure (MPa)", "Air Temp (°C)", "Air Humidity (%)", "Irrigation Needed", "Is Anomaly", "Health Score"];
                            const rows = readings.map(r => [
                                r.zone_id ?? "",
                                r.timestamp ? new Date(r.timestamp).toISOString() : "",
                                r.soil_moisture_pct?.toFixed(1) ?? "",
                                r.zone_flow_lpm?.toFixed(1) ?? "",
                                r.zone_pressure_mpa?.toFixed(3) ?? "",
                                r.air_temperature_c?.toFixed(1) ?? "",
                                r.air_humidity_pct?.toFixed(0) ?? "",
                                r.irrigation_needed === 1 ? "Yes" : "No",
                                r.is_anomaly ? "Yes" : "No",
                                r.health_score ? (r.health_score * 100).toFixed(0) + "%" : ""
                            ]);
                            const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
                            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = `soussflow-export-${new Date().toISOString().split("T")[0]}.csv`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                        }}
                        className="flex items-center gap-2 bg-[#3D1F0F] text-white hover:bg-[#4A2C1A] px-5 py-2.5 rounded-xl font-bold transition-colors"
                    >
                        <Download className="w-5 h-5" />
                        Export Data
                    </button>
            </div>

            {/* Date range selector */}
            <div className="mb-6 flex flex-wrap gap-3">
                <div className="flex bg-white rounded-xl border border-zinc-200 p-1">
                    {["24h", "7d", "30d", "90d"].map((range) => (
                        <button
                            key={range}
                            onClick={() => setDateRange(range)}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${dateRange === range ? "bg-[#3D1F0F] text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
                {flowLabel && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-sky-700 bg-sky-50 px-3 py-1.5 rounded-full border border-sky-200">
                        <span className="w-2 h-2 bg-sky-500 rounded-full animate-pulse"></span>
                        {flowLabel}
                    </span>
                )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {stats.map((stat, idx) => (
                    <div key={idx} className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                            <div className={`flex items-center gap-1 text-xs font-bold ${stat.trend === "up" ? "text-emerald-600" : "text-red-500"}`}>
                                {stat.trend === "up" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                {stat.change}
                            </div>
                        </div>
                        <p className="text-2xl font-black text-zinc-800" dir="ltr">{stat.value}</p>
                        <p className="text-xs text-zinc-500 font-bold mt-1">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Moisture trend chart */}
                <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                    <h3 className="text-lg font-black text-zinc-800 mb-4">Avg Soil Moisture — Last {chartHours}h</h3>
                    {readingsLoading ? (
                        <div className="h-48 bg-zinc-100 rounded-xl animate-pulse" />
                    ) : (
                        <div className="h-48 flex items-end justify-between gap-1">
                            {chartData.map((d, idx) => {
                                const pct = d.moisture != null ? (d.moisture / maxMoisture) * 100 : 0;
                                const hasData = d.moisture != null;
                                return (
                                    <div key={idx} className="relative flex-1 group h-full flex items-end cursor-pointer">
                                        <div
                                            className={`w-full rounded-t-sm transition-all duration-500 ${!hasData ? "bg-zinc-100" : d.moisture! < 50 ? "bg-amber-400/70 group-hover:bg-amber-500" : "bg-emerald-400/70 group-hover:bg-emerald-500"}`}
                                            style={{ height: hasData ? `${pct}%` : "4px" }}
                                        >
                                            {hasData && (
                                                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap z-10 transition-opacity pointer-events-none">
                                                    {d.moisture!.toFixed(0)}%
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="flex justify-between mt-3 text-[10px] text-zinc-400 font-bold border-t border-zinc-100 pt-2" dir="ltr">
                        {chartData.filter((_, i) => i % Math.floor(chartHours / 4) === 0).map((d, i) => (
                            <span key={i}>{String(d.hour).padStart(2, "0")}:00</span>
                        ))}
                    </div>
                </div>

                {/* Zone Performance */}
                <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                    <h3 className="text-lg font-black text-zinc-800 mb-4">Zone Health Score</h3>
                    {zoneEfficiency.length === 0 ? (
                        <div className="h-48 flex items-center justify-center">
                            <p className="text-zinc-400 font-bold text-sm">No zone data available</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {zoneEfficiency.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-zinc-600 w-16 shrink-0">{item.zone}</span>
                                    <div className="flex-1 h-4 bg-zinc-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${item.efficiency >= 80 ? "bg-emerald-500" : item.efficiency >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                                            style={{ width: `${item.efficiency}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-black text-zinc-800 w-12 text-right shrink-0" dir="ltr">{item.efficiency}%</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Readings summary table */}
            {readings.length > 0 && (
                <div>
                    <h3 className="text-lg font-black text-zinc-800 mb-4">Recent Readings ({readings.length})</h3>
                    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-zinc-50 border-b border-zinc-200">
                                <tr>
                                    <th className="text-left px-5 py-3 text-xs font-bold text-zinc-500 uppercase">Zone</th>
                                    <th className="text-left px-5 py-3 text-xs font-bold text-zinc-500 uppercase">Time</th>
                                    <th className="text-left px-5 py-3 text-xs font-bold text-zinc-500 uppercase">Moisture</th>
                                    <th className="text-left px-5 py-3 text-xs font-bold text-zinc-500 uppercase">Flow</th>
                                    <th className="text-left px-5 py-3 text-xs font-bold text-zinc-500 uppercase">Health</th>
                                </tr>
                            </thead>
                            <tbody>
                                {readings.slice(0, 20).map((r, i) => (
                                    <tr key={i} className="border-b border-zinc-100 hover:bg-zinc-50">
                                        <td className="px-5 py-3 font-bold text-zinc-800">Zone {r.zone_id ?? "--"}</td>
                                        <td className="px-5 py-3 text-sm text-zinc-500 font-bold" dir="ltr">
                                            {r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : "--"}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`text-sm font-black ${(r.soil_moisture_pct ?? 100) < 40 ? "text-red-600" : (r.soil_moisture_pct ?? 100) < 60 ? "text-amber-600" : "text-emerald-600"}`} dir="ltr">
                                                {r.soil_moisture_pct?.toFixed(1) ?? "--"}%
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-sm font-bold text-zinc-600" dir="ltr">
                                            {r.zone_flow_lpm?.toFixed(1) ?? "--"} L/min
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-zinc-400" />
                                                <span className="text-sm font-bold text-zinc-600">—</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
