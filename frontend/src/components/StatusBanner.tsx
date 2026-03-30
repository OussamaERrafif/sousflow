import { CheckCircle2, AlertTriangle, XCircle, Power, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useGetDashboardApiIotDashboardGetQuery } from "@/lib/store/generated/api";
import { useAppSelector } from "@/lib/store/hooks";
import { useDebugLog } from "@/lib/debug";

export default function StatusBanner() {
    const t = useTranslations("StatusBanner");

    const { readings: sseReadings, connected } = useAppSelector((state) => state.iot);
    const hasLiveData = connected && sseReadings.length > 0;

    useDebugLog("StatusBanner - sseReadings", sseReadings);
    useDebugLog("StatusBanner - connected", connected);

    const { data: dashboardData } = useGetDashboardApiIotDashboardGetQuery(
        undefined,
        { skip: hasLiveData }
    );

    // Derive status from SSE readings when live
    let status: "good" | "warning" | "critical";
    let alertMessage: string | undefined;
    let alertDetails: string | undefined;

    if (hasLiveData) {
        const anomalyZones = sseReadings.filter(r => r.is_anomaly);
        const dryZones     = sseReadings.filter(r => (r.soil_moisture_pct ?? 100) < 35);
        const irrigatingZones = sseReadings.filter(r => r.irrigation_needed === 1);

        if (anomalyZones.length > 0) {
            status = "critical";
            alertMessage = t("live_anomaly_title", { count: anomalyZones.length });
            alertDetails  = t("live_anomaly_desc",  { zones: anomalyZones.map(r => r.zone_id).join(", ") });
        } else if (dryZones.length > 0) {
            status = "warning";
            alertMessage = t("live_dry_title",       { count: dryZones.length });
            alertDetails  = t("live_irrigating_desc", { count: irrigatingZones.length });
        } else {
            status = "good";
        }
    } else {
        const raw = dashboardData?.system_status || "good";
        status = raw as "good" | "warning" | "critical";
        alertMessage = dashboardData?.alert_message;
        alertDetails = dashboardData?.alert_details;
    }

    const configs = {
        good: {
            bg: "bg-zinc-800",
            icon: <CheckCircle2 className="w-8 h-8 text-emerald-400" />,
            title: t("good_title"),
            desc: t("good_desc"),
        },
        warning: {
            bg: "bg-zinc-800 border-l-4 border-amber-400 rtl:border-r-4 rtl:border-l-0",
            icon: <AlertTriangle className="w-8 h-8 text-amber-400" />,
            title: alertMessage || t("warning_title"),
            desc: alertDetails || t("warning_desc"),
        },
        critical: {
            bg: "bg-zinc-800 border-l-4 border-red-500 rtl:border-r-4 rtl:border-l-0",
            icon: <XCircle className="w-8 h-8 text-red-500" />,
            title: alertMessage || t("critical_title"),
            desc: alertDetails || t("critical_desc"),
        },
    };

    const config = configs[status];

    return (
        <div className={`relative w-full rounded-2xl overflow-hidden p-4 md:p-5 mb-6 ${config.bg} shadow-md text-white transition-colors duration-300`}>
            <div className="absolute top-0 ltr:right-0 rtl:left-0 w-full h-full opacity-10 pointer-events-none"
                style={{ backgroundImage: `radial-gradient(circle at top ${typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? 'left' : 'right'}, white 0%, transparent 60%)` }}>
            </div>

            <div className="flex items-center gap-4 relative z-10 w-full">
                <div className="w-12 h-12 shrink-0 bg-white/10 rounded-xl flex items-center justify-center shadow-inner ring-1 ring-white/20">
                    {config.icon}
                </div>

                <div className="flex-1 min-w-0">
                    <h2 className="text-base md:text-lg font-black mb-0.5 leading-tight tracking-tight truncate">{config.title}</h2>
                    <p className="text-xs md:text-sm text-zinc-300 font-medium leading-tight">{config.desc}</p>
                </div>

                {status !== "good" && (
                    <div className="flex items-center gap-2 shrink-0">
                        <button className="flex items-center gap-1.5 bg-emerald-500 text-white font-bold py-2 px-4 rounded-xl hover:bg-emerald-400 active:scale-95 transition-all outline-none text-sm shadow-md">
                            <Power className="w-4 h-4" strokeWidth={2.5} />
                            <span className="hidden sm:inline">{t("open_sector")}</span>
                        </button>
                        <button className="flex items-center gap-1.5 bg-white/10 text-white font-bold py-2 px-4 rounded-xl hover:bg-white/20 active:scale-95 transition-all outline-none text-sm">
                            <FileText className="w-4 h-4" strokeWidth={2.5} />
                            <span className="hidden sm:inline">{t("view_details")}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
