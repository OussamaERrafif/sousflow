"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
    useListAlertRulesApiIotAlertsRulesGetQuery,
    useCreateAlertRuleApiIotAlertsRulesPostMutation,
    useDeleteAlertRuleApiIotAlertsRulesRuleIdDeleteMutation,
} from "@/lib/store/generated/api";
import { useAppSelector } from "@/lib/store/hooks";
import { Bell, Plus, Trash2, AlertTriangle, CheckCircle2, Edit, X, AlertOctagon, Info, Wifi } from "lucide-react";

export default function AlertsPage() {
    const t = useTranslations("Sidebar");
    const [isCreating, setIsCreating] = useState(false);
    const [newRule, setNewRule] = useState({
        name: "",
        target_column: "soil_moisture_pct",
        condition: "below" as "above" | "below" | "equals",
        threshold: 40,
        zone_id: null as number | null,
        notify_whatsapp: false,
        phone: "",
    });

    const { data: alertRules, isLoading, refetch } = useListAlertRulesApiIotAlertsRulesGetQuery();
    const [createRule, { isLoading: isCreatingRule }] = useCreateAlertRuleApiIotAlertsRulesPostMutation();
    const [deleteRule] = useDeleteAlertRuleApiIotAlertsRulesRuleIdDeleteMutation();

    // Derive live alerts from SSE
    const { readings: sseReadings, connected, lastUpdate } = useAppSelector((state) => state.iot);
    const hasLiveData = connected && sseReadings.length > 0;

    type LiveAlert = { id: string; type: "critical" | "warning" | "info"; title: string; message: string; time: string };
    const liveAlerts: LiveAlert[] = [];

    if (hasLiveData) {
        sseReadings.forEach((r) => {
            const zoneLabel = `Zone ${r.zone_id}`;
            if (r.is_anomaly) {
                liveAlerts.push({
                    id: `anomaly-${r.zone_id}`,
                    type: "critical",
                    title: `Sensor Anomaly — ${zoneLabel}`,
                    message: "Abnormal sensor reading detected. Check hardware.",
                    time: lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "just now",
                });
            } else if ((r.soil_moisture_pct ?? 100) < 35) {
                liveAlerts.push({
                    id: `dry-${r.zone_id}`,
                    type: "critical",
                    title: `Critically Dry — ${zoneLabel}`,
                    message: `Soil moisture ${r.soil_moisture_pct?.toFixed(0)}% — immediate irrigation needed.`,
                    time: lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "just now",
                });
            } else if ((r.soil_moisture_pct ?? 100) < 45) {
                liveAlerts.push({
                    id: `low-${r.zone_id}`,
                    type: "warning",
                    title: `Low Moisture — ${zoneLabel}`,
                    message: `Soil moisture ${r.soil_moisture_pct?.toFixed(0)}% is below optimal (55%).`,
                    time: lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "just now",
                });
            } else if (r.irrigation_needed === 1) {
                liveAlerts.push({
                    id: `irr-${r.zone_id}`,
                    type: "info",
                    title: `Irrigation Active — ${zoneLabel}`,
                    message: `Automated irrigation running. Moisture: ${r.soil_moisture_pct?.toFixed(0)}%.`,
                    time: lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "just now",
                });
            }
        });
    }

    const handleCreateRule = async () => {
        if (!newRule.name) return;
        try {
            await createRule({
                alertRuleCreate: {
                    name: newRule.name,
                    target_column: newRule.target_column,
                    condition: newRule.condition,
                    threshold: newRule.threshold,
                    zone_id: newRule.zone_id,
                    notify_whatsapp: newRule.notify_whatsapp,
                    phone: newRule.phone || undefined,
                },
            }).unwrap();
            setIsCreating(false);
            setNewRule({ name: "", target_column: "soil_moisture_pct", condition: "below", threshold: 40, zone_id: null, notify_whatsapp: false, phone: "" });
            refetch();
        } catch (e) {
            console.error("Failed to create rule:", e);
        }
    };

    const handleDeleteRule = async (ruleId: string) => {
        try {
            await deleteRule({ ruleId }).unwrap();
            refetch();
        } catch (e) {
            console.error("Failed to delete rule:", e);
        }
    };

    const alertTypeStyle = (type: "critical" | "warning" | "info") => ({
        critical: { bg: "bg-red-50 border-red-200", icon: <AlertOctagon className="w-5 h-5 text-red-500" />, badge: "bg-red-100 text-red-700" },
        warning: { bg: "bg-amber-50 border-amber-200", icon: <AlertTriangle className="w-5 h-5 text-amber-500" />, badge: "bg-amber-100 text-amber-700" },
        info: { bg: "bg-sky-50 border-sky-200", icon: <Info className="w-5 h-5 text-sky-500" />, badge: "bg-sky-100 text-sky-700" },
    })[type];

    return (
        <div className="w-full">
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-zinc-800 tracking-tight">{t("nav_alerts")}</h1>
                    <p className="text-zinc-500 font-bold mt-1">Alert rules and live notifications</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 bg-[#3D1F0F] text-white hover:bg-[#4A2C1A] px-5 py-2.5 rounded-xl font-bold transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Create Rule
                </button>
            </div>

            {/* Create Rule Form */}
            {isCreating && (
                <div className="mb-6 p-5 rounded-2xl bg-white border border-[#C17A3A] shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-black text-zinc-800">New Alert Rule</h3>
                        <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-zinc-100 rounded-lg">
                            <X className="w-5 h-5 text-zinc-400" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-zinc-600 mb-1">Rule Name</label>
                            <input
                                type="text"
                                value={newRule.name}
                                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:border-[#C17A3A] focus:outline-none font-bold"
                                placeholder="e.g., Low Moisture Alert"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-zinc-600 mb-1">Target Sensor</label>
                            <select
                                value={newRule.target_column}
                                onChange={(e) => setNewRule({ ...newRule, target_column: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:border-[#C17A3A] focus:outline-none font-bold"
                            >
                                <option value="soil_moisture_pct">Soil Moisture</option>
                                <option value="zone_pressure_mpa">Zone Pressure</option>
                                <option value="zone_flow_lpm">Zone Flow</option>
                                <option value="air_temperature_c">Air Temperature</option>
                                <option value="air_humidity_pct">Air Humidity</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-zinc-600 mb-1">Condition</label>
                            <select
                                value={newRule.condition}
                                onChange={(e) => setNewRule({ ...newRule, condition: e.target.value as "above" | "below" | "equals" })}
                                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:border-[#C17A3A] focus:outline-none font-bold"
                            >
                                <option value="below">Below</option>
                                <option value="above">Above</option>
                                <option value="equals">Equals</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-zinc-600 mb-1">Threshold</label>
                            <input
                                type="number"
                                value={newRule.threshold}
                                onChange={(e) => setNewRule({ ...newRule, threshold: Number(e.target.value) })}
                                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:border-[#C17A3A] focus:outline-none font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-zinc-600 mb-1">Zone (optional)</label>
                            <select
                                value={newRule.zone_id ?? ""}
                                onChange={(e) => setNewRule({ ...newRule, zone_id: e.target.value ? Number(e.target.value) : null })}
                                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:border-[#C17A3A] focus:outline-none font-bold"
                            >
                                <option value="">All Zones</option>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                                    <option key={n} value={n}>Zone {n}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="whatsapp"
                                checked={newRule.notify_whatsapp}
                                onChange={(e) => setNewRule({ ...newRule, notify_whatsapp: e.target.checked })}
                                className="w-5 h-5 rounded border-zinc-300"
                            />
                            <label htmlFor="whatsapp" className="text-sm font-bold text-zinc-600">Notify via WhatsApp</label>
                        </div>
                    </div>
                    {newRule.notify_whatsapp && (
                        <div className="mt-4">
                            <label className="block text-sm font-bold text-zinc-600 mb-1">Phone Number</label>
                            <input
                                type="text"
                                value={newRule.phone}
                                onChange={(e) => setNewRule({ ...newRule, phone: e.target.value })}
                                className="w-full md:w-1/2 px-4 py-2.5 rounded-xl border border-zinc-200 focus:border-[#C17A3A] focus:outline-none font-bold"
                                placeholder="+212612345678"
                            />
                        </div>
                    )}
                    <div className="mt-4 flex gap-3">
                        <button
                            onClick={handleCreateRule}
                            disabled={isCreatingRule || !newRule.name}
                            className="bg-[#3D1F0F] text-white hover:bg-[#4A2C1A] px-5 py-2.5 rounded-xl font-bold transition-colors disabled:opacity-50"
                        >
                            {isCreatingRule ? "Creating..." : "Create Rule"}
                        </button>
                        <button
                            onClick={() => setIsCreating(false)}
                            className="bg-zinc-100 text-zinc-600 hover:bg-zinc-200 px-5 py-2.5 rounded-xl font-bold transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Alert Rules */}
            <div className="mb-8">
                <h2 className="text-xl font-black text-zinc-800 mb-4">Alert Rules</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {isLoading ? (
                        [1, 2, 3].map(i => <div key={i} className="h-24 bg-zinc-200 rounded-2xl animate-pulse" />)
                    ) : alertRules && alertRules.length > 0 ? (
                        alertRules.map((rule) => (
                            <div key={rule.id} className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-black text-zinc-800">{rule.name}</h3>
                                        <p className="text-xs text-zinc-500 font-bold mt-1">
                                            {rule.target_column} {rule.condition} {rule.threshold}
                                            {rule.zone_id != null && ` — Zone ${rule.zone_id}`}
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button className="p-2 hover:bg-zinc-100 rounded-lg">
                                            <Edit className="w-4 h-4 text-zinc-400" />
                                        </button>
                                        <button onClick={() => handleDeleteRule(rule.id)} className="p-2 hover:bg-red-50 rounded-lg">
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${rule.is_active ? "bg-emerald-500" : "bg-zinc-300"}`}></span>
                                    <span className="text-xs font-bold text-zinc-500">{rule.is_active ? "Active" : "Inactive"}</span>
                                    {rule.notify_whatsapp && (
                                        <span className="text-xs font-bold text-emerald-600 ml-auto">WhatsApp</span>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full p-8 text-center bg-zinc-50 rounded-2xl border border-zinc-200">
                            <Bell className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                            <p className="text-zinc-500 font-bold">No alert rules configured</p>
                            <p className="text-zinc-400 text-sm">Create your first alert rule to get started</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Live Alerts */}
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-xl font-black text-zinc-800">Live Alerts</h2>
                    {connected && (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <Wifi className="w-3 h-3" />
                            Real-time
                        </span>
                    )}
                </div>

                {!hasLiveData ? (
                    <div className="p-8 text-center bg-zinc-50 rounded-2xl border border-zinc-200">
                        <p className="text-zinc-500 font-bold">No live data. Start the simulator to see real-time alerts.</p>
                    </div>
                ) : liveAlerts.length === 0 ? (
                    <div className="p-8 text-center bg-emerald-50 rounded-2xl border border-emerald-200">
                        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                        <p className="text-emerald-700 font-bold">All zones are healthy — no active alerts</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {liveAlerts.map((alert) => {
                            const style = alertTypeStyle(alert.type);
                            return (
                                <div key={alert.id} className={`p-4 rounded-2xl border ${style.bg}`}>
                                    <div className="flex items-start gap-3">
                                        <div className="shrink-0 mt-0.5">{style.icon}</div>
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mr-2 ${style.badge}`}>{alert.type.toUpperCase()}</span>
                                                    <span className="font-black text-zinc-800">{alert.title}</span>
                                                </div>
                                                <span className="text-xs text-zinc-400 font-bold shrink-0 whitespace-nowrap" dir="ltr">{alert.time}</span>
                                            </div>
                                            <p className="text-sm text-zinc-600 font-bold mt-1">{alert.message}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
