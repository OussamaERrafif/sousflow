"use client";

import { motion } from "framer-motion";
import { Wifi, Cpu, LineChart, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";

export default function HowItWorks() {
    const t = useTranslations("HowItWorks");

    const steps = [
        {
            icon: <Wifi className="w-6 h-6 text-emerald-600" />,
            title: t('step1Title'),
            desc: t('step1Desc'),
            stats: t('step1Stats'),
            iconBg: "bg-emerald-100",
            hoverBorder: "hover:border-emerald-300",
            stepText: "Step 01",
        },
        {
            icon: <Cpu className="w-6 h-6 text-purple-600" />,
            title: t('step2Title'),
            desc: t('step2Desc'),
            stats: t('step2Stats'),
            iconBg: "bg-purple-100",
            hoverBorder: "hover:border-purple-300",
            stepText: "Step 02",
        },
        {
            icon: <LineChart className="w-6 h-6 text-orange-600" />,
            title: t('step3Title'),
            desc: t('step3Desc'),
            stats: t('step3Stats'),
            iconBg: "bg-orange-100",
            hoverBorder: "hover:border-orange-300",
            stepText: "Step 03",
        },
        {
            icon: <MessageCircle className="w-6 h-6 text-blue-600" />,
            title: t('step4Title'),
            desc: t('step4Desc'),
            stats: t('step4Stats'),
            iconBg: "bg-blue-100",
            hoverBorder: "hover:border-blue-300",
            stepText: "Step 04",
        }
    ];

    return (
        <section id="how-it-works" className="py-16 md:py-24 bg-gradient-to-b from-slate-50 to-indigo-50/20 border-y border-gray-100 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-indigo-100/40 to-purple-100/40 rounded-full blur-3xl opacity-50 pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 w-full">
                <div className="text-center max-w-2xl mx-auto mb-20">
                    <h2 className="text-sm font-bold tracking-[0.2em] text-indigo-600 uppercase mb-4">{t('tagline')}</h2>
                    <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold text-morocco-blue-950 leading-tight">
                        {t('title')}
                    </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8 relative z-10">

                    {/* Connecting arrow path (shows only on desktop) */}
                    <div className="hidden lg:block absolute top-[28px] left-[10%] right-[10%] h-[2px] bg-gray-200 z-0">
                        <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 via-purple-400 to-blue-400 w-full opacity-50" />
                        {/* Animated data packets traveling through the pipeline */}
                        <div className="absolute top-1/2 rtl:right-0 ltr:left-0 w-2 h-2 rounded-full bg-emerald-500 -translate-y-1/2 shadow-[0_0_8px_2px_rgba(16,185,129,0.5)] animate-[dataTravel_4s_linear_infinite]" />
                        <div className="absolute top-1/2 rtl:right-0 ltr:left-0 w-2 h-2 rounded-full bg-purple-500 -translate-y-1/2 shadow-[0_0_8px_2px_rgba(168,85,247,0.5)] animate-[dataTravel_4s_linear_infinite_1.3s]" />
                        <div className="absolute top-1/2 rtl:right-0 ltr:left-0 w-2 h-2 rounded-full bg-blue-500 -translate-y-1/2 shadow-[0_0_8px_2px_rgba(59,130,246,0.5)] animate-[dataTravel_4s_linear_infinite_2.6s]" />
                    </div>

                    {/* Mobile vertical connecting line */}
                    <div className="block lg:hidden absolute top-[10%] bottom-[10%] ltr:left-8 rtl:right-8 w-[2px] bg-gray-200 z-0">
                        <div className="absolute top-0 left-0 h-full bg-gradient-to-b from-emerald-400 via-purple-400 to-blue-400 w-full opacity-50" />
                        <div className="absolute top-0 left-1/2 w-2 h-2 rounded-full bg-emerald-500 -translate-x-1/2 shadow-[0_0_8px_2px_rgba(16,185,129,0.5)] animate-[dataTravelY_4s_linear_infinite]" />
                        <div className="absolute top-0 left-1/2 w-2 h-2 rounded-full bg-purple-500 -translate-x-1/2 shadow-[0_0_8px_2px_rgba(168,85,247,0.5)] animate-[dataTravelY_4s_linear_infinite_1.3s]" />
                    </div>

                    {steps.map((step, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ delay: i * 0.15, duration: 0.5 }}
                            className={`bg-white rounded-2xl p-5 sm:p-6 shadow-md border-2 border-transparent transition-all duration-300 relative z-10 flex flex-col h-full group hover:-translate-y-2 hover:shadow-xl ${step.hoverBorder} ltr:ml-8 sm:ltr:ml-12 lg:ltr:ml-0 rtl:mr-8 sm:rtl:mr-12 lg:rtl:mr-0`}
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${step.iconBg} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm`}>
                                    {step.icon}
                                </div>
                                <span className="text-[11px] font-extrabold text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100 tracking-wider">
                                    {step.stepText}
                                </span>
                            </div>

                            <h4 className="text-xl font-bold text-morocco-blue-950 mb-3">{step.title}</h4>
                            <p className="text-gray-500 leading-relaxed text-sm flex-1 mb-6 font-medium">
                                {step.desc}
                            </p>

                            <div className="pt-4 border-t border-gray-50 mt-auto">
                                <p className="text-[13px] font-bold text-slate-700 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_1px_rgba(99,102,241,0.4)]"></span>
                                    {step.stats}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        [dir="rtl"] .animate-\\[dataTravel_4s_linear_infinite\\] {
            animation-name: dataTravelRTL !important;
        }
        [dir="rtl"] .animate-\\[dataTravel_4s_linear_infinite_1\\.3s\\] {
            animation-name: dataTravelRTL !important;
        }
        [dir="rtl"] .animate-\\[dataTravel_4s_linear_infinite_2\\.6s\\] {
            animation-name: dataTravelRTL !important;
        }

        @keyframes dataTravel {
          0% { left: 0%; opacity: 0; transform: scale(0.5) translateY(-50%); }
          10% { opacity: 1; transform: scale(1) translateY(-50%); }
          90% { opacity: 1; transform: scale(1) translateY(-50%); }
          100% { left: 100%; opacity: 0; transform: scale(0.5) translateY(-50%); }
        }
        @keyframes dataTravelRTL {
          0% { right: 0%; opacity: 0; transform: scale(0.5) translateY(-50%); }
          10% { opacity: 1; transform: scale(1) translateY(-50%); }
          90% { opacity: 1; transform: scale(1) translateY(-50%); }
          100% { right: 100%; opacity: 0; transform: scale(0.5) translateY(-50%); }
        }
        @keyframes dataTravelY {
          0% { top: 0%; opacity: 0; transform: scale(0.5) translateX(-50%); }
          10% { opacity: 1; transform: scale(1) translateX(-50%); }
          90% { opacity: 1; transform: scale(1) translateX(-50%); }
          100% { top: 100%; opacity: 0; transform: scale(0.5) translateX(-50%); }
        }
      `}} />
        </section>
    );
}
