"use client";
import { useState } from "react";

export default function StatusBanner() {
  const status = "warning"; // "good" | "warning" | "critical"

  const config = {
    good: {
      bg: "from-emerald-500 to-emerald-600",
      icon: "✅",
      textAr: "كل شيء بخير",
      textFr: "Tout va bien",
      sub: "الشبكة تعمل بشكل طبيعي",
      glow: "shadow-emerald-300/50",
    },
    warning: {
      bg: "from-amber-500 to-orange-500",
      icon: "⚠️",
      textAr: "انتبه!",
      textFr: "Attention !",
      sub: "يوجد انسداد في القطاع 3",
      glow: "shadow-amber-300/50",
    },
    critical: {
      bg: "from-red-500 to-red-600",
      icon: "🚨",
      textAr: "خطر! تسرب مياه",
      textFr: "FUITE DÉTECTÉE",
      sub: "الخط 3 — تراجع حاد في الضغط",
      glow: "shadow-red-300/50",
    },
  };

  const c = config[status];

  return (
    <div
      className={`w-full rounded-3xl bg-gradient-to-r ${c.bg} p-6 mb-6 shadow-2xl ${c.glow} relative overflow-hidden`}
    >
      {/* Background decoration */}
      <div className="absolute right-0 top-0 w-48 h-48 rounded-full bg-white/5 -translate-y-16 translate-x-16" />
      <div className="absolute right-20 bottom-0 w-24 h-24 rounded-full bg-white/5 translate-y-8" />

      <div className="relative flex items-center gap-5">
        <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-4xl flex-shrink-0 shadow-lg">
          {c.icon}
        </div>
        <div className="flex-1">
          <p className="text-white/70 text-sm font-medium uppercase tracking-widest mb-0.5">
            حالة الشبكة · État du réseau
          </p>
          <h2 className="text-white font-black text-3xl leading-tight">
            {c.textAr}
          </h2>
          <p className="text-white/80 font-semibold text-base mt-1">
            {c.textFr} — {c.sub}
          </p>
        </div>

        {status !== "good" && (
          <button className="bg-white text-[#2C1810] font-black text-sm px-6 py-3 rounded-2xl shadow-lg hover:scale-105 transition-transform flex-shrink-0">
            إصلاح الآن
            <br />
            <span className="font-normal text-xs text-gray-500">
              Réparer
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
