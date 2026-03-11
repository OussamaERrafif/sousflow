"use client";

import { motion } from "framer-motion";
import { Gauge, BellRing, MapPin, Database } from "lucide-react";
import { useTranslations } from "next-intl";

export default function Features() {
    const t = useTranslations("Features");

    const coreFeatures = [
        {
            icon: <Gauge className="w-8 h-8 text-copper-500" />,
            title: t('feat1Title'),
            desc: t('feat1Desc'),
            illustration: (
                <div className="absolute right-0 bottom-0 w-32 h-32 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
            )
        },
        {
            icon: <BellRing className="w-8 h-8 text-red-500" />,
            title: t('feat2Title'),
            desc: t('feat2Desc'),
            illustration: (
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-red-100 rounded-full blur-2xl opacity-50"></div>
            )
        },
        {
            icon: <MapPin className="w-8 h-8 text-agri-green-500" />,
            title: t('feat3Title'),
            desc: t('feat3Desc'),
            illustration: (
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-100 rounded-full blur-2xl opacity-50"></div>
            )
        },
        {
            icon: <Database className="w-8 h-8 text-blue-500" />,
            title: t('feat4Title'),
            desc: t('feat4Desc'),
            illustration: (
                <div className="absolute right-4 bottom-4 w-16 h-16 border-[10px] border-gray-100 rounded-full opacity-50"></div>
            )
        }
    ];

    return (
        <section id="features" className="py-16 md:py-24 bg-white relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="text-center mb-16 max-w-2xl mx-auto">
                    <h2 className="text-sm font-bold tracking-[0.2em] text-copper-600 uppercase mb-4">{t('tagline')}</h2>
                    <h3 className="text-2xl sm:text-3xl md:text-5xl font-bold text-morocco-blue-950 leading-tight">
                        {t('title')}
                    </h3>
                    <p className="mt-6 text-gray-600 leading-relaxed text-lg">
                        {t('description')}
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {coreFeatures.map((feat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ delay: i * 0.15, duration: 0.5 }}
                            whileHover={{ y: -5 }}
                            className="relative bg-gray-50 border border-gray-100 rounded-2xl sm:rounded-3xl p-6 sm:p-8 hover:bg-white hover:shadow-xl hover:shadow-copper-100/50 transition-all duration-300 overflow-hidden group cursor-pointer"
                        >
                            {feat.illustration}

                            <div className="relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                    {feat.icon}
                                </div>
                                <h4 className="text-2xl font-bold text-morocco-blue-950 mb-3">{feat.title}</h4>
                                <p className="text-gray-600 leading-relaxed text-lg">
                                    {feat.desc}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
