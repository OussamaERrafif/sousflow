import type { Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ThemeProvider } from '@/components/ThemeProvider';
import { HtmlLangSetter } from '@/components/HtmlLangSetter';
import "./globals.css";

export const metadata: Metadata = {
  title: "SousFlow - Smart Irrigation",
  description: "Smart Irrigation Dashboard",
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
    <NextIntlClientProvider messages={messages}>
      <HtmlLangSetter locale={locale} />
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
