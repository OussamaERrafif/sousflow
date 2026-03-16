import { Droplet, Battery, ThermometerSun, LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import { useGetDashboardApiIotDashboardGetQuery } from "@/lib/store/generated/api";
import { useAppSelector } from "@/lib/store/hooks";

export default function StatsRow() {
    const tg = useTranslations("GlobalStatus");
    const t = useTranslations("StatsRow");

    const { readings: sseReadings, connected, lastUpdate } = useAppSelector((state) => state.iot);
    const hasLiveData = connected && sseReadings.length > 0;

    const { data: dashboardData, isLoading, error } = useGetDashboardApiIotDashboardGetQuery(
        undefined,
        { skip: hasLiveData }
    );

    if (!hasLiveData && isLoading) {
        return (
            <div className="mb-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-64 bg-muted rounded-lg"></div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-32 bg-muted rounded-2xl"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!hasLiveData && error) {
        return (
            <div className="mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                <p className="text-destructive font-medium">Failed to load dashboard data. Please login or check your connection.</p>
            </div>
        );
    }

    // Compute stats from SSE readings when live
    let totalZones: number;
    let healthScore: number;
    let activeIrrigating: number;
    let avgTemp: number;
    let reservoirLevel: number;

    if (hasLiveData) {
        totalZones = sseReadings.length;
        const scores = sseReadings.map(r => r.health_score ?? 0).filter(s => s > 0);
        healthScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) : 0;
        activeIrrigating = sseReadings.filter(r => r.irrigation_needed === 1).length;
        avgTemp = sseReadings.reduce((sum, r) => sum + (r.air_temperature_c ?? 0), 0) / sseReadings.length;
        reservoirLevel = sseReadings[0]?.reservoir_level_pct ?? 0;
    } else {
        totalZones = dashboardData?.zones ?? 0;
        healthScore = Math.round((dashboardData?.avg_health_score ?? 0) * 10);
        activeIrrigating = dashboardData?.readings_24h ?? 0;
        avgTemp = 0;
        reservoirLevel = dashboardData?.reservoir_level_pct ?? 0;
    }

    const getTrend = (current: number, type: 'temp' | 'reservoir' | 'health' | 'zones') => {
        const trends = {
            temp: { value: "+2.1%", up: true },
            reservoir: { value: "-5%", up: reservoirLevel >= 40 },
            health: { value: "+3%", up: healthScore >= 70 },
            zones: { value: "+1", up: true },
        };
        return trends[type];
    };

    const STATS = [
        {
            icon: LayoutGrid,
            value: `${totalZones}`,
            label: t("active_zones"),
            trend: getTrend(totalZones, 'zones'),
            trendLabel: "vs yesterday",
            iconBg: "bg-primary/10",
            iconColor: "text-primary",
        },
        {
            icon: Droplet,
            value: `${reservoirLevel.toFixed(0)}%`,
            label: t("water_saved"),
            trend: getTrend(reservoirLevel, 'reservoir'),
            trendLabel: "vs yesterday",
            iconBg: "bg-blue-500/10",
            iconColor: "text-blue-500",
        },
        {
            icon: Battery,
            value: `${healthScore}%`,
            label: t("solar_energy"),
            trend: getTrend(healthScore, 'health'),
            trendLabel: "vs yesterday",
            iconBg: "bg-emerald-500/10",
            iconColor: "text-emerald-500",
        },
        {
            icon: ThermometerSun,
            value: `${avgTemp.toFixed(1)}°C`,
            label: t("soil_temp"),
            trend: getTrend(avgTemp, 'temp'),
            trendLabel: "vs yesterday",
            iconBg: "bg-amber-500/10",
            iconColor: "text-amber-500",
        },
    ];

    const lastUpdateTime = lastUpdate ? new Date(lastUpdate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

    return (
        <div className="mb-8">
            {/* System Status Banner */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-emerald-500 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`}></span>
                        {connected ? tg("system_normal") : "Connecting..."}
                    </span>
                    {lastUpdateTime && (
                        <span className="text-xs text-muted-foreground hidden sm:inline-block">
                            Last update: {lastUpdateTime}
                        </span>
                    )}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {STATS.map((stat, i) => (
                    <div 
                        key={i} 
                        className="group p-5 rounded-2xl border border-border bg-card shadow-sm hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.iconBg} border border-border`}>
                                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                            </div>
                            {stat.trend && (
                                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold ${
                                    stat.trend.up 
                                        ? "bg-emerald-500/10 text-emerald-500" 
                                        : "bg-red-500/10 text-red-500"
                                }`}>
                                    <span>{stat.trend.value}</span>
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-1 tracking-tight" dir="ltr">
                                {stat.value}
                            </h3>
                            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                            {stat.trend && (
                                <p className="text-[10px] text-muted-foreground/60 mt-1">{stat.trendLabel}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
