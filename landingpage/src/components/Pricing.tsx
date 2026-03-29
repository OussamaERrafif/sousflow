"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export default function Pricing() {
    const t = useTranslations("Pricing");

    const tiers = [
        {
            name: t('t1Name'),
            desc: t('t1Desc'),
            features: [
                t('t1f1'),
                t('t1f2'),
                t('t1f3'),
                t('t1f4'),
                t('t1f5')
            ],
            featured: false,
            cta: t('t1Cta')
        },
        {
            name: t('t2Name'),
            desc: t('t2Desc'),
            features: [
                t('t2f1'),
                t('t2f2'),
                t('t2f3'),
                t('t2f4'),
                t('t2f5')
            ],
            featured: true,
            cta: t('t2Cta')
        },
        {
            name: t('t3Name'),
            desc: t('t3Desc'),
            features: [
                t('t3f1'),
                t('t3f2'),
                t('t3f3'),
                t('t3f4'),
                t('t3f5')
            ],
            featured: false,
            cta: t('t3Cta')
        }
    ];

    return (
        <section id="pricing" className="py-16 md:py-24 bg-white relative">
            <div className="absolute top-0 w-full h-[600px] bg-gradient-to-b from-gray-50 to-white" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">

                <div className="text-center max-w-2xl mx-auto mb-20">
                    <h2 className="text-sm font-bold tracking-[0.2em] text-copper-600 uppercase mb-4">{t('tagline')}</h2>
                    <h3 className="text-2xl sm:text-3xl md:text-5xl font-bold text-morocco-blue-950 leading-tight">
                        {t('title')}
                    </h3>
                    <p className="mt-4 text-gray-600 text-lg">
                        {t('description')}
                    </p>
                </div>

                <div className="grid lg:grid-cols-3 gap-8 items-center max-w-6xl mx-auto">
                    {tiers.map((tier, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.15, duration: 0.5 }}
                            className={cn(
                                "rounded-3xl p-8 relative flex flex-col h-full",
                                tier.featured
                                    ? "bg-morocco-blue-900 text-white shadow-2xl md:scale-105 border border-morocco-blue-800 z-10 py-10 md:py-12"
                                    : "bg-white text-gray-800 shadow-xl shadow-gray-100 border border-gray-200"
                            )}
                        >
                            {tier.featured && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-copper-500 text-white px-5 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase shadow-lg shadow-copper-500/30 whitespace-nowrap">
                                    {t('mostPopular')}
                                </div>
                            )}

                            <div className="mb-4">
                                <h4 className="text-2xl font-bold mb-1">{tier.name}</h4>
                                <div className={cn("text-sm font-bold", tier.featured ? "text-copper-400" : "text-copper-600")}>
                                    {tier.desc}
                                </div>
                            </div>

                            <div className="mb-6 pb-6 border-b border-gray-200/20">
                                <div className="flex items-baseline gap-1 mb-2">
                                    <span className="text-4xl font-bold tracking-tight">{t('contactUs')}</span>
                                </div>
                            </div>

                            <ul className="flex-1 space-y-4 mb-8">
                                {tier.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <Check className={cn("w-5 h-5 shrink-0", tier.featured ? "text-copper-400" : "text-agri-green-500")} />
                                        <span className={cn("text-sm font-medium", tier.featured ? "text-white/90" : "text-gray-700")}>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <a href="https://sousflowfrontend.vercel.app/ar" className={cn(
                                "w-full py-4 rounded-xl font-bold transition-all text-center block",
                                tier.featured
                                    ? "bg-copper-500 hover:bg-copper-400 text-white shadow-lg shadow-copper-500/30"
                                    : "bg-morocco-blue-900 hover:bg-morocco-blue-950 text-white"
                            )}>
                                {tier.cta}
                            </a>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
