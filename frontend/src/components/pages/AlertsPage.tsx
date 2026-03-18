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
import { useDebugLog } from "@/lib/debug";

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

    useDebugLog("AlertsPage - alertRules", alertRules);
    useDebugLog("AlertsPage - sseReadings", sseReadings);
    useDebugLog("AlertsPage - connected", connected);
    useDebugLog("AlertsPage - lastUpdate", lastUpdate);

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
        critical: { 
            bg: "bg-red-500/5 border-red-500/20", 
            iconBg: "bg-red-500/10", 
            icon: <AlertOctagon className="w-5 h-5 text-red-500" />, 
            badge: "bg-red-500/10 text-red-500",
            text: "text-red-500"
        },
        warning: { 
            bg: "bg-amber-500/5 border-amber-500/20", 
            iconBg: "bg-amber-500/10", 
            icon: <AlertTriangle className="w-5 h-5 text-amber-500" />, 
            badge: "bg-amber-500/10 text-amber-500",
            text: "text-amber-500"
        },
        info: { 
            bg: "bg-blue-500/5 border-blue-500/20", 
            iconBg: "bg-blue-500/10", 
            icon: <Info className="w-5 h-5 text-blue-500" />, 
            badge: "bg-blue-500/10 text-blue-500",
            text: "text-blue-500"
        },
    })[type];

    const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">("all");
    const filteredAlerts = filter === "all" ? liveAlerts : liveAlerts.filter(a => a.type === filter);

    return (
        <div className="w-full">
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t("nav_alerts")}</h1>
                    <p className="text-muted-foreground mt-1">Alert rules and live notifications</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-2.5 rounded-xl font-semibold transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Create Rule
                </button>
            </div>

            {/* Create Rule Form */}
            {isCreating && (
                <div className="mb-6 p-6 rounded-2xl bg-card border border-border shadow-xl">
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-lg font-bold text-foreground">New Alert Rule</h3>
                        <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-accent rounded-lg transition-colors">
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">Rule Name</label>
                            <input
                                type="text"
                                value={newRule.name}
                                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-input bg-background focus:border-primary focus:outline-none font-medium"
                                placeholder="e.g., Low Moisture Alert"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">Target Sensor</label>
                            <select
                                value={newRule.target_column}
                                onChange={(e) => setNewRule({ ...newRule, target_column: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-input bg-background focus:border-primary focus:outline-none font-medium"
                            >
                                <option value="soil_moisture_pct">Soil Moisture</option>
                                <option value="zone_pressure_mpa">Zone Pressure</option>
                                <option value="zone_flow_lpm">Zone Flow</option>
                                <option value="air_temperature_c">Air Temperature</option>
                                <option value="air_humidity_pct">Air Humidity</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">Condition</label>
                            <select
                                value={newRule.condition}
                                onChange={(e) => setNewRule({ ...newRule, condition: e.target.value as "above" | "below" | "equals" })}
                                className="w-full px-4 py-2.5 rounded-xl border border-input bg-background focus:border-primary focus:outline-none font-medium"
                            >
                                <option value="below">Below</option>
                                <option value="above">Above</option>
                                <option value="equals">Equals</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">Threshold</label>
                            <input
                                type="number"
                                value={newRule.threshold}
                                onChange={(e) => setNewRule({ ...newRule, threshold: Number(e.target.value) })}
                                className="w-full px-4 py-2.5 rounded-xl border border-input bg-background focus:border-primary focus:outline-none font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">Zone (optional)</label>
                            <select
                                value={newRule.zone_id ?? ""}
                                onChange={(e) => setNewRule({ ...newRule, zone_id: e.target.value ? Number(e.target.value) : null })}
                                className="w-full px-4 py-2.5 rounded-xl border border-input bg-background focus:border-primary focus:outline-none font-medium"
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
                                className="w-5 h-5 rounded border-input"
                            />
                            <label htmlFor="whatsapp" className="text-sm font-medium text-muted-foreground">Notify via WhatsApp</label>
                        </div>
                    </div>
                    {newRule.notify_whatsapp && (
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-muted-foreground mb-2">Phone Number</label>
                            <input
                                type="text"
                                value={newRule.phone}
                                onChange={(e) => setNewRule({ ...newRule, phone: e.target.value })}
                                className="w-full md:w-1/2 px-4 py-2.5 rounded-xl border border-input bg-background focus:border-primary focus:outline-none font-medium"
                                placeholder="+212612345678"
                            />
                        </div>
                    )}
                    <div className="mt-5 flex gap-3">
                        <button
                            onClick={handleCreateRule}
                            disabled={isCreatingRule || !newRule.name}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50"
                        >
                            {isCreatingRule ? "Creating..." : "Create Rule"}
                        </button>
                        <button
                            onClick={() => setIsCreating(false)}
                            className="bg-muted text-muted-foreground hover:bg-accent px-5 py-2.5 rounded-xl font-semibold transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Alert Rules */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold text-foreground mb-4">Alert Rules</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {isLoading ? (
                        [1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />)
                    ) : alertRules && alertRules.length > 0 ? (
                        alertRules.map((rule) => (
                            <div key={rule.id} className="p-4 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-semibold text-foreground">{rule.name}</h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {rule.target_column} {rule.condition} {rule.threshold}
                                            {rule.zone_id != null && ` — Zone ${rule.zone_id}`}
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button className="p-2 hover:bg-accent rounded-lg transition-colors">
                                            <Edit className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                        <button onClick={() => handleDeleteRule(rule.id)} className="p-2 hover:bg-destructive/10 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${rule.is_active ? "bg-emerald-500" : "bg-muted-foreground/30"}`}></span>
                                    <span className="text-xs font-medium text-muted-foreground">{rule.is_active ? "Active" : "Inactive"}</span>
                                    {rule.notify_whatsapp && (
                                        <span className="text-xs font-medium text-emerald-500 ml-auto">WhatsApp</span>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full p-8 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
                            <Bell className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-muted-foreground font-medium">No alert rules configured</p>
                            <p className="text-muted-foreground/60 text-sm">Create your first alert rule to get started</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Live Alerts */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-foreground">Live Alerts</h2>
                        {connected && (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Real-time
                            </span>
                        )}
                    </div>
                    {/* Filter Buttons */}
                    {liveAlerts.length > 0 && (
                        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
                            {(["all", "critical", "warning", "info"] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        filter === f 
                                            ? "bg-card shadow-sm text-foreground" 
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {!hasLiveData ? (
                    <div className="p-8 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
                        <p className="text-muted-foreground font-medium">No live data. Start the simulator to see real-time alerts.</p>
                    </div>
                ) : filteredAlerts.length === 0 ? (
                    <div className="p-8 text-center bg-emerald-500/5 rounded-2xl border border-emerald-500/20">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500/50 mx-auto mb-3" />
                        <p className="text-emerald-500 font-semibold">All zones are healthy — no active alerts</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredAlerts.map((alert) => {
                            const style = alertTypeStyle(alert.type);
                            return (
                                <div key={alert.id} className={`p-4 rounded-2xl border ${style.bg} hover:shadow-md transition-all`}>
                                    <div className="flex items-start gap-4">
                                        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${style.iconBg}`}>
                                            {style.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${style.badge}`}>
                                                        {alert.type.toUpperCase()}
                                                    </span>
                                                    <span className="font-semibold text-foreground">{alert.title}</span>
                                                </div>
                                                <span className="text-xs text-muted-foreground shrink-0" dir="ltr">{alert.time}</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-2">{alert.message}</p>
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
