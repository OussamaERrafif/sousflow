"use client";

import { AlertTriangle, Thermometer, Gauge, Droplets, Activity, ChevronDown, ChevronUp } from "lucide-react";

interface AnomalyType {
    id: number;
    code: string;
    domain: string;
    display_name: string;
    description: string;
    default_severity: string;
    recommended_action: string;
}

interface AnomalyCardProps {
    anomaly: AnomalyType;
    isExpanded: boolean;
    onToggle: () => void;
    count?: number;
}

const domainIcons: Record<string, React.ElementType> = {
    hydraulic: Droplets,
    sensor: Gauge,
    equipment: Activity,
    environmental: Thermometer,
};

const severityColors: Record<string, { bg: string; text: string; border: string }> = {
    critical: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/30" },
    high: { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/30" },
    medium: { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/30" },
    low: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/30" },
    info: { bg: "bg-gray-500/10", text: "text-gray-500", border: "border-gray-500/30" },
};

export function AnomalyCard({ anomaly, isExpanded, onToggle, count }: AnomalyCardProps) {
    const Icon = domainIcons[anomaly.domain] || AlertTriangle;
    const colors = severityColors[anomaly.default_severity] || severityColors.info;

    return (
        <div className={`bg-card rounded-xl border ${colors.border} overflow-hidden`}>
            <button
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                onClick={onToggle}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.bg}`}>
                        <Icon className={`w-4 h-4 ${colors.text}`} />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-semibold text-foreground">
                            {anomaly.display_name}
                        </p>
                        <p className={`text-xs ${colors.text}`}>{anomaly.domain}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {count !== undefined && count > 0 && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white ${colors.bg.replace('/10', '')}`}>
                            {count}
                        </span>
                    )}
                    {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                </div>
            </button>

            {isExpanded && (
                <div className="p-3 pt-0 space-y-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">{anomaly.description}</p>

                    {anomaly.recommended_action && (
                        <div className={`p-2 rounded-lg ${colors.bg}`}>
                            <p className="text-[10px] text-muted-foreground mb-1">Recommended Action</p>
                            <p className="text-xs font-medium" dir="ltr">
                                {anomaly.recommended_action}
                            </p>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Code: </span>
                        <span className="text-xs font-mono text-muted-foreground">{anomaly.code}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
