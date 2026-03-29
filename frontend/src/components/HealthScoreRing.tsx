"use client";

interface HealthScoreRingProps {
    score: number;
    label: string;
    size?: "sm" | "md" | "lg";
    showScore?: boolean;
}

const sizeConfig = {
    sm: { outer: 48, stroke: 4, fontSize: "text-[10px]" },
    md: { outer: 80, stroke: 6, fontSize: "text-sm" },
    lg: { outer: 120, stroke: 8, fontSize: "text-xl" },
};

const getScoreColor = (score: number): string => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-amber-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
};

const getStrokeColor = (score: number): string => {
    if (score >= 80) return "#10b981";
    if (score >= 60) return "f59e0b";
    if (score >= 40) return "f97316";
    return "#ef4444";
};

export function HealthScoreRing({ score, label, size = "md", showScore = true }: HealthScoreRingProps) {
    const config = sizeConfig[size];
    const radius = (config.outer - config.stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = getScoreColor(score);
    const strokeColor = getStrokeColor(score);

    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative" style={{ width: config.outer, height: config.outer }}>
                <svg width={config.outer} height={config.outer} className="rotate-[-90deg]">
                    <circle
                        cx={config.outer / 2}
                        cy={config.outer / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={config.stroke}
                        className="text-muted/20"
                    />
                    <circle
                        cx={config.outer / 2}
                        cy={config.outer / 2}
                        r={radius}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={config.stroke}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className="transition-all duration-500 ease-out"
                    />
                </svg>
                {showScore && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`font-bold ${color} ${config.fontSize}`}>
                            {Math.round(score)}
                        </span>
                    </div>
                )}
            </div>
            <span className="text-[10px] text-muted-foreground text-center max-w-[80px]">{label}</span>
        </div>
    );
}
