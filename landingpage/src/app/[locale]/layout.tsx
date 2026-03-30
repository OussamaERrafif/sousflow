import type { Metadata } from "next";
import { Tajawal, Inter } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

// Arabic & Latin bilingual — renders Arabic correctly without fallback serif
const tajawal = Tajawal({
    variable: "--font-tajawal",
    subsets: ["arabic", "latin"],
    weight: ["300", "400", "500", "700", "800"],
    display: "swap",
});

// Latin — used for French & English locales
const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
    display: "swap",
});

export const metadata: Metadata = {
    title: "SoussFlow — Prédiction de rendement et gestion intelligente de l'eau",
    description: "SoussFlow uses AI and IoT sensors to help Moroccan farmers predict crop yield and reduce irrigation waste.",
};

export default async function RootLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}>) {
    const { locale } = await params;

    if (!routing.locales.includes(locale as "en" | "fr" | "ar")) {
        notFound();
    }

    const messages = await getMessages();
    const isArabic = locale === "ar";
    const fontVariable = isArabic ? tajawal.variable : inter.variable;
    const fontClass = isArabic ? "font-tajawal" : "font-inter";

    return (
        <html lang={locale} dir={isArabic ? "rtl" : "ltr"}>
            <body className={`${fontVariable} ${fontClass} antialiased`}>
                <NextIntlClientProvider messages={messages}>
                    {children}
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
