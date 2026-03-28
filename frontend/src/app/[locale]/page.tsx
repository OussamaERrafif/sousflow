"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";
import StatusBanner from "@/components/StatusBanner";
import StatsRow from "@/components/StatsRow";
import ZoneGrid from "@/components/ZoneGrid";
import HistoricalData from "@/components/HistoricalData";
import AlertPanel from "@/components/AlertPanel";
import ZonesPage from "@/components/pages/ZonesPage";
import PumpsPage from "@/components/pages/PumpsPage";
import AlertsPage from "@/components/pages/AlertsPage";
import ReportsPage from "@/components/pages/ReportsPage";
import SettingsPage from "@/components/pages/SettingsPage";
import AIAssistancePage from "@/components/pages/AIAssistancePage";
const MapPage = dynamic(() => import("@/components/pages/MapPage"), { ssr: false });
const IoTDevicesPage = dynamic(() => import("@/components/pages/IoTDevicesPage"), { ssr: false });
import DebugPanel from "@/components/DebugPanel";
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { setCredentials, setProfile } from "@/lib/store/slices/authSlice";
import { useSSE } from "@/lib/hooks/useSSE";
import { useGetProfileApiAuthProfileGetQuery } from "@/lib/store/generated/api";
import { isDebugMode, debugLog } from "@/lib/debug";

export default function Dashboard() {
  const [activePage, setActivePage] = useState("dashboard");
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isAuthenticated, role } = useAppSelector((state) => state.auth);
  const { data: profile } = useGetProfileApiAuthProfileGetQuery(undefined, { skip: !isAuthenticated });
  useSSE();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isDebugMode()) {
      debugLog("Dashboard mounted");
    }
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      let token: string | null = null;
      try { token = localStorage.getItem("token"); } catch {}
      if (!token) {
        router.push("/login");
      } else {
        dispatch(setCredentials({ user: { id: "", username: "" }, token }));
      }
    }
  }, [mounted, isAuthenticated, router, dispatch]);

  useEffect(() => {
    if (isAuthenticated && profile && !role) {
      dispatch(setProfile({
        role: profile.role as "superadmin" | "farm_owner" | "farm_employee",
        farmIds: profile.farm_ids || [],
        ownedFarmIds: profile.owned_farm_ids || [],
        activeFarmId: profile.active_farm_id || (profile.farm_ids && profile.farm_ids[0]) || null,
        full_name: profile.full_name,
      }));
      if (isDebugMode()) {
        debugLog("Profile set:", { role: profile.role, farmIds: profile.farm_ids });
      }
    }
  }, [isAuthenticated, profile, role, dispatch]);

  useEffect(() => {
    if (isDebugMode() && mounted) {
      debugLog("Page changed to:", activePage);
    }
  }, [activePage, mounted]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F0E8] dark:bg-zinc-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3D1F0F]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F0E8] dark:bg-zinc-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3D1F0F]"></div>
      </div>
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return (
          <>
            <StatusBanner />
            <StatsRow />
            <ZoneGrid />
            <HistoricalData />
            <AlertPanel />
          </>
        );
      case "zones":
        return <ZonesPage />;
      case "pumps":
        return <PumpsPage />;
      case "map":
        return <MapPage />;
      case "iot_devices":
        return <IoTDevicesPage />;
      case "alerts":
        return <AlertsPage />;
      case "reports":
        return <ReportsPage />;
      case "ai_assistant":
        return <AIAssistancePage />;
      case "settings":
        return <SettingsPage />;
      default:
        return (
          <>
            <StatusBanner />
            <StatsRow />
            <ZoneGrid />
            <HistoricalData />
            <AlertPanel />
          </>
        );
    }
  };

  return (
    <div className="flex w-full min-h-screen bg-[#F5F0E8] dark:bg-zinc-900">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <main className="flex-1 mb-16 md:mb-0 p-4 md:p-8 overflow-x-hidden md:ltr:ml-64 md:rtl:mr-64">
        <div className="max-w-7xl mx-auto">
          {renderPage()}
        </div>
      </main>
      <DebugPanel />
    </div>
  );
}
