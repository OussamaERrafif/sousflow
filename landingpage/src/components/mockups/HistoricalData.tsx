import { BarChart3 } from "lucide-react";

export default function HistoricalData() {
    return (
        <div className="mb-2">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h2 className="text-lg sm:text-xl font-black text-zinc-800 tracking-tight">Moisture History</h2>
                </div>
            </div>

            <div className="bg-white rounded-xl sm:rounded-2xl border border-zinc-200 shadow-sm p-4 sm:p-5 overflow-hidden">
                <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-zinc-400" />
                    <span className="text-[10px] sm:text-xs font-bold text-zinc-600">Avg Moisture (%) - Last 24h</span>
                </div>

                <div className="h-28 flex items-end justify-between gap-1 px-1">
                    {[45, 52, 60, 65, 70, 72, 68, 65, 60, 55, 50, 48, 55, 62, 70, 75, 78, 80, 75, 70, 65, 60].map((val, i) => (
                        <div key={i} className="relative flex-1 group h-full flex items-end cursor-pointer">
                            <div
                                className={`w-full rounded-t-sm transition-all duration-300 ${val < 50 ? 'bg-amber-400/60 group-hover:bg-amber-500' : 'bg-emerald-400/60 group-hover:bg-emerald-500'}`}
                                style={{ height: `${val}%` }}
                            >
                                <div className="hidden group-hover:block absolute -top-6 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm whitespace-nowrap z-10 pointer-events-none shadow-sm">
                                    {val}%
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between mt-3 text-[9px] sm:text-[10px] font-bold text-zinc-400 border-t border-zinc-100 pt-2 px-1 tracking-wider">
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
