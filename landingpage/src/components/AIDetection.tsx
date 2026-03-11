"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { Sprout } from "lucide-react";

const WhatsappSnippet = ({ messages }: { messages: { isSelf: boolean; text: string; time: string }[] }) => {
    const t = useTranslations("Whatsapp");
    return (
        <div className="w-full h-full bg-[#111B21] relative overflow-hidden flex flex-col z-0" style={{ backgroundImage: `url('https://transparenttextures.com/patterns/cubes.png')` }}>
            <div className="absolute inset-0 bg-[#0B141A]/90 mix-blend-overlay pointer-events-none"></div>

            {/* WhatsApp Header Mockup */}
            <div className="bg-[#202C33] px-4 py-3 flex items-center gap-3 relative z-10 shadow-md border-b border-[#2A3942]">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-inner">
                    <Sprout size={16} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[#E9EDEF] text-[13px] font-semibold leading-tight">{t('smartAssistant')}</span>
                    <span className="text-[#8696A0] text-[11px] leading-tight">{t('online')}</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center p-4 gap-3 relative z-10">
                {messages.map((msg, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.2 }}
                        className={`${msg.isSelf ? 'self-end bg-[#005C4B] rounded-tr-sm' : 'self-start bg-[#202C33] rounded-tl-sm'} rounded-xl px-3 py-2 max-w-[90%] shadow-sm relative z-10 w-fit`}
                    >
                        <p className="text-[13.5px] text-[#E9EDEF] leading-snug whitespace-pre-wrap text-left" dir="auto">{msg.text}</p>
                        <span className="text-[10px] text-[#8696A0] float-right mt-1.5 ml-3">{msg.time}</span>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default function AIDetection() {
    const t = useTranslations("WhatsAppSection");

    const cards = [
        {
            title: t('card1Title'),
            desc: t('card1Desc'),
            className: "md:col-span-2 md:row-span-1",
            messages: [
                { isSelf: false, text: t('card1Msg1'), time: "14:02" },
                { isSelf: true, text: t('card1Msg2'), time: "14:05" },
                { isSelf: false, text: t('card1Msg3'), time: "14:05" }
            ]
        },
        {
            title: t('card2Title'),
            desc: t('card2Desc'),
            className: "md:col-span-1 md:row-span-2",
            messages: [
                { isSelf: false, text: t('card2Msg1'), time: "07:00" },
                { isSelf: true, text: t('card2Msg2'), time: "07:45" }
            ]
        },
        {
            title: t('card3Title'),
            desc: t('card3Desc'),
            className: "md:col-span-1 md:row-span-1",
            messages: [
                { isSelf: true, text: t('card3Msg1'), time: "10:15" },
                { isSelf: false, text: t('card3Msg2'), time: "10:15" }
            ]
        },
        {
            title: t('card4Title'),
            desc: t('card4Desc'),
            className: "md:col-span-1 md:row-span-1",
            messages: [
                { isSelf: true, text: t('card4Msg1'), time: "16:20" },
                { isSelf: false, text: t('card4Msg2'), time: "16:21" }
            ]
        }
    ];

    return (
        <section id="ai-detection" className="py-16 md:py-24 bg-gray-50 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
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
                    {cards.map((card, i) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ delay: i * 0.15, duration: 0.5 }}
                            key={i}
                            className={`group border border-gray-200 rounded-3xl p-6 md:p-8 hover:border-copper-200 hover:shadow-xl hover:shadow-copper-100/50 transition-all duration-300 bg-white flex flex-col ${card.className}`}
                        >
                            <div className="mb-8 flex-1 min-h-[160px] relative rounded-2xl overflow-hidden shadow-inner border border-gray-100 bg-[#111B21]">
                                <WhatsappSnippet messages={card.messages} />

                                {/* Overlay gradient to fade out bottom overlapping text if too long */}
                                <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#111B21] to-transparent pointer-events-none opacity-40"></div>
                            </div>

                            <div className="mt-auto">
                                <h4 className="text-xl font-bold text-gray-900 mb-3">{card.title}</h4>
                                <p className="text-gray-500 leading-relaxed text-sm">{card.desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
