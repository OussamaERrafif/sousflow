import type { Metadata } from "next";
import { Tajawal, Inter } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ReduxProvider } from "@/lib/store/ReduxProvider";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800", "900"],
  variable: "--font-tajawal",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SoussFlow - Smart Irrigation Dashboard",
  description: "Optimized irrigation monitoring and crop yield prediction for Morocco.",
};

export default async function LocaleLayout({
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

  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      suppressHydrationWarning
      className={`${tajawal.variable} ${inter.variable}`}
    >
      <body className={`antialiased bg-background text-foreground selection:bg-primary/10 ${locale === 'ar' ? 'font-tajawal' : 'font-sans'}`}>
        <ReduxProvider>
          <NextIntlClientProvider messages={messages} locale={locale}>
            <ThemeProvider>
              <div className="min-h-screen">
                {children}
              </div>
            </ThemeProvider>
          </NextIntlClientProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
