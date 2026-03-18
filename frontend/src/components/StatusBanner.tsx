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
        const dryZones = sseReadings.filter(r => (r.soil_moisture_pct ?? 100) < 35);
        const irrigatingZones = sseReadings.filter(r => r.irrigation_needed === 1);

        if (anomalyZones.length > 0) {
            status = "critical";
            alertMessage = `${anomalyZones.length} zone(s) with sensor anomaly`;
            alertDetails = `Zones: ${anomalyZones.map(r => r.zone_id).join(", ")}`;
        } else if (dryZones.length > 0) {
            status = "warning";
            alertMessage = `${dryZones.length} zone(s) critically dry`;
            alertDetails = `${irrigatingZones.length} zone(s) currently irrigating`;
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
            icon: <CheckCircle2 className="w-10 h-10 text-emerald-400" />,
            title: t("good_title"),
            desc: t("good_desc"),
        },
        warning: {
            bg: "bg-zinc-800 border-l-4 border-amber-400 rtl:border-r-4 rtl:border-l-0",
            icon: <AlertTriangle className="w-10 h-10 text-amber-400" />,
            title: alertMessage || t("warning_title"),
            desc: alertDetails || t("warning_desc"),
        },
        critical: {
            bg: "bg-zinc-800 border-l-4 border-red-500 rtl:border-r-4 rtl:border-l-0",
            icon: <XCircle className="w-10 h-10 text-red-500" />,
            title: alertMessage || t("critical_title"),
            desc: alertDetails || t("critical_desc"),
        },
    };

    const config = configs[status];

    return (
        <div className={`relative w-full rounded-2xl overflow-hidden p-5 mb-8 ${config.bg} shadow-md text-white transition-colors duration-300`}>
            <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none"
                style={{ backgroundImage: "radial-gradient(circle at top right, white 0%, transparent 60%)" }}>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 relative z-10 w-full">
                <div className="w-16 h-16 shrink-0 bg-white/10 rounded-xl flex items-center justify-center shadow-inner ring-1 ring-white/20">
                    {config.icon}
                </div>

                <div className="flex-1">
                    <h2 className="text-xl md:text-2xl font-black mb-1.5 leading-tight tracking-tight">{config.title}</h2>
                    <p className="text-sm md:text-base text-zinc-300 font-bold leading-tight">{config.desc}</p>
                </div>

                {status !== "good" && (
                    <div className="flex items-center gap-3 mt-4 sm:mt-0 w-full sm:w-auto">
                        <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-500 text-white font-bold py-2.5 px-6 rounded-xl hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-all outline-none">
                            <Power className="w-5 h-5" />
                            <span>{t("open_sector")}</span>
                        </button>
                        <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white/10 text-white font-bold py-2.5 px-6 rounded-xl hover:bg-white/20 hover:scale-105 active:scale-95 transition-all outline-none">
                            <FileText className="w-5 h-5" />
                            <span>{t("view_details")}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
