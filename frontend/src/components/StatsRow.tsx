import { Droplet, Battery, ThermometerSun, LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";

export default function StatsRow() {
    const tg = useTranslations("GlobalStatus");
    const t = useTranslations("StatsRow");

    const STATS = [
        {
            icon: LayoutGrid,
            value: "8 / 8",
            label: t("active_zones"),
            context: "100%",
            contextUp: true,
            iconClass: "text-[#5A4A3A]",
            bgClass: "bg-white",
        },
        {
            icon: Droplet,
            value: "73%",
            label: t("water_saved"),
            context: "+5% vs الشهر الماضي",
            contextUp: true,
            iconClass: "text-sky-600",
            bgClass: "bg-white",
        },
        {
            icon: Battery,
            value: "82%",
            label: t("solar_energy"),
            context: t("solar_desc"),
            contextUp: true,
            iconClass: "text-emerald-600",
            bgClass: "bg-white",
        },
        {
            icon: ThermometerSun,
            value: "31°C",
            label: t("soil_temp"),
            context: "+1.2° " + t("soil_temp_desc"),
            contextUp: false,
            iconClass: "text-orange-600",
            bgClass: "bg-white",
        },
    ];

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-emerald-500 text-sm font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        {tg("system_normal")}
                    </span>
                    <span className="text-zinc-500 text-xs font-bold hidden sm:inline-block">
                        {tg("last_updated", { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                {STATS.map((stat, i) => (
                    <div key={i} className={`p-5 rounded-2xl border border-zinc-200 ${stat.bgClass} shadow-sm hover:shadow-md transition-shadow relative bg-gradient-to-br from-white to-zinc-50/50`}>
                        <div className="flex items-start justify-between mb-3 relative z-10">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-zinc-100/80 border border-zinc-200/60 ${stat.iconClass}`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                            <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${stat.contextUp ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}>
                                <span dir="ltr">{stat.context}</span>
                            </div>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-2xl md:text-3xl font-black text-zinc-800 mb-0.5 tracking-tight" dir="ltr">{stat.value}</h3>
                            <p className="font-bold text-sm text-zinc-500">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
