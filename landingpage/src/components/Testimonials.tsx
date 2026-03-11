"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import Image from "next/image";

export default function Testimonials() {
    const t = useTranslations("Testimonials");

    return (
        <section id="case-studies" className="py-20 md:py-32 bg-gray-50 relative">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-copper-200/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">

                <div className="text-center max-w-2xl mx-auto mb-20">
                    <h2 className="text-sm font-bold tracking-[0.2em] text-copper-600 uppercase mb-4">{t('tagline')}</h2>
                    <h3 className="text-2xl sm:text-3xl md:text-5xl font-bold text-morocco-blue-950 leading-tight">
                        {t('title')}
                    </h3>
                </div>

                <div className="grid md:grid-cols-2 gap-8 items-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="rounded-3xl overflow-hidden shadow-2xl relative group aspect-[4/3] md:aspect-auto md:h-[500px]"
                    >
                        <Image
                            src="/Drip-Irrigation-as-the-Most-Efficient-Irrigation-System-Type-1200x565.jpg"
                            alt="Drip Irrigation"
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="rounded-3xl overflow-hidden shadow-2xl relative group aspect-[4/3] md:aspect-auto md:h-[500px]"
                    >
                        <Image
                            src="/greenhouse.jpg"
                            alt="Greenhouse"
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    </motion.div>
                </div>

                {/* Trust Signals added near the bottom of testimonials */}
                <div className="mt-16 md:mt-32 pt-12 md:pt-16 border-t border-gray-200 overflow-hidden relative">
                    <p className="text-center text-sm font-bold text-gray-400 uppercase tracking-widest mb-12">
                        {t('trustText')}
                    </p>

                    {/* Fading edges for the slider */}
                    <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-gray-50 to-transparent z-10 pointer-events-none"></div>
                    <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-gray-50 to-transparent z-10 pointer-events-none"></div>

                    {/* Dual-track marquee for seamless true infinite scroll */}
                    <div className="group flex overflow-hidden w-full" dir="ltr">
                        <div className="flex shrink-0 w-max animate-[marquee_40s_linear_infinite] opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                            {[1, 2, 3, 4, 5, 6].map((set) => (
                                <div key={set} className="flex items-center gap-16 md:gap-24 px-8 md:px-12 shrink-0">
                                    <div className="font-bold text-xl md:text-2xl font-serif text-morocco-blue-900 whitespace-nowrap">Jazari Institute</div>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/uiz.png" alt="UIZ" className="h-12 md:h-16 w-auto object-contain invert shrink-0" />
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/Minstere.svg" alt="Ministère" className="h-12 md:h-16 w-auto object-contain shrink-0" />
                                </div>
                            ))}
                        </div>
                        <div className="flex shrink-0 w-max animate-[marquee_40s_linear_infinite] opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500" aria-hidden="true">
                            {[1, 2, 3, 4, 5, 6].map((set) => (
                                <div key={`clone-${set}`} className="flex items-center gap-16 md:gap-24 px-8 md:px-12 shrink-0">
                                    <div className="font-bold text-xl md:text-2xl font-serif text-morocco-blue-900 whitespace-nowrap">Jazari Institute</div>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/uiz.png" alt="UIZ" className="h-12 md:h-16 w-auto object-contain invert shrink-0" />
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/Minstere.svg" alt="Ministère" className="h-12 md:h-16 w-auto object-contain shrink-0" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes marquee {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-100%); } 
                    }
                    `
                }} />
            </div>
        </section>
    );
}
