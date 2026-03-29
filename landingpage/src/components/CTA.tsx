"use client";

import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { useTranslations } from "next-intl";

export default function CTA() {
    const t = useTranslations("CTA");

    return (
        <section className="py-16 md:py-24 bg-white px-4 sm:px-6">
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
                className="max-w-5xl mx-auto rounded-2xl sm:rounded-3xl bg-morocco-blue-900 px-4 sm:px-6 py-14 md:py-24 text-center relative overflow-hidden isolate"
            >
                {/* Radial Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[150%] max-w-3xl bg-gradient-radial from-agri-green-500/20 to-transparent blur-[60px] -z-10" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none z-0" />

                <div className="relative z-10 max-w-3xl mx-auto">
                    <h2
                        className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] font-bold text-white mb-6 leading-tight"
                        dangerouslySetInnerHTML={{ __html: t.raw('title') }}
                    />
                    <p className="text-lg md:text-xl text-blue-100/80 mb-10 max-w-xl mx-auto leading-relaxed">
                        {t('description')}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <a href="https://sousflowfrontend.vercel.app/ar" className="w-full sm:w-auto bg-copper-500 hover:bg-copper-600 text-white px-10 py-5 rounded-full font-bold text-lg transition-all shadow-xl shadow-copper-500/25 flex items-center justify-center gap-2 hover:-translate-y-0.5">
                            {t('startTrial')} <ArrowRight size={20} strokeWidth={3} />
                        </a>
                        <button className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border-2 border-white/20 text-white px-10 py-5 rounded-full font-bold text-lg transition-all backdrop-blur-sm flex items-center justify-center gap-2 hover:-translate-y-0.5">
                            <Play size={18} className="fill-current" /> {t('seeDemo')}
                        </button>
                    </div>

                    <div className="mt-8 text-sm text-blue-200/60 font-medium">
                        {t('disclaimer')}
                    </div>
                </div>
            </motion.div>
        </section>
    );
}
