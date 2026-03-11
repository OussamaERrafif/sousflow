"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

import { useTranslations } from "next-intl";

export default function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const t = useTranslations("Navbar");

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <nav
            className={cn(
                "fixed top-0 left-0 w-full z-50 transition-all duration-300 px-6 py-4",
                isScrolled ? "glass shadow-sm py-3" : "bg-transparent"
            )}
        >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="soussflow logo" className="h-8 w-auto" />
                    <span className={cn("font-bold text-xl tracking-tight", isScrolled ? "text-morocco-blue-950" : "text-morocco-blue-900")}>
                        soussflow
                    </span>
                </div>

                <div className="hidden md:flex flex-1 items-center justify-center gap-8 text-sm font-medium text-foreground/80">
                    <a href="#" className="hover:text-copper-600 transition-colors">{t('home')}</a>
                    <a href="#product" className="hover:text-copper-600 transition-colors">{t('product')}</a>
                    <a href="#how-it-works" className="hover:text-copper-600 transition-colors">{t('howItWorks')}</a>
                    <a href="#pricing" className="hover:text-copper-600 transition-colors">{t('pricing')}</a>
                    <a href="#case-studies" className="hover:text-copper-600 transition-colors">{t('caseStudies')}</a>
                    <a href="#about" className="hover:text-copper-600 transition-colors">{t('about')}</a>
                </div>

                <div className="hidden md:flex items-center">
                    <button className="bg-copper-600 hover:bg-copper-700 text-white px-6 py-2.5 rounded-full font-medium transition-all shadow-lg shadow-copper-500/25 hover:shadow-copper-500/40 hover:-translate-y-0.5">
                        {t('getStarted')}
                    </button>
                </div>

                <button
                    className="md:hidden p-2 text-foreground"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="absolute top-full left-0 w-full bg-white shadow-xl flex flex-col p-6 gap-4 md:hidden border-t">
                    <a href="#" className="font-medium text-lg" onClick={() => setMobileMenuOpen(false)}>{t('home')}</a>
                    <a href="#product" className="font-medium text-lg" onClick={() => setMobileMenuOpen(false)}>{t('product')}</a>
                    <a href="#how-it-works" className="font-medium text-lg" onClick={() => setMobileMenuOpen(false)}>{t('howItWorks')}</a>
                    <a href="#pricing" className="font-medium text-lg" onClick={() => setMobileMenuOpen(false)}>{t('pricing')}</a>
                    <a href="#case-studies" className="font-medium text-lg" onClick={() => setMobileMenuOpen(false)}>{t('caseStudies')}</a>
                    <a href="#about" className="font-medium text-lg" onClick={() => setMobileMenuOpen(false)}>{t('about')}</a>
                    <button className="bg-copper-600 text-white px-5 py-3 rounded-full font-medium mt-2">
                        {t('getStarted')}
                    </button>
                </div>
            )}
        </nav>
    );
}
