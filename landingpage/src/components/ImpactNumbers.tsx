"use client";

import { useInView } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";

function Counter({ start = 0, end, suffix = "", prefix = "", label, decimals = 0 }: { start?: number, end: number, suffix?: string, prefix?: string, label: string, decimals?: number }) {
    const [count, setCount] = useState(start);
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });

    useEffect(() => {
        if (isInView) {
            let startTime: number;
            const duration = 2000;
            const step = (timestamp: number) => {
                if (!startTime) startTime = timestamp;
                const progress = Math.min((timestamp - startTime) / duration, 1);
                setCount(Number((progress * (end - start) + start).toFixed(decimals)));
                if (progress < 1) {
                    window.requestAnimationFrame(step);
                }
            };
            window.requestAnimationFrame(step);
        }
    }, [isInView, end, start, decimals]);

    return (
        <div ref={ref} className="text-center p-6 sm:p-8 border border-white/10 rounded-2xl sm:rounded-3xl bg-white/5 backdrop-blur-md hover:bg-white/10 transition-colors duration-500">
            <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-copper-400 mb-3 tracking-tight">
                {prefix}{count}{suffix}
            </div>
            <div className="text-sm font-semibold text-white/80 uppercase tracking-widest">{label}</div>
        </div>
    );
}

export default function ImpactNumbers() {
    const t = useTranslations("ImpactNumbers");

    return (
        <section className="py-20 md:py-32 bg-morocco-blue-900 text-white relative overflow-hidden">
            {/* Background Graphic */}
            <div className="absolute inset-0 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none mix-blend-overlay"></div>
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-agri-green-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none z-0"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-copper-500/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none z-0"></div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
                <div className="text-center mb-20 max-w-2xl mx-auto">
                    <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white leading-tight mb-6">{t('title')}</h2>
                    <p className="text-lg text-blue-100/70">{t('description')}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <Counter end={30} suffix="%" label={t('lessWaterWaste')} />
                    <Counter end={2} suffix={t('wksSuffix')} label={t('earlierDroughtDetection')} />
                    <Counter prefix="+" end={12} suffix="%" label={t('yieldImprovement')} />
                    <Counter end={40} suffix="K+" label={t('hectaresMonitored')} />
                </div>
            </div>
        </section>
    );
}
