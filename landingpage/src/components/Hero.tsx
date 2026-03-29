"use client";

import { motion } from "framer-motion";
import { ChevronRight, Play } from "lucide-react";
import StatusBanner from "./mockups/StatusBanner";
import StatsRow from "./mockups/StatsRow";
import HistoricalData from "./mockups/HistoricalData";
import WhatsappPhone from "./mockups/WhatsappPhone";
import { useTranslations } from "next-intl";

export default function Hero() {
    const t = useTranslations("Hero");

    return (
        <section className="relative min-h-[80vh] md:min-h-[95vh] flex flex-col items-center justify-center pt-24 md:pt-32 pb-12 md:pb-20 overflow-hidden bg-background">
            {/* Background gradients and grid */}
            <div className="absolute inset-0 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
            <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>

            {/* Animated Orbs */}
            <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-agri-green-500/20 rounded-full blur-3xl opacity-60 animate-blob pointer-events-none mix-blend-multiply"></div>
            <div className="absolute top-1/3 right-1/4 w-[35vw] h-[35vw] max-w-[400px] max-h-[400px] bg-morocco-blue-900/20 rounded-full blur-3xl opacity-50 animate-blob [animation-delay:2s] pointer-events-none mix-blend-multiply"></div>

            <div className="relative z-10 container mx-auto px-4 sm:px-6 grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-8 items-center">
                {/* Text Content */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="flex flex-col gap-6"
                >
                    <div className="inline-flex items-center gap-2 rounded-full border border-copper-200 bg-copper-50/80 px-4 py-1.5 text-sm font-medium text-copper-800 w-fit">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-copper-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-copper-600"></span>
                        </span>
                        {t('trustedBy')}
                    </div>

                    <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold tracking-tight text-morocco-blue-950 leading-[1.1]">
                        {t('title')}
                    </h1>

                    <p className="text-lg md:text-xl text-foreground/80 max-w-xl leading-relaxed">
                        {t('description')}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <a href="https://sousflowfrontend.vercel.app/ar" className="bg-copper-600 hover:bg-copper-700 text-white px-8 py-4 rounded-full font-bold transition-all shadow-xl shadow-copper-500/25 flex items-center justify-center gap-2 hover:-translate-y-0.5">
                            {t('getInsights')} <ChevronRight size={18} strokeWidth={3} />
                        </a>
                        <button className="bg-white hover:bg-gray-50 text-morocco-blue-950 border-2 border-gray-200 px-8 py-4 rounded-full font-bold transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5">
                            <Play size={18} className="fill-current" /> {t('watchDemo')}
                        </button>
                    </div>

                    <div className="mt-8 flex flex-wrap items-center gap-4 md:gap-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                        <div className="text-sm font-bold text-gray-400 uppercase tracking-widest w-full sm:w-auto text-center sm:text-left">{t('partners')}</div>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 md:gap-6 w-full sm:w-auto">
                            <div className="font-bold text-xl md:text-2xl font-serif text-morocco-blue-900">Jazari Institute</div>
                            <img src="/uiz.png" alt="UIZ" className="h-12 md:h-16 w-auto object-contain invert" />
                            <img src="/Minstere.svg" alt="Ministère" className="h-12 md:h-16 w-auto object-contain" />
                        </div>
                    </div>
                </motion.div>

                {/* Live Mockup */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="relative w-full h-full min-h-[400px] sm:min-h-[500px] md:min-h-[550px]"
                >
                    {/* Main Dashboard Panel */}
                    <div className="absolute inset-0 bg-gray-50/80 rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.2)] border border-gray-200 p-4 sm:p-6 flex flex-col overflow-hidden z-20 pointer-events-auto">
                        <div className="w-full h-full overflow-y-auto no-scrollbar pr-1 pb-4">
                            <StatusBanner status="warning" />
                            <StatsRow />
                            <HistoricalData />
                        </div>
                    </div>

                    {/* Floating UI Elements for depth */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, duration: 0.5 }}
                        className="absolute -bottom-6 -left-4 md:-left-10 bg-white p-4 rounded-2xl shadow-xl border border-gray-100 z-30 hidden sm:flex items-center gap-4"
                    >
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                            30%
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-morocco-blue-950">Water Saved</span>
                            <span className="text-xs text-gray-500">This month</span>
                        </div>
                    </motion.div>

                    {/* Smart Assistant WhatsApp Phone */}
                    <motion.div
                        initial={{ opacity: 0, y: 50, rotate: 5 }}
                        animate={{ opacity: 1, y: 0, rotate: -5 }}
                        transition={{ delay: 0.8, duration: 0.8, type: "spring", bounce: 0.4 }}
                        className="absolute -right-2 sm:-right-6 lg:-right-12 -bottom-6 sm:-bottom-12 md:-bottom-20 z-40 scale-[0.45] sm:scale-[0.6] md:scale-75 xl:scale-[0.85] shadow-2xl origin-bottom-right"
                    >
                        <WhatsappPhone />
                    </motion.div>
                </motion.div>
            </div >
        </section >
    );
}
