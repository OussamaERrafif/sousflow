"use client";

import { useTranslations } from "next-intl";
import { Droplets, TrendingDown } from "lucide-react";

interface ZoneWaterData {
    zone_id: string;
    zone_name: string;
    inlet_lpm: number;
    outlet_lpm: number;
    efficiency_pct: number;
}

interface WaterConsumptionChartProps {
    zones: ZoneWaterData[];
    title?: string;
}

export function WaterConsumptionChart({ zones, title }: WaterConsumptionChartProps) {
    const t = useTranslations("ZoneGrid");
    
    const maxFlow = Math.max(...zones.map(z => z.inlet_lpm), 1);
    const totalInlet = zones.reduce((sum, z) => sum + z.inlet_lpm, 0);
    const totalOutlet = zones.reduce((sum, z) => sum + z.outlet_lpm, 0);
    const avgEfficiency = zones.length > 0 
        ? zones.reduce((sum, z) => sum + z.efficiency_pct, 0) / zones.length 
        : 0;

    return (
        <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">{title || t("water_consumption")}</h3>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>{avgEfficiency.toFixed(0)}% avg efficiency</span>
                </div>
            </div>

            <div className="space-y-3">
                {zones.map((zone) => {
                    const width = (zone.inlet_lpm / maxFlow) * 100;
                    const isLowEfficiency = zone.efficiency_pct < 75;
                    
                    return (
                        <div key={zone.zone_id} className="space-y-1">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-foreground">{zone.zone_name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground" dir="ltr">
                                        {zone.inlet_lpm.toFixed(1)} L/min
                                    </span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        zone.efficiency_pct >= 85 ? "bg-emerald-50 text-emerald-700" :
                                        zone.efficiency_pct >= 75 ? "bg-amber-50 text-amber-700" :
                                        "bg-red-50 text-red-700"
                                    }`}>
                                        {zone.efficiency_pct.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-500 ${
                                        isLowEfficiency ? "bg-red-400" : "bg-blue-500"
                                    }`}
                                    style={{ width: `${width}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 pt-4 border-t border-border flex justify-between">
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Droplets className="w-4 h-4 text-blue-500" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{t("inlet")}</span>
                    </div>
                    <p className="text-lg font-black text-foreground" dir="ltr">{totalInlet.toFixed(1)} <span className="text-xs font-normal">L/min</span></p>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Droplets className="w-4 h-4 text-green-500" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{t("outlet")}</span>
                    </div>
                    <p className="text-lg font-black text-foreground" dir="ltr">{totalOutlet.toFixed(1)} <span className="text-xs font-normal">L/min</span></p>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{t("water_lost")}</span>
                    </div>
                    <p className="text-lg font-black text-red-600" dir="ltr">{(totalInlet - totalOutlet).toFixed(1)} <span className="text-xs font-normal">L/min</span></p>
                </div>
            </div>
        </div>
    );
}
