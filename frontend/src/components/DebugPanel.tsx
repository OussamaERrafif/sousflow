"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppSelector } from "@/lib/store/hooks";
import { isDebugMode, setDebugMode } from "@/lib/debug";
import {
  Bug,
  X,
  ChevronDown,
  ChevronRight,
  Wifi,
  WifiOff,
  Activity,
  Database,
  Server,
  Trash2,
  Copy,
  Minimize2,
} from "lucide-react";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

interface LogEntry {
  id: number;
  timestamp: string;
  type: "api" | "sse" | "redux" | "error" | "info";
  message: string;
  data?: unknown;
}

let logIdCounter = 0;
const MAX_LOGS = 200;

// Global log store so it persists across re-renders
let globalLogs: LogEntry[] = [];
let logListeners: Array<() => void> = [];

function addLog(type: LogEntry["type"], message: string, data?: unknown) {
  const entry: LogEntry = {
    id: ++logIdCounter,
    timestamp: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    type,
    message,
    data,
  };
  globalLogs = [entry, ...globalLogs].slice(0, MAX_LOGS);
  logListeners.forEach((fn) => fn());
}

// Intercept fetch to log API calls
if (typeof window !== "undefined") {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "";
    const method = (args[1]?.method || "GET").toUpperCase();
    const isApi = url.includes("/api/") || url.includes("localhost:8000");

    if (isApi && isDebugMode()) {
      const start = performance.now();
      try {
        const response = await originalFetch.apply(this, args);
        const duration = Math.round(performance.now() - start);
        const statusColor = response.ok ? "ok" : "err";
        addLog("api", `${method} ${url.replace(BASE_URL, "")} → ${response.status} (${duration}ms)`, { status: response.status, statusColor, duration });
        return response;
      } catch (err) {
        const duration = Math.round(performance.now() - start);
        addLog("error", `${method} ${url.replace(BASE_URL, "")} FAILED (${duration}ms)`, { error: String(err) });
        throw err;
      }
    }
    return originalFetch.apply(this, args);
  };
}

function useLogStore() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    logListeners.push(listener);
    return () => {
      logListeners = logListeners.filter((l) => l !== listener);
    };
  }, []);
  return globalLogs;
}

// Type badge colors
const TYPE_COLORS: Record<string, string> = {
  api: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  sse: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  redux: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
  info: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

function LogBadge({ type }: { type: string }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TYPE_COLORS[type] || TYPE_COLORS.info}`}>
      {type.toUpperCase()}
    </span>
  );
}

interface BackendDebugState {
  debug_mode: boolean;
  logs: Array<{ timestamp: string; level: string; message: string; module: string }>;
}

export default function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<"logs" | "state" | "sse" | "backend">("logs");
  const [debugActive, setDebugActive] = useState(false);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [backendDebug, setBackendDebug] = useState<BackendDebugState>({ debug_mode: false, logs: [] });
  const [stateSection, setStateSection] = useState<"auth" | "iot" | "api">("iot");
  const [filter, setFilter] = useState<"all" | "api" | "sse" | "error">("all");
  const logs = useLogStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redux state
  const auth = useAppSelector((s) => s.auth);
  const iot = useAppSelector((s) => s.iot);

  useEffect(() => {
    setDebugActive(isDebugMode());
  }, []);

  // Poll backend debug logs when backend tab is active
  useEffect(() => {
    if (open && activeTab === "backend" && debugActive) {
      const fetchBackendDebug = async () => {
        try {
          const [statusRes, logsRes] = await Promise.all([
            fetch(`${BASE_URL}/api/debug/status`),
            fetch(`${BASE_URL}/api/debug/logs?max_lines=50`),
          ]);
          const status = await statusRes.json();
          const logsData = await logsRes.json();
          setBackendDebug({ debug_mode: status.debug_mode, logs: logsData.logs || [] });
        } catch {
          // backend unreachable
        }
      };
      fetchBackendDebug();
      pollRef.current = setInterval(fetchBackendDebug, 5000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [open, activeTab, debugActive]);

  const handleToggleDebug = useCallback(() => {
    const next = !debugActive;
    setDebugMode(next);
    setDebugActive(next);
    addLog("info", `Debug mode ${next ? "enabled" : "disabled"}`);
  }, [debugActive]);

  const handleToggleBackendDebug = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/debug/toggle`, { method: "POST" });
      const data = await res.json();
      setBackendDebug((prev) => ({ ...prev, debug_mode: data.debug_mode }));
      addLog("info", `Backend debug ${data.debug_mode ? "enabled" : "disabled"}`);
    } catch {
      addLog("error", "Failed to toggle backend debug mode");
    }
  }, []);

  const clearLogs = useCallback(() => {
    globalLogs = [];
    logListeners.forEach((fn) => fn());
  }, []);

  const copyLogs = useCallback(() => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.type}] ${l.message}${l.data ? " " + JSON.stringify(l.data) : ""}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    addLog("info", "Logs copied to clipboard");
  }, [logs]);

  const filteredLogs = filter === "all" ? logs : logs.filter((l) => l.type === filter);

  // SSE data summary
  const sseData = {
    connected: iot.connected,
    lastUpdate: iot.lastUpdate,
    zonesCount: iot.zones?.length || 0,
    simulatorRunning: iot.simulatorRunning,
    environment: iot.environment,
    infrastructure: iot.infrastructure,
  };

  // Log SSE updates
  const prevUpdate = useRef(iot.lastUpdate);
  useEffect(() => {
    if (debugActive && iot.lastUpdate && iot.lastUpdate !== prevUpdate.current) {
      addLog("sse", `Update: ${iot.zones?.length || 0} zones, sim=${iot.simulatorRunning ? "on" : "off"}`, {
        timestamp: iot.lastUpdate,
        zones: iot.zones?.map((z) => ({ id: z.zone_id, name: z.zone_name, moisture: z.avg_moisture_pct })),
      });
      prevUpdate.current = iot.lastUpdate;
    }
  }, [iot.lastUpdate, iot.zones, iot.simulatorRunning, debugActive]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 right-4 z-[9999] flex items-center gap-2 bg-zinc-900 text-zinc-300 hover:text-white px-3 py-2 rounded-xl shadow-2xl border border-zinc-700 hover:border-zinc-500 transition-all text-sm font-bold"
        title="Open Debug Panel"
      >
        <Bug className="w-4 h-4" />
        <span className="hidden md:inline">Debug</span>
        {iot.connected && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
      </button>
    );
  }

  if (minimized) {
    return (
      <div className="fixed top-4 right-4 z-[9999] flex items-center gap-2 bg-zinc-900 text-zinc-300 rounded-xl shadow-2xl border border-zinc-700 text-sm font-bold">
        <button onClick={() => setMinimized(false)} className="flex items-center gap-2 px-3 py-2 hover:text-white transition-colors">
          <Bug className="w-4 h-4" />
          Debug
          {iot.connected && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
        </button>
        <button onClick={() => setOpen(false)} className="px-2 py-2 hover:text-red-400 border-l border-zinc-700">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-[9999] w-[calc(100vw-2rem)] md:w-[520px] max-h-[70vh] bg-zinc-950 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-zinc-200 text-sm">Debug Panel</span>
          <span className={`w-2 h-2 rounded-full ${debugActive ? "bg-amber-500 animate-pulse" : "bg-zinc-600"}`} />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleToggleDebug}
            className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${debugActive ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"}`}
          >
            {debugActive ? "ON" : "OFF"}
          </button>
          <button onClick={() => setMinimized(true)} className="p-1 text-zinc-500 hover:text-zinc-300">
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setOpen(false)} className="p-1 text-zinc-500 hover:text-red-400">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 bg-zinc-900/50">
        {([
          { id: "logs", icon: Activity, label: "Logs" },
          { id: "state", icon: Database, label: "State" },
          { id: "sse", icon: Wifi, label: "SSE" },
          { id: "backend", icon: Server, label: "Backend" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-bold transition-colors ${
              activeTab === tab.id ? "text-amber-400 border-b-2 border-amber-400 bg-amber-500/5" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0" style={{ maxHeight: "calc(70vh - 90px)" }}>
        {/* LOGS TAB */}
        {activeTab === "logs" && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-zinc-800 bg-zinc-900/30">
              {(["all", "api", "sse", "error"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${filter === f ? "bg-zinc-700 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
              <div className="flex-1" />
              <button onClick={copyLogs} className="p-1 text-zinc-500 hover:text-zinc-300" title="Copy logs">
                <Copy className="w-3 h-3" />
              </button>
              <button onClick={clearLogs} className="p-1 text-zinc-500 hover:text-red-400" title="Clear logs">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-1">
              {filteredLogs.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-zinc-600">
                  {debugActive ? "Waiting for events..." : "Enable debug mode to capture logs"}
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 px-2 py-1 hover:bg-zinc-900/50 rounded cursor-pointer"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <span className="text-zinc-600 shrink-0 w-16">{log.timestamp}</span>
                    <LogBadge type={log.type} />
                    <div className="flex-1 min-w-0">
                      <span className={`${log.type === "error" ? "text-red-400" : "text-zinc-300"} break-all`}>{log.message}</span>
                      {expandedLog === log.id && log.data != null && (
                        <pre className="mt-1 p-2 bg-zinc-900 rounded text-[10px] text-zinc-400 overflow-auto max-h-40 border border-zinc-800">
                          {JSON.stringify(log.data, null, 2) as string}
                        </pre>
                      )}
                    </div>
                    {log.data != null && (
                      <span className="shrink-0 text-zinc-600">
                        {expandedLog === log.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* STATE TAB */}
        {activeTab === "state" && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-zinc-800 bg-zinc-900/30">
              {(["iot", "auth", "api"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStateSection(s)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${stateSection === s ? "bg-zinc-700 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto p-2">
              {stateSection === "iot" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    {iot.connected ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
                    <span className={`font-bold ${iot.connected ? "text-emerald-400" : "text-red-400"}`}>
                      {iot.connected ? "Connected" : "Disconnected"}
                    </span>
                    {iot.lastUpdate && (
                      <span className="text-zinc-600 text-[10px]">
                        Last: {new Date(iot.lastUpdate).toLocaleTimeString("en-US", { hour12: false })}
                      </span>
                    )}
                  </div>
                  <StateBlock label="Environment" data={iot.environment} />
                  <StateBlock label="Infrastructure" data={iot.infrastructure} />
                  <StateBlock label={`Zones (${iot.zones?.length || 0})`} data={iot.zones?.map((z) => ({
                    zone: z.zone_name,
                    moisture: `${z.avg_moisture_pct}%`,
                    health: z.health_score,
                    stress: z.stress_class,
                    leaks: z.leak_count,
                    branches: z.branches?.length,
                  }))} />
                  <StateBlock label="Simulator" data={{ running: iot.simulatorRunning }} />
                </div>
              )}
              {stateSection === "auth" && (
                <StateBlock label="Auth State" data={{
                  isAuthenticated: auth.isAuthenticated,
                  role: auth.role,
                  activeFarmId: auth.activeFarmId,
                  farmIds: auth.farmIds,
                  user: auth.user ? { id: auth.user.id, username: auth.user.username } : null,
                }} />
              )}
              {stateSection === "api" && (
                <div className="text-zinc-500 p-4 text-center">
                  API cache state is managed by RTK Query.<br />
                  Check the Logs tab for API request/response details.
                </div>
              )}
            </div>
          </div>
        )}

        {/* SSE TAB */}
        {activeTab === "sse" && (
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
              {sseData.connected ? (
                <Wifi className="w-5 h-5 text-emerald-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-400" />
              )}
              <div>
                <span className={`font-bold ${sseData.connected ? "text-emerald-400" : "text-red-400"}`}>
                  {sseData.connected ? "SSE Connected" : "SSE Disconnected"}
                </span>
                <p className="text-zinc-600 text-[10px]" dir="ltr">{BASE_URL}/api/events</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <MetricCard label="Zones" value={sseData.zonesCount} />
              <MetricCard label="Simulator" value={sseData.simulatorRunning ? "Running" : "Stopped"} color={sseData.simulatorRunning ? "emerald" : "zinc"} />
              <MetricCard label="Last Update" value={sseData.lastUpdate ? new Date(sseData.lastUpdate).toLocaleTimeString("en-US", { hour12: false }) : "—"} />
              <MetricCard label="Env Temp" value={sseData.environment ? `${sseData.environment.air_temperature_c.toFixed(1)}°C` : "—"} />
              <MetricCard label="Humidity" value={sseData.environment ? `${sseData.environment.air_humidity_pct.toFixed(0)}%` : "—"} />
              <MetricCard label="Reservoir" value={sseData.infrastructure ? `${sseData.infrastructure.reservoir_level_pct.toFixed(0)}%` : "—"} />
              <MetricCard label="Pump Flow" value={sseData.infrastructure ? `${sseData.infrastructure.main_pump_flow_lpm.toFixed(1)} L/m` : "—"} />
              <MetricCard label="Pressure" value={sseData.infrastructure ? `${sseData.infrastructure.main_pressure_mpa.toFixed(2)} MPa` : "—"} />
            </div>

            {iot.zones && iot.zones.length > 0 && (
              <div className="space-y-1">
                <span className="text-zinc-500 font-bold text-[10px] uppercase">Live Zone Data</span>
                {iot.zones.map((z) => (
                  <div key={z.zone_id} className="flex items-center gap-2 p-2 bg-zinc-900 rounded-lg border border-zinc-800">
                    <span className={`w-2 h-2 rounded-full ${z.health_score > 70 ? "bg-emerald-500" : z.health_score > 40 ? "bg-amber-500" : "bg-red-500"}`} />
                    <span className="text-zinc-300 font-bold flex-1">{z.zone_name}</span>
                    <span className="text-zinc-500">{z.avg_moisture_pct}%</span>
                    <span className="text-zinc-600">|</span>
                    <span className="text-zinc-500">{z.health_score}hp</span>
                    <span className="text-zinc-600">|</span>
                    <span className={`text-[10px] font-bold ${z.leak_count > 0 ? "text-red-400" : "text-zinc-600"}`}>
                      {z.leak_count > 0 ? `${z.leak_count} leaks` : "ok"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BACKEND TAB */}
        {activeTab === "backend" && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-zinc-400" />
                <div>
                  <span className="font-bold text-zinc-300">Backend Debug Mode</span>
                  <p className="text-zinc-600 text-[10px]" dir="ltr">{BASE_URL}</p>
                </div>
              </div>
              <button
                onClick={handleToggleBackendDebug}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                  backendDebug.debug_mode ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {backendDebug.debug_mode ? "ON" : "OFF"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`${BASE_URL}/dashboard`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center px-3 py-2 bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 font-bold text-[11px] transition-colors"
              >
                Open Admin Dashboard
              </a>
              <a
                href={`${BASE_URL}/docs`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center px-3 py-2 bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 font-bold text-[11px] transition-colors"
              >
                Swagger Docs
              </a>
            </div>

            {backendDebug.debug_mode && backendDebug.logs.length > 0 ? (
              <div className="space-y-1">
                <span className="text-zinc-500 font-bold text-[10px] uppercase">Backend Debug Logs (last 50)</span>
                <div className="max-h-60 overflow-auto space-y-0.5">
                  {backendDebug.logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 px-2 py-1 bg-zinc-900 rounded text-[10px]">
                      <span className="text-zinc-600 shrink-0 w-16">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString("en-US", { hour12: false }) : ""}
                      </span>
                      <span className={`font-bold shrink-0 w-12 ${
                        log.level === "ERROR" ? "text-red-400" : log.level === "WARNING" ? "text-amber-400" : log.level === "DEBUG" ? "text-purple-400" : "text-zinc-500"
                      }`}>
                        {log.level}
                      </span>
                      <span className="text-zinc-400 break-all">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : backendDebug.debug_mode ? (
              <div className="text-zinc-600 text-center py-4">No backend debug logs yet</div>
            ) : (
              <div className="text-zinc-600 text-center py-4">Enable backend debug to see logs</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StateBlock({ label, data }: { label: string; data: unknown }) {
  const [expanded, setExpanded] = useState(false);
  if (!data) return (
    <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800">
      <span className="text-zinc-500 font-bold">{label}: </span>
      <span className="text-zinc-600">null</span>
    </div>
  );

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2 py-1.5 text-left hover:bg-zinc-800/50"
      >
        {expanded ? <ChevronDown className="w-3 h-3 text-zinc-500" /> : <ChevronRight className="w-3 h-3 text-zinc-500" />}
        <span className="text-zinc-400 font-bold">{label}</span>
      </button>
      {expanded && (
        <pre className="px-2 pb-2 text-[10px] text-zinc-500 overflow-auto max-h-40">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function MetricCard({ label, value, color = "zinc" }: { label: string; value: string | number; color?: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400",
    red: "text-red-400",
    amber: "text-amber-400",
    zinc: "text-zinc-300",
  };
  return (
    <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800 text-center">
      <p className="text-zinc-600 text-[10px] font-bold uppercase">{label}</p>
      <p className={`font-bold text-sm ${colorMap[color] || colorMap.zinc}`}>{value}</p>
    </div>
  );
}
