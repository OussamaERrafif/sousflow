"use client";

import { Facebook, Twitter, Linkedin, Instagram, ArrowRight, Globe, Menu, X } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export default function Footer() {
    const [lang, setLang] = useState("FR");
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const t = useTranslations("Footer");
    const tNav = useTranslations("Navbar");

    const footerLinks = {
        product: [
            { label: t('p1'), href: "#product" },
            { label: t('p2'), href: "#features" },
            { label: t('p3'), href: "#how-it-works" },
            { label: t('p4'), href: "#pricing" },
        ],
        company: [
            { label: t('c1'), href: "#about" },
            { label: t('c2'), href: "#case-studies" },
            { label: t('c3'), href: "#faq" },
            { label: t('c4'), href: "#contact" },
        ],
        resources: [
            { label: tNav('features'), href: "#features" },
            { label: tNav('howItWorks'), href: "#how-it-works" },
            { label: tNav('pricing'), href: "#pricing" },
            { label: tNav('faq'), href: "#faq" },
        ],
    };

    return (
        <footer className="bg-morocco-blue-950 text-white pt-16 md:pt-24 pb-8 md:pb-12 border-t border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-copper-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
                {/* Mobile Burger Menu Button */}
                <div className="md:hidden mb-6">
                    <button 
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="flex items-center gap-2 text-white font-medium"
                    >
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        <span>{tNav('product')} & More</span>
                    </button>
                </div>

                {/* Mobile Expanded Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden bg-white/5 rounded-xl p-4 mb-6 space-y-4">
                        <div>
                            <h4 className="font-bold text-lg mb-3 text-copper-400">{t('product')}</h4>
                            <ul className="space-y-2">
                                {footerLinks.product.map((link, i) => (
                                    <li key={i}><a href={link.href} className="text-blue-100/70 hover:text-copper-400 transition-colors">{link.label}</a></li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-lg mb-3 text-copper-400">{t('company')}</h4>
                            <ul className="space-y-2">
                                {footerLinks.company.map((link, i) => (
                                    <li key={i}><a href={link.href} className="text-blue-100/70 hover:text-copper-400 transition-colors">{link.label}</a></li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-lg mb-3 text-copper-400">{tNav('howItWorks')}</h4>
                            <ul className="space-y-2">
                                {footerLinks.resources.map((link, i) => (
                                    <li key={i}><a href={link.href} className="text-blue-100/70 hover:text-copper-400 transition-colors">{link.label}</a></li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-8 mb-12 md:mb-16">

                    <div className="col-span-2 lg:col-span-4">
                        <div className="flex items-center gap-2 mb-6">
                            <img src="/logo.png" alt="soussflow logo" className="h-8 w-auto brightness-0 invert" />
                            <span className="font-bold text-2xl tracking-tight">
                                soussflow
                            </span>
                        </div>
                        <p className="text-blue-100/70 leading-relaxed mb-8 max-w-sm">
                            {t('tagline')}
                        </p>
                        <div className="flex gap-4">
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-copper-500 hover:text-white transition-colors duration-300">
                                <Twitter size={18} />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-copper-500 hover:text-white transition-colors duration-300">
                                <Linkedin size={18} />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-copper-500 hover:text-white transition-colors duration-300">
                                <Facebook size={18} />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-copper-500 hover:text-white transition-colors duration-300">
                                <Instagram size={18} />
                            </a>
                        </div>
                    </div>

                    <div className="col-span-1 lg:col-span-2">
                        <h4 className="font-bold text-lg mb-6">{t('product')}</h4>
                        <ul className="space-y-4">
                            {footerLinks.product.map((link, i) => (
                                <li key={i}><a href={link.href} className="text-blue-100/70 hover:text-copper-400 transition-colors">{link.label}</a></li>
                            ))}
                        </ul>
                    </div>

                    <div className="col-span-1 lg:col-span-2">
                        <h4 className="font-bold text-lg mb-6">{t('company')}</h4>
                        <ul className="space-y-4">
                            {footerLinks.company.map((link, i) => (
                                <li key={i}><a href={link.href} className="text-blue-100/70 hover:text-copper-400 transition-colors">{link.label}</a></li>
                            ))}
                        </ul>
                    </div>

                    <div className="hidden md:block col-span-1 lg:col-span-2">
                        <h4 className="font-bold text-lg mb-6">{tNav('howItWorks')}</h4>
                        <ul className="space-y-4">
                            {footerLinks.resources.map((link, i) => (
                                <li key={i}><a href={link.href} className="text-blue-100/70 hover:text-copper-400 transition-colors">{link.label}</a></li>
                            ))}
                        </ul>
                    </div>

                    <div className="col-span-2 lg:col-span-4 lg:pl-8 border-l-0 lg:border-l border-white/10 pt-6 lg:pt-0 border-t lg:border-t-0">
                        <h4 className="font-bold text-lg mb-4">{t('newsletterTitle')}</h4>
                        <p className="text-blue-100/70 text-sm mb-6">
                            {t('newsletterDesc')}
                        </p>
                        <form className="relative" onSubmit={(e) => e.preventDefault()}>
                            <input
                                type="email"
                                placeholder={t('emailPlaceholder')}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-4 pr-12 text-white placeholder-blue-100/40 focus:outline-none focus:border-copper-500 focus:bg-white/10 transition-all font-light"
                            />
                            <button
                                type="button"
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-copper-500 flex items-center justify-center hover:bg-copper-400 transition-colors"
                            >
                                <ArrowRight size={16} />
                            </button>
                        </form>
                    </div>

                </div>

                <div className="pt-6 md:pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-6 text-white/50 text-sm font-medium">
                        <span>© {new Date().getFullYear()} soussflow.</span>
                        <a href="#" className="hover:text-white transition-colors">{t('terms')}</a>
                        <a href="#" className="hover:text-white transition-colors">{t('privacy')}</a>
                    </div>

                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-1 py-1 shadow-sm relative">
                        <Globe size={16} className="text-white/40 ml-2" />
                        <div className="flex bg-transparent rounded-full p-0.5 ml-1">
                            <button
                                onClick={() => setLang("FR")}
                                className={cn("px-3 py-1 rounded-full text-xs font-bold transition-all", lang === "FR" ? "bg-white text-morocco-blue-950 shadow-sm" : "text-white/60 hover:text-white")}
                            >
                                FR
                            </button>
                            <button
                                onClick={() => setLang("عربي")}
                                className={cn("px-3 py-1 rounded-full text-xs font-bold transition-all font-sans", lang === "عربي" ? "bg-white text-morocco-blue-950 shadow-sm" : "text-white/60 hover:text-white")}
                            >
                                عربي
                            </button>
                            <button
                                onClick={() => setLang("Darija")}
                                className={cn("px-3 py-1 rounded-full text-xs font-bold transition-all", lang === "Darija" ? "bg-white text-morocco-blue-950 shadow-sm" : "text-white/60 hover:text-white")}
                            >
                                Darija
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
