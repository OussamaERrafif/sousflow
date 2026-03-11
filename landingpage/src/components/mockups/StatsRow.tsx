import { Droplet, Battery, ThermometerSun, LayoutGrid } from "lucide-react";

export default function StatsRow() {
    const STATS = [
        {
            icon: LayoutGrid,
            value: "8 / 8",
            label: "Active Zones",
            context: "100%",
            contextUp: true,
            iconClass: "text-[#5A4A3A]",
            bgClass: "bg-white",
        },
        {
            icon: Droplet,
            value: "73%",
            label: "Water Saved",
            context: "+5% vs last month",
            contextUp: true,
            iconClass: "text-sky-600",
            bgClass: "bg-white",
        },
        {
            icon: Battery,
            value: "82%",
            label: "Solar Energy",
            context: "Battery full",
            contextUp: true,
            iconClass: "text-emerald-600",
            bgClass: "bg-white",
        },
        {
            icon: ThermometerSun,
            value: "31°C",
            label: "Soil Temp",
            context: "+1.2° higher",
            contextUp: false,
            iconClass: "text-orange-600",
            bgClass: "bg-white",
        },
    ];

    return (
        <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-emerald-500 text-[10px] sm:text-xs font-bold bg-emerald-50 px-2 sm:px-3 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5 shadow-sm">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        System Normal
                    </span>
                    <span className="text-zinc-500 text-[9px] sm:text-[10px] font-bold">
                        Just updated
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {STATS.map((stat, i) => (
                    <div key={i} className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-zinc-200 ${stat.bgClass} shadow-sm hover:shadow-md transition-shadow relative bg-gradient-to-br from-white to-zinc-50/50`}>
                        <div className="flex items-start justify-between mb-2 sm:mb-3 relative z-10 opacity-80 sm:opacity-100">
                            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center bg-zinc-100/80 border border-zinc-200/60 ${stat.iconClass}`}>
                                <stat.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <div className={`hidden sm:block px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-bold ${stat.contextUp ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}>
                                <span>{stat.context}</span>
                            </div>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-xl sm:text-2xl font-black text-zinc-800 mb-0.5 tracking-tight">{stat.value}</h3>
                            <p className="font-bold text-[10px] sm:text-xs text-zinc-500 leading-tight">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
