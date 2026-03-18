"use client";

import { useEffect } from "react";

export function HtmlLangSetter({ locale }: { locale: string }) {
  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  return null;
}
