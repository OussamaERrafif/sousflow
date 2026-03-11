"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import StatusBanner from "@/components/StatusBanner";
import StatsRow from "@/components/StatsRow";
import ZoneGrid from "@/components/ZoneGrid";
import HistoricalData from "@/components/HistoricalData";
import AlertPanel from "@/components/AlertPanel";

export default function Dashboard() {
  const [activePage, setActivePage] = useState("dashboard");

  return (
    <div className="flex w-full min-h-screen bg-[#F5F0E8]">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <main className="flex-1 mr-0 md:mr-60 mb-16 md:mb-0 p-4 md:p-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          <StatusBanner status="warning" />
          <StatsRow />
          <ZoneGrid />
          <HistoricalData />
          <AlertPanel />
        </div>
      </main>
    </div>
  );
}
