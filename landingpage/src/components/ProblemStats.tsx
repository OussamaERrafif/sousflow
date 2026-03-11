"use client";

import { motion } from "framer-motion";
import { ThermometerSun, AlertTriangle, Droplets, Sprout } from "lucide-react";
import { useTranslations } from "next-intl";

export default function ProblemStats() {
    const t = useTranslations("ProblemStats");

    const stats = [
        {
            icon: <ThermometerSun className="w-6 h-6 text-orange-500" />,
            value: t('tempRiseValue'),
            label: t('tempRiseLabel'),
            desc: t('tempRiseDesc'),
            chart: [10, 20, 35, 45, 60, 85, 100], // Temp going up
            chartType: "area",
            color: "bg-orange-50",
            textColor: "text-orange-500",
            className: "md:col-span-2 md:row-span-1"
        },
        {
            icon: <AlertTriangle className="w-6 h-6 text-red-500" />,
            value: t('farmsRiskValue'),
            numValue: 67,
            label: t('farmsRiskLabel'),
            desc: t('farmsRiskDesc'),
            chartType: "donut",
            color: "bg-red-50",
            textColor: "text-red-500",
            className: "md:col-span-1 md:row-span-2"
        },
        {
            icon: <Droplets className="w-6 h-6 text-blue-500" />,
            value: t('waterUsageValue'),
            numValue: 80,
            label: t('waterUsageLabel'),
            desc: t('waterUsageDesc'),
            chartType: "donut",
            color: "bg-blue-50",
            textColor: "text-blue-500",
            className: "md:col-span-1 md:row-span-1"
        },
        {
            icon: <Sprout className="w-6 h-6 text-emerald-500" />,
            value: t('yieldLossValue'),
            label: t('yieldLossLabel'),
            desc: t('yieldLossDesc'),
            chart: [100, 95, 80, 60, 50, 40], // Yield going down
            chartType: "bar",
            color: "bg-emerald-50",
            textColor: "text-emerald-500",
            lineColor: "border-emerald-400",
            className: "md:col-span-1 md:row-span-1"
        }
    ];

    return (
        <section id="problem" className="py-16 md:py-24 bg-white relative">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 md:gap-8 mb-12 md:mb-16">
                    <div className="max-w-2xl">
                        <h2 className="text-sm font-bold tracking-widest text-copper-600 uppercase mb-4">{t('tagline')}</h2>
                        <h3 className="text-2xl sm:text-3xl md:text-5xl font-bold text-morocco-blue-950 leading-tight">
                            {t('title')}
                        </h3>
                    </div>
                    <p className="text-foreground/70 max-w-md text-lg leading-relaxed">
                        {t('description')}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 md:auto-rows-[minmax(280px,auto)] gap-6">
                    {stats.map((stat, i) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ delay: i * 0.15, duration: 0.5 }}
                            key={i}
                            className={`group border border-gray-200 rounded-3xl p-8 hover:border-copper-200 hover:shadow-xl hover:shadow-copper-100/50 transition-all duration-300 bg-white flex flex-col ${stat.className}`}
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${stat.color} order-2`}>
                                    {stat.icon}
                                </div>
                                {stat.chartType !== 'donut' && (
                                    <div className="text-4xl font-bold text-morocco-blue-950 tracking-tight order-1">{stat.value}</div>
                                )}
                            </div>

                            <div className={`flex-1 flex w-full mb-8 opacity-80 group-hover:opacity-100 transition-opacity ${stat.chartType === 'donut' ? 'items-center justify-center' : 'items-end gap-1'} ${stat.className.includes('row-span-2') ? 'min-h-[160px]' : 'min-h-[64px]'}`}>
                                {stat.chartType === 'bar' && stat.chart?.map((h, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex-1 border-t-2 ${stat.lineColor} bg-gradient-to-t from-gray-100 to-transparent`}
                                        style={{ height: `${h}%` }}
                                    />
                                ))}

                                {stat.chartType === 'area' && stat.chart && (
                                    <div className="w-full h-[80px] relative">
                                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={`absolute inset-0 w-full h-full ${stat.textColor} overflow-visible`}>
                                            <path d={`M 0,100 L ${stat.chart.map((d, idx) => `${(idx / ((stat.chart?.length || 2) - 1)) * 100},${100 - ((d - Math.min(...(stat.chart || [0]))) / (Math.max(...(stat.chart || [1])) - Math.min(...(stat.chart || [0])) || 1)) * 90}`).join(" L ")} L 100,100 Z`} fill="currentColor" fillOpacity="0.15" />
                                            <polyline points={stat.chart.map((d, idx) => `${(idx / ((stat.chart?.length || 2) - 1)) * 100},${100 - ((d - Math.min(...(stat.chart || [0]))) / (Math.max(...(stat.chart || [1])) - Math.min(...(stat.chart || [0])) || 1)) * 90}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                )}

                                {stat.chartType === 'donut' && stat.numValue !== undefined && (
                                    <div className={`relative ${stat.className.includes('row-span-2') ? 'h-48 w-48' : 'h-32 w-32'}`}>
                                        <svg viewBox="0 0 36 36" className={`w-full h-full ${stat.textColor}`}>
                                            <path strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" opacity="0.15" />
                                            <motion.path
                                                initial={{ strokeDasharray: "0, 100" }}
                                                whileInView={{ strokeDasharray: `${stat.numValue}, 100` }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 1.5, ease: "easeOut", delay: i * 0.15 }}
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className={`absolute inset-0 flex items-center justify-center font-bold ${stat.className.includes('row-span-2') ? 'text-5xl' : 'text-3xl'} text-morocco-blue-950`}>
                                            {stat.value}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-auto">
                                <h4 className="text-xl font-bold text-gray-900 mb-3">{stat.label}</h4>
                                <p className="text-gray-500 leading-relaxed text-sm">{stat.desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
