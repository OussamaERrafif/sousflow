"use client";

import {
    Droplets,
    Waves,
    Gauge,
    Filter,
    CircleDot,
    ThermometerSun,
    AlertTriangle,
    Leaf,
    Sprout,
    TreeDeciduous,
    Activity,
    Zap,
    BatteryWarning,
    WifiOff,
    Clock,
    TrendingDown,
    TrendingUp,
    MinusCircle,
    XCircle,
    CheckCircle2,
    AlertCircle,
    Info,
    Ban,
    EyeOff,
    GaugeCircle,
    Pill,
    Snowflake,
    Flame,
    Wind,
    CloudRain,
    ToggleLeft,
    ToggleRight,
} from "lucide-react";
import { getSeverityColor } from "./ZoneRiskOverlay";

interface AnomalyTypeIconProps {
    type: string;
    severity?: string;
    className?: string;
    showLabel?: boolean;
}

const ANOMALY_TYPE_ICONS: Record<string, React.ElementType> = {
    // Hydraulic
    LEAK_BRANCH: Waves,
    LEAK_ZONE: Droplets,
    PIPE_BURST: AlertTriangle,
    DRIPPER_CLOG_PARTIAL: Filter,
    DRIPPER_CLOG_SEVERE: Filter,
    FILTER_CLOG_EARLY: Filter,
    FILTER_CLOG_CRITICAL: Filter,
    VALVE_STUCK_OPEN: ToggleRight,
    VALVE_STUCK_CLOSED: ToggleLeft,
    PRESSURE_ANOMALY_LOW: Gauge,
    PRESSURE_ANOMALY_HIGH: Gauge,

    // Agronomic
    OVER_IRRIGATION: Droplets,
    UNDER_IRRIGATION: Waves,
    UNEVEN_ZONE: Leaf,
    WATERLOGGING_RISK: Waves,
    ROOT_ZONE_DRY: Sprout,
    STRESS_SPIKE: ThermometerSun,
    YIELD_RISK_HEAT: ThermometerSun,

    // Equipment
    PUMP_DEGRADATION: TrendingDown,
    PUMP_FAILURE_IMMINENT: AlertTriangle,
    PUMP_CAVITATION: Waves,
    RESERVOIR_CRITICAL: BatteryWarning,
    RESERVOIR_LEAK: Droplets,
    SENSOR_COMMUNICATION_LOSS: WifiOff,

    // Data
    SENSOR_FROZEN: MinusCircle,
    SENSOR_DRIFT: TrendingDown,
    IMPOSSIBLE_VALUE: XCircle,
    MISSING_DATA: AlertCircle,
    CROSS_SENSOR_CONFLICT: AlertTriangle,
    CLOCK_DRIFT: Clock,

    // Statistical
    z_score: TrendingUp,
    sudden_change: Activity,
    stuck_sensor: MinusCircle,
    drift: TrendingDown,
    correlation: Activity,

    // ML
    ml_isolation_forest: AlertTriangle,
};

const ANOMALY_DOMAINS: Record<string, string> = {
    // Hydraulic
    LEAK_BRANCH: "hydraulic",
    LEAK_ZONE: "hydraulic",
    PIPE_BURST: "hydraulic",
    DRIPPER_CLOG_PARTIAL: "hydraulic",
    DRIPPER_CLOG_SEVERE: "hydraulic",
    FILTER_CLOG_EARLY: "hydraulic",
    FILTER_CLOG_CRITICAL: "hydraulic",
    VALVE_STUCK_OPEN: "hydraulic",
    VALVE_STUCK_CLOSED: "hydraulic",
    PRESSURE_ANOMALY_LOW: "hydraulic",
    PRESSURE_ANOMALY_HIGH: "hydraulic",

    // Agronomic
    OVER_IRRIGATION: "agronomic",
    UNDER_IRRIGATION: "agronomic",
    UNEVEN_ZONE: "agronomic",
    WATERLOGGING_RISK: "agronomic",
    ROOT_ZONE_DRY: "agronomic",
    STRESS_SPIKE: "agronomic",
    YIELD_RISK_HEAT: "agronomic",

    // Equipment
    PUMP_DEGRADATION: "equipment",
    PUMP_FAILURE_IMMINENT: "equipment",
    PUMP_CAVITATION: "equipment",
    RESERVOIR_CRITICAL: "equipment",
    RESERVOIR_LEAK: "equipment",
    SENSOR_COMMUNICATION_LOSS: "equipment",

    // Data
    SENSOR_FROZEN: "data",
    SENSOR_DRIFT: "data",
    IMPOSSIBLE_VALUE: "data",
    MISSING_DATA: "data",
    CROSS_SENSOR_CONFLICT: "data",
    CLOCK_DRIFT: "data",

    // Statistical
    z_score: "statistical",
    sudden_change: "statistical",
    stuck_sensor: "statistical",
    drift: "statistical",
    correlation: "statistical",

    // ML
    ml_isolation_forest: "ml",
};

export function AnomalyTypeIcon({ type, severity, className = "w-5 h-5", showLabel = false }: AnomalyTypeIconProps) {
    const Icon = ANOMALY_TYPE_ICONS[type] || AlertCircle;
    const domain = ANOMALY_DOMAINS[type] || "unknown";
    const color = severity ? getSeverityColor(severity) : getDomainColor(domain);

    return (
        <div className="flex items-center gap-2">
            <Icon className={className} style={{ color }} />
            {showLabel && (
                <span className="text-sm text-muted-foreground capitalize">
                    {type.replace(/_/g, " ").toLowerCase()}
                </span>
            )}
        </div>
    );
}

export function getDomainColor(domain: string): string {
    switch (domain) {
        case "hydraulic": return "#0ea5e9";
        case "agronomic": return "#22c55e";
        case "equipment": return "#f97316";
        case "data": return "#8b5cf6";
        case "statistical": return "#06b6d4";
        case "ml": return "#ec4899";
        default: return "#6b7280";
    }
}

export function getAnomalyDomain(type: string): string {
    return ANOMALY_DOMAINS[type] || "unknown";
}

export function getAllAnomalyTypes(): string[] {
    return Object.keys(ANOMALY_TYPE_ICONS);
}
