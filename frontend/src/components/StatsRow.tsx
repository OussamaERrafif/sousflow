import { Droplet, Heart, ThermometerSun, LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import { useGetDashboardApiIotDashboardGetQuery } from "@/lib/store/generated/api";
import { useAppSelector } from "@/lib/store/hooks";
import { useDebugLog } from "@/lib/debug";

export default function StatsRow() {
    const tg = useTranslations("GlobalStatus");
    const t = useTranslations("StatsRow");

    const { zones: sseZones, environment, infrastructure, connected, lastUpdate } = useAppSelector((state) => state.iot);
    const hasLiveData = connected && sseZones && sseZones.length > 0;

    useDebugLog("StatsRow - sseZones", sseZones);
    useDebugLog("StatsRow - connected", connected);

    const { data: dashboardData, isLoading, error } = useGetDashboardApiIotDashboardGetQuery(
        undefined,
        { skip: hasLiveData }
    );

    useDebugLog("StatsRow - dashboardData", dashboardData);

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
                <p className="text-destructive font-medium">{t("load_error")}</p>
            </div>
        );
    }

    // Compute stats from SSE zones when live
    let totalZones: number;
    let healthScore: number;
    let avgTemp: number;
    let reservoirLevel: number;

    if (hasLiveData) {
        totalZones = sseZones.length;
        const scores = sseZones.map(z => z.health_score ?? 0).filter(s => s > 0);
        // health_score is 0-10; multiply by 10 to get a 0-100 % representation
        healthScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) : 0;
        avgTemp = environment?.air_temperature_c ?? 0;
        reservoirLevel = infrastructure?.reservoir_level_pct ?? 0;
    } else {
        totalZones = dashboardData?.zones ?? 0;
        healthScore = Math.round((dashboardData?.avg_health_score ?? 0) * 10);
        avgTemp = 0;
        reservoirLevel = dashboardData?.reservoir_level_pct ?? 0;
    }

    const reservoirStatus = reservoirLevel >= 60 ? "good" : reservoirLevel >= 30 ? "warning" : "critical";
    const healthStatus = healthScore >= 70 ? "good" : healthScore >= 40 ? "warning" : "critical";

    const STATS = [
        {
            icon: LayoutGrid,
            value: `${totalZones}`,
            label: t("active_zones"),
            status: "good" as const,
            iconBg: "bg-primary/10",
            iconColor: "text-primary",
        },
        {
            icon: Droplet,
            value: `${reservoirLevel.toFixed(0)}%`,
            label: t("reservoir_level"),
            status: reservoirStatus as "good" | "warning" | "critical",
            iconBg: "bg-blue-500/10",
            iconColor: "text-blue-500",
        },
        {
            icon: Heart,
            value: `${healthScore}%`,
            label: t("system_health"),
            status: healthStatus as "good" | "warning" | "critical",
            iconBg: "bg-emerald-500/10",
            iconColor: "text-emerald-500",
        },
        {
            icon: ThermometerSun,
            value: `${avgTemp.toFixed(1)}°C`,
            label: t("air_temp"),
            status: "good" as const,
            iconBg: "bg-amber-500/10",
            iconColor: "text-amber-500",
        },
    ];

    const lastUpdateTime = lastUpdate ? new Date(lastUpdate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

    const statusRing: Record<string, string> = {
        good: "ring-emerald-500/20",
        warning: "ring-amber-500/20",
        critical: "ring-red-500/20",
    };
    const statusDot: Record<string, string> = {
        good: "bg-emerald-500",
        warning: "bg-amber-500 animate-pulse",
        critical: "bg-red-500 animate-pulse",
    };

    return (
        <div className="mb-8">
            {/* System Status Banner */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-emerald-500 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`}></span>
                        {connected ? tg("system_normal") : t("connecting")}
                    </span>
                    {lastUpdateTime && (
                        <span className="text-xs text-muted-foreground hidden sm:inline-block">
                            {t("last_update")}: {lastUpdateTime}
                        </span>
                    )}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {STATS.map((stat, i) => (
                    <div
                        key={i}
                        className={`group p-6 rounded-[2rem] border-2 border-border/50 bg-card shadow-sm hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1 transition-all duration-300 cursor-pointer ring-2 ${statusRing[stat.status]}`}
                    >
                        <div className="flex items-start justify-between mb-5">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${stat.iconBg} border-2 border-white/50 dark:border-black/50 shadow-inner`}>
                                <stat.icon className={`w-7 h-7 ${stat.iconColor}`} strokeWidth={2.5} />
                            </div>
                            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${statusDot[stat.status]}`} />
                        </div>
                        <div>
                            <h3 className="text-3xl md:text-4xl font-black text-foreground mb-1.5 tracking-tight" dir="ltr">
                                {stat.value}
                            </h3>
                            <p className="text-base font-bold text-muted-foreground">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
