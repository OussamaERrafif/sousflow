"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import StatusBanner from "@/components/StatusBanner";
import ZoneGrid from "@/components/ZoneGrid";
import AlertPanel from "@/components/AlertPanel";
import StatsRow from "@/components/StatsRow";

export default function Dashboard() {
  const [activePage, setActivePage] = useState("dashboard");

  return (
    <div className="flex min-h-screen bg-[#F5F0E8] font-['Tajawal',sans-serif]">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      <main className="flex-1 ml-20 md:ml-64 p-4 md:p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm text-[#8B7355] font-medium uppercase tracking-widest">
              نظام الري الذكي
            </p>
            <h1 className="text-3xl font-black text-[#2C1810] mt-1">
              لوحة التحكم
            </h1>
          </div>
          <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-2 shadow-sm border border-[#E8DFD0]">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-semibold text-[#2C1810]">
              الشبكة نشطة
            </span>
          </div>
        </div>

        <StatusBanner />
        <StatsRow />
        <ZoneGrid />
        <AlertPanel />
      </main>
    </div>
  );
}
