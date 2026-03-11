"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export default function FAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);
    const t = useTranslations("FAQ");

    const faqs = [
        {
            q: t('q1'),
            a: t('a1')
        },
        {
            q: t('q2'),
            a: t('a2')
        },
        {
            q: t('q3'),
            a: t('a3')
        },
        {
            q: t('q4'),
            a: t('a4')
        },
        {
            q: t('q5'),
            a: t('a5')
        }
    ];

    return (
        <section className="py-16 md:py-24 bg-gray-50">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
                <div className="text-center mb-16">
                    <h2 className="text-sm font-bold tracking-[0.2em] text-copper-600 uppercase mb-4">{t('tagline')}</h2>
                    <h3 className="text-3xl md:text-4xl font-bold text-morocco-blue-950">
                        {t('title')}
                    </h3>
                </div>

                <div className="space-y-4">
                    {faqs.map((faq, i) => (
                        <div
                            key={i}
                            className="bg-white border text-left border-gray-200 rounded-2xl overflow-hidden hover:border-copper-300 transition-colors"
                        >
                            <button
                                className="w-full px-4 sm:px-6 py-5 sm:py-6 text-left flex justify-between items-center gap-4 focus:outline-none"
                                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                            >
                                <span className={cn("font-bold text-base sm:text-lg", openIndex === i ? "text-copper-700" : "text-morocco-blue-950")}>
                                    {faq.q}
                                </span>
                                <div className={cn("shrink-0 p-1 rounded-full transition-colors", openIndex === i ? "bg-copper-100 text-copper-700" : "bg-gray-100 text-gray-500")}>
                                    {openIndex === i ? <Minus size={18} /> : <Plus size={18} />}
                                </div>
                            </button>

                            <AnimatePresence>
                                {openIndex === i && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-6 pb-6 text-gray-600 leading-relaxed pt-0 text-left" dir="auto">
                                            {faq.a}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
