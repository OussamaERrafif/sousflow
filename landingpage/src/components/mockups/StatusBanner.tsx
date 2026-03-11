import { CheckCircle2, AlertTriangle, XCircle, Power } from "lucide-react";

export default function StatusBanner({ status = "good" }: { status?: "good" | "warning" | "critical" }) {
    const configs = {
        good: {
            bg: "bg-zinc-800",
            icon: <CheckCircle2 className="w-10 h-10 text-emerald-400" />,
            title: "System Optimized",
            desc: "All zones are operating within optimal parameters.",
        },
        warning: {
            bg: "bg-zinc-800 border-l-4 border-amber-400 rtl:border-r-4 rtl:border-l-0",
            icon: <AlertTriangle className="w-10 h-10 text-amber-400" />,
            title: "Attention Needed",
            desc: "Some zones are showing irregularities.",
        },
        critical: {
            bg: "bg-zinc-800 border-l-4 border-red-500 rtl:border-r-4 rtl:border-l-0",
            icon: <XCircle className="w-10 h-10 text-red-500" />,
            title: "Critical Alert",
            desc: "Immediate intervention required in critical zones.",
        }
    };

    const config = configs[status];

    return (
        <div className={`relative w-full rounded-2xl overflow-hidden p-4 sm:p-5 mb-6 ${config.bg} shadow-md text-white transition-colors duration-300`}>
            {/* Background texture for visual polish without heavy gradients */}
            <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none"
                style={{ backgroundImage: "radial-gradient(circle at top right, white 0%, transparent 60%)" }}>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 relative z-10 w-full">
                <div className="hidden sm:flex w-14 h-14 shrink-0 bg-white/10 rounded-xl items-center justify-center shadow-inner ring-1 ring-white/20">
                    {config.icon}
                </div>

                <div className="flex-1 text-center sm:text-left">
                    <h2 className="text-xl font-black mb-1 leading-tight tracking-tight">{config.title}</h2>
                    <p className="text-sm text-zinc-300 font-bold leading-tight">{config.desc}</p>
                </div>

                {status !== "good" && (
                    <div className="flex items-center justify-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
                        <button className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-500 text-white font-bold py-2 px-4 rounded-xl hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-all outline-none text-xs">
                            <Power className="w-4 h-4" />
                            <span>Action</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
