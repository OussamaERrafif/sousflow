"use client";

export function AnomalyBadge({ count, severity }: { count: number; severity?: string }) {
    if (count === 0) return null;
    const color = severity === "critical" ? "bg-red-500" : severity === "high" ? "bg-orange-500" : "bg-amber-400";
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white ${color}`}>
            {count}
        </span>
    );
}
