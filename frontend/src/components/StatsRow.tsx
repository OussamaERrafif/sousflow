import { Droplet, Battery, ThermometerSun, LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import { useGetDashboardApiIotDashboardGetQuery } from "@/lib/store/generated/api";
import { useAppSelector } from "@/lib/store/hooks";

export default function StatsRow() {
    const tg = useTranslations("GlobalStatus");
    const t = useTranslations("StatsRow");

    const { readings: sseReadings, connected } = useAppSelector((state) => state.iot);
    const hasLiveData = connected && sseReadings.length > 0;

    const { data: dashboardData, isLoading, error } = useGetDashboardApiIotDashboardGetQuery(
        undefined,
        { skip: hasLiveData }
    );

    if (!hasLiveData && isLoading) {
        return (
            <div className="mb-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-24 bg-zinc-200 rounded-2xl"></div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-32 bg-zinc-200 rounded-2xl"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!hasLiveData && error) {
        return (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-700 font-bold">Failed to load dashboard data. Please login or check your connection.</p>
            </div>
        );
    }

    // Compute stats from SSE readings when live
    let totalZones: number;
    let healthScore: number;
    let activeIrrigating: number;

    if (hasLiveData) {
        totalZones = sseReadings.length;
        const scores = sseReadings.map(r => r.health_score ?? 0).filter(s => s > 0);
        healthScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) : 0;
        activeIrrigating = sseReadings.filter(r => r.irrigation_needed === 1).length;
    } else {
        totalZones = dashboardData?.zones ?? 0;
        healthScore = Math.round((dashboardData?.avg_health_score ?? 0) * 10);
        activeIrrigating = dashboardData?.readings_24h ?? 0;
    }

    const STATS = [
        {
            icon: LayoutGrid,
            value: `${totalZones}`,
            label: t("active_zones"),
            context: `${activeIrrigating} irrigating`,
            contextUp: true,
            iconClass: "text-[#5A4A3A]",
        },
        {
            icon: Droplet,
            value: hasLiveData
                ? `${sseReadings[0]?.reservoir_level_pct?.toFixed(0) ?? "--"}%`
                : `${dashboardData?.reservoir_level_pct ?? "--"}%`,
            label: t("water_saved"),
            context: hasLiveData ? "Reservoir Level" : "from API",
            contextUp: (hasLiveData ? (sseReadings[0]?.reservoir_level_pct ?? 0) : (dashboardData?.reservoir_level_pct ?? 0)) >= 40,
            iconClass: "text-sky-600",
        },
        {
            icon: Battery,
            value: `${healthScore}%`,
            label: t("solar_energy"),
            context: "Health Score",
            contextUp: healthScore >= 70,
            iconClass: "text-emerald-600",
        },
        {
            icon: ThermometerSun,
            value: hasLiveData
                ? `${sseReadings.reduce((sum, r) => sum + (r.air_temperature_c ?? 0), 0) / sseReadings.length}°C`
                : "--",
            label: t("soil_temp"),
            context: hasLiveData ? "Live" : "No data",
            contextUp: true,
            iconClass: "text-orange-600",
        },
    ];

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-emerald-500 text-sm font-bold bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-900 px-3 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5 shadow-sm">
                        <div className={`w-2 h-2 rounded-full bg-emerald-500 ${connected ? "animate-pulse" : ""}`}></div>
                        {tg("system_normal")}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400 text-xs font-bold hidden sm:inline-block">
                        {tg("last_updated", { time: now })}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                {STATS.map((stat, i) => (
                    <div key={i} className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm hover:shadow-md transition-shadow relative bg-gradient-to-br from-white dark:from-zinc-800 to-zinc-50/50 dark:to-zinc-700/50">
                        <div className="flex items-start justify-between mb-3 relative z-10">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-zinc-100/80 dark:bg-zinc-700/80 border border-zinc-200/60 dark:border-zinc-600/60 ${stat.iconClass}`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                            <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${stat.contextUp ? "bg-emerald-50 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400" : "bg-orange-50 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400"}`}>
                                <span dir="ltr">{stat.context}</span>
                            </div>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-2xl md:text-3xl font-black text-zinc-800 dark:text-zinc-100 mb-0.5 tracking-tight" dir="ltr">{stat.value}</h3>
                            <p className="font-bold text-sm text-zinc-500 dark:text-zinc-400">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
