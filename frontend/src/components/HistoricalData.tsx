import { BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";

export default function HistoricalData() {
    const td = useTranslations("DataViz");

    return (
        <div className="mb-10">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-2xl font-black text-zinc-800 tracking-tight">{td("moisture_history")}</h2>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 overflow-hidden">
                <div className="flex items-center gap-2 mb-6">
                    <BarChart3 className="w-5 h-5 text-zinc-400" />
                    <span className="text-sm font-bold text-zinc-600">متوسط الرطوبة (%) - 24 ساعة الماضية</span>
                </div>

                <div className="h-48 flex items-end justify-between gap-1.5 sm:gap-2 px-1">
                    {[45, 52, 60, 65, 70, 72, 68, 65, 60, 55, 50, 48, 55, 62, 70, 75, 78, 80, 75, 70, 65, 60, 55, 50].map((val, i) => (
                        <div key={i} className="relative flex-1 group h-full flex items-end cursor-pointer">
                            <div
                                className={`w-full rounded-t-sm transition-all duration-300 ${val < 50 ? 'bg-amber-400/60 group-hover:bg-amber-500' : 'bg-emerald-400/60 group-hover:bg-emerald-500'}`}
                                style={{ height: `${val}%` }}
                            >
                                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap z-10 transition-opacity pointer-events-none">
                                    {val}%
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between mt-4 text-[10px] font-bold text-zinc-400 border-t border-zinc-100 pt-3 px-1 tracking-wider" dir="ltr">
                    <span>00:00</span>
                    <span>06:00</span>
                    <span>12:00</span>
                    <span>18:00</span>
                    <span>23:59</span>
                </div>
            </div>
        </div>
    );
}
