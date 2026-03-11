"use client";

import { Droplets, Info, TrendingDown, Map as MapIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export default function CrisisTicker() {
    const t = useTranslations("CrisisTicker");

    // Duplicate for seamless marquee effect
    const items = [
        { text: t('t1'), icon: <Info className="w-4 h-4" /> },
        { text: t('t2'), icon: <TrendingDown className="w-4 h-4" /> },
        { text: t('t3'), icon: <Droplets className="w-4 h-4" /> },
        { text: t('t4'), icon: <MapIcon className="w-4 h-4" /> },
        { text: t('t5'), icon: <Info className="w-4 h-4" /> },
    ];

    const content = [...items, ...items, ...items];

    return (
        <div className="bg-morocco-blue-950 text-white overflow-hidden py-3 border-y border-white/10 relative">
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-morocco-blue-950 to-transparent z-10 pointer-events-none"></div>
            <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-morocco-blue-950 to-transparent z-10 pointer-events-none"></div>

            <div className="flex w-max animate-marquee space-x-8 lg:space-x-16">
                {content.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm font-light tracking-wide shrink-0">
                        <span className="text-copper-500">{item.icon}</span>
                        <span className="opacity-90">{item.text}</span>
                        <span className="text-white/20 ml-8 hidden lg:inline">|</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
