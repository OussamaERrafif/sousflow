import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ReduxProvider } from '@/lib/store/ReduxProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800", "900"],
  variable: "--font-tajawal",
});

export const metadata: Metadata = {
  title: "SousFlow - نظام الري الذكي",
  description: "Smart Irrigation Dashboard",
};

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body className={`${tajawal.variable} font-sans antialiased bg-[#F5F0E8] dark:bg-zinc-900 text-[#5A4A3A] dark:text-zinc-100 transition-colors`}>
        <NextIntlClientProvider messages={messages}>
          <ReduxProvider>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </ReduxProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
