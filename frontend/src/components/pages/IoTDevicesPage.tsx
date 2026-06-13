"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { getApiBaseUrl } from "@/lib/apiConfig";
import {
    useListDevicesApiInfrastructureDevicesGetQuery,
    useCreateDeviceApiInfrastructureDevicesPostMutation,
    useUpdateDeviceApiInfrastructureDevicesDeviceIdPutMutation,
} from "@/lib/store/generated/api";
import { useAppSelector } from "@/lib/store/hooks";
import {
    Wifi,
    WifiOff,
    AlertTriangle,
    Wrench,
    Plus,
    Gauge,
    Droplets,
    Thermometer,
    Wind,
    Battery,
    MapPin,
    Activity,
    Settings,
    Power,
    Search,
    X,
    Cpu,
    ArrowUpDown,
} from "lucide-react";

const deviceTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    flow_meter: Gauge,
    pressure_sensor: Activity,
    moisture_sensor: Droplets,
    valve_controller: Settings,
    temperature_sensor: Thermometer,
    humidity_sensor: Wind,
    gateway: Wifi,
    battery: Battery,
};

type StatusKey = "online" | "offline" | "error" | "maintenance";
type SortKey = "status" | "type" | "name";

const statusConfig: Record<StatusKey, {
    dot: string;
    text: string;
    bg: string;
    border: string;
}> = {
    online: {
        dot: "bg-emerald-500",
        text: "text-emerald-700 dark:text-emerald-400",
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        border: "border-emerald-200 dark:border-emerald-800",
    },
    offline: {
        dot: "bg-gray-400",
        text: "text-gray-600 dark:text-gray-400",
        bg: "bg-gray-50 dark:bg-gray-900/30",
        border: "border-gray-200 dark:border-gray-700",
    },
    error: {
        dot: "bg-red-500",
        text: "text-red-700 dark:text-red-400",
        bg: "bg-red-50 dark:bg-red-950/30",
        border: "border-red-200 dark:border-red-800",
    },
    maintenance: {
        dot: "bg-amber-500",
        text: "text-amber-700 dark:text-amber-400",
        bg: "bg-amber-50 dark:bg-amber-950/30",
        border: "border-amber-200 dark:border-amber-800",
    },
};

const STATUS_SORT_ORDER: Record<string, number> = {
    online: 0,
    maintenance: 1,
    offline: 2,
    error: 3,
};

export default function IoTDevicesPage() {
    const t = useTranslations("IoTDevicesPage");
    const { activeFarmId } = useAppSelector((state) => state.auth);

    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [activeTypeChip, setActiveTypeChip] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortKey>("status");
    const [showAddDevice, setShowAddDevice] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const deviceTypeLabels: Record<string, string> = {
        flow_meter: t("device_type_flow_meter"),
        pressure_sensor: t("device_type_pressure_sensor"),
        moisture_sensor: t("device_type_moisture_sensor"),
        valve_controller: t("device_type_valve_controller"),
        temperature_sensor: t("device_type_temperature_sensor"),
        humidity_sensor: t("device_type_humidity_sensor"),
        gateway: t("device_type_gateway"),
        battery: t("device_type_battery"),
    };

    const statusLabels: Record<string, string> = {
        online: t("online"),
        offline: t("offline"),
        error: t("error"),
        maintenance: t("maintenance"),
    };

    // Type filtering is client-side; only status is sent to the API
    const { data: devices, isLoading, error } = useListDevicesApiInfrastructureDevicesGetQuery(
        { status: filterStatus || undefined },
        { skip: !activeFarmId }
    );

    const [createDevice] = useCreateDeviceApiInfrastructureDevicesPostMutation();
    const [updateDevice] = useUpdateDeviceApiInfrastructureDevicesDeviceIdPutMutation();

    const [newDevice, setNewDevice] = useState({
        device_type: "flow_meter",
        name: "",
        model: "",
        serial_number: "",
        mac_address: "",
    });

    if (!activeFarmId) {
        return (
            <div className="w-full">
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <p className="text-amber-800 dark:text-amber-300 font-medium">{t("no_farm_selected")}</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="w-full">
                <div className="h-8 bg-muted rounded-xl animate-pulse w-48 mb-6" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-56 bg-muted rounded-2xl animate-pulse" />)}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full">
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4">
                    <p className="text-red-800 dark:text-red-300 font-medium">{t("error_loading")}</p>
                </div>
            </div>
        );
    }

    const deviceList: any[] = devices || [];

    // Count per type, sorted alphabetically by translated label
    const typeCounts = deviceList.reduce<Record<string, number>>((acc, device) => {
        acc[device.device_type] = (acc[device.device_type] || 0) + 1;
        return acc;
    }, {});
    const deviceTypes = Object.keys(typeCounts).sort((a, b) =>
        (deviceTypeLabels[a] || a).localeCompare(deviceTypeLabels[b] || b)
    );

    const stats = {
        total: deviceList.length,
        online: deviceList.filter((d) => d.status === "online").length,
        offline: deviceList.filter((d) => d.status === "offline").length,
        error: deviceList.filter((d) => d.status === "error").length,
    };

    const filteredDevices = deviceList
        .filter((device) => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = !q ||
                device.name.toLowerCase().includes(q) ||
                device.serial_number?.toLowerCase().includes(q) ||
                device.mac_address?.toLowerCase().includes(q);
            const matchesType = !activeTypeChip || device.device_type === activeTypeChip;
            return matchesSearch && matchesType;
        })
        .sort((a, b) => {
            if (sortBy === "type") {
                const la = deviceTypeLabels[a.device_type] || a.device_type;
                const lb = deviceTypeLabels[b.device_type] || b.device_type;
                const diff = la.localeCompare(lb);
                if (diff !== 0) return diff;
                return (STATUS_SORT_ORDER[a.status] ?? 4) - (STATUS_SORT_ORDER[b.status] ?? 4);
            }
            if (sortBy === "name") return a.name.localeCompare(b.name);
            // default: by status (online first)
            return (STATUS_SORT_ORDER[a.status] ?? 4) - (STATUS_SORT_ORDER[b.status] ?? 4);
        });

    // When sorting by type, group for section headers
    const typeGroups = sortBy === "type"
        ? deviceTypes
            .map((type) => ({ type, items: filteredDevices.filter((d) => d.device_type === type) }))
            .filter((g) => g.items.length > 0)
        : null;

    const handleAddDevice = async () => {
        if (!newDevice.name || !activeFarmId) return;
        try {
            await createDevice({ ioTDeviceCreate: newDevice });
            setNewDevice({ device_type: "flow_meter", name: "", model: "", serial_number: "", mac_address: "" });
            setShowAddDevice(false);
        } catch (err) {
            console.error("Failed to create device:", err);
        }
    };

    const handleToggleStatus = async (device: any) => {
        const newStatus = device.status === "online" ? "offline" : "online";
        try {
            await updateDevice({ deviceId: device.id, ioTDeviceUpdate: { status: newStatus } });
        } catch (err) {
            console.error("Failed to update device:", err);
        }
    };

    const handleValveControl = async (device: any) => {
        try {
            const token = localStorage.getItem("token");
            const farmId = localStorage.getItem("activeFarmId");
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;
            if (farmId) headers["X-Farm-ID"] = farmId;
            await fetch(`${getApiBaseUrl()}/api/control/device/${device.id}`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    command_type: device.control_state?.valve_open ? "valve_close" : "valve_open",
                }),
            });
        } catch (e) {
            console.error("Device control error:", e);
        }
    };

    const formatLastReading = (timestamp: string) => {
        const diff = Date.now() - new Date(timestamp).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return "< 1 min";
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        return new Date(timestamp).toLocaleDateString();
    };

    const cardProps = {
        deviceTypeLabels,
        statusLabels,
        labels: {
            model: t("model"),
            serial: t("serial"),
            battery: t("battery"),
            lastReading: t("last_reading"),
            turnOn: t("turn_on"),
            turnOff: t("turn_off"),
        },
        onToggleStatus: handleToggleStatus,
        onValveControl: handleValveControl,
        formatLastReading,
    };

    return (
        <div className="w-full">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Cpu className="w-5 h-5 text-primary" />
                        </div>
                        {t("title")}
                    </h1>
                    <p className="text-muted-foreground font-bold mt-1">{t("subtitle")}</p>
                </div>
                <button
                    onClick={() => setShowAddDevice(!showAddDevice)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">{t("add_device")}</span>
                </button>
            </div>

            {/* Add Device Form */}
            {showAddDevice && (
                <div className="mb-6 p-5 bg-card rounded-2xl border border-border shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-foreground">{t("new_device")}</h3>
                        <button onClick={() => setShowAddDevice(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                            <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { label: t("device_name"), key: "name" as const, placeholder: t("device_name_placeholder") },
                            { label: t("model"), key: "model" as const, placeholder: t("model_placeholder") },
                            { label: t("serial_number"), key: "serial_number" as const, placeholder: t("serial_placeholder") },
                            { label: t("mac_address"), key: "mac_address" as const, placeholder: "00:00:00:00:00:00", mono: true },
                        ].map(({ label, key, placeholder, mono }) => (
                            <div key={key}>
                                <label className="block text-sm font-medium mb-1.5 text-foreground">{label}</label>
                                <input
                                    type="text"
                                    value={newDevice[key]}
                                    onChange={(e) => setNewDevice({ ...newDevice, [key]: e.target.value })}
                                    className={`w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:border-primary transition-colors ${mono ? "font-mono" : ""}`}
                                    placeholder={placeholder}
                                />
                            </div>
                        ))}
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-foreground">{t("device_type")}</label>
                            <select
                                value={newDevice.device_type}
                                onChange={(e) => setNewDevice({ ...newDevice, device_type: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:border-primary transition-colors"
                            >
                                {Object.entries(deviceTypeLabels).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-5">
                        <button onClick={handleAddDevice} className="px-5 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-medium transition-colors">
                            {t("save")}
                        </button>
                        <button onClick={() => setShowAddDevice(false)} className="px-5 py-2 bg-muted text-muted-foreground rounded-xl hover:bg-muted/70 font-medium transition-colors">
                            {t("cancel")}
                        </button>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <StatCard icon={<Activity className="w-4 h-4 text-primary" />} label={t("total")} value={stats.total} className="border-border" />
                <StatCard icon={<Wifi className="w-4 h-4 text-emerald-500" />} label={t("online")} value={stats.online} valueColor="text-emerald-600" className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20" />
                <StatCard icon={<WifiOff className="w-4 h-4 text-gray-400" />} label={t("offline")} value={stats.offline} valueColor="text-gray-500" className="border-gray-200 dark:border-gray-700" />
                <StatCard icon={<AlertTriangle className="w-4 h-4 text-red-500" />} label={t("errors")} value={stats.error} valueColor="text-red-600" className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20" />
            </div>

            {/* Search + Status + Sort */}
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
                <div className="relative flex-1">
                    <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("search_placeholder")}
                        className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-9 rtl:pl-9 py-2 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:border-primary transition-colors"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted transition-colors">
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    <select
                        value={filterStatus || ""}
                        onChange={(e) => setFilterStatus(e.target.value || null)}
                        className="flex-1 sm:flex-none px-3 py-2 border border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                        <option value="">{t("all_statuses")}</option>
                        <option value="online">{t("online")}</option>
                        <option value="offline">{t("offline")}</option>
                        <option value="error">{t("error")}</option>
                        <option value="maintenance">{t("maintenance")}</option>
                    </select>
                    <div className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl bg-background text-sm">
                        <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortKey)}
                            className="bg-transparent text-foreground text-sm focus:outline-none cursor-pointer"
                        >
                            <option value="status">{t("sort_status")}</option>
                            <option value="type">{t("sort_type")}</option>
                            <option value="name">{t("sort_name")}</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Type filter chips */}
            {deviceTypes.length > 1 && (
                <div className="flex items-center gap-2 mb-5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-1">
                    <TypeChip
                        active={!activeTypeChip}
                        onClick={() => setActiveTypeChip(null)}
                        label={t("all")}
                        count={deviceList.length}
                    />
                    {deviceTypes.map((type) => {
                        const Icon = deviceTypeIcons[type] || Activity;
                        return (
                            <TypeChip
                                key={type}
                                active={activeTypeChip === type}
                                onClick={() => setActiveTypeChip(activeTypeChip === type ? null : type)}
                                icon={<Icon className="w-3.5 h-3.5 shrink-0" />}
                                label={deviceTypeLabels[type] || type}
                                count={typeCounts[type]}
                            />
                        );
                    })}
                </div>
            )}

            {/* Device grid — flat or grouped by type */}
            {filteredDevices.length === 0 ? (
                <div className="p-12 bg-muted/20 rounded-2xl border border-dashed border-border text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                        <Cpu className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-1">{t("empty_title")}</h3>
                    <p className="text-muted-foreground text-sm">{t("empty_description")}</p>
                </div>
            ) : typeGroups ? (
                <div className="space-y-8">
                    {typeGroups.map(({ type, items }) => {
                        const Icon = deviceTypeIcons[type] || Activity;
                        return (
                            <div key={type}>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <Icon className="w-4 h-4 text-primary" />
                                    </div>
                                    <h3 className="font-bold text-foreground">{deviceTypeLabels[type] || type}</h3>
                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
                                        {items.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {items.map((device: any) => (
                                        <DeviceCard key={device.id} device={device} {...cardProps} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDevices.map((device: any) => (
                        <DeviceCard key={device.id} device={device} {...cardProps} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeChip({
    active,
    onClick,
    icon,
    label,
    count,
}: {
    active: boolean;
    onClick: () => void;
    icon?: React.ReactNode;
    label: string;
    count: number;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border shrink-0 ${
                active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            }`}
        >
            {icon}
            <span>{label}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                active ? "bg-white/20 text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
                {count}
            </span>
        </button>
    );
}

interface CardLabels {
    model: string;
    serial: string;
    battery: string;
    lastReading: string;
    turnOn: string;
    turnOff: string;
}

function DeviceCard({
    device,
    deviceTypeLabels,
    statusLabels,
    labels,
    onToggleStatus,
    onValveControl,
    formatLastReading,
}: {
    device: any;
    deviceTypeLabels: Record<string, string>;
    statusLabels: Record<string, string>;
    labels: CardLabels;
    onToggleStatus: (d: any) => void;
    onValveControl: (d: any) => void;
    formatLastReading: (ts: string) => string;
}) {
    const config = statusConfig[device.status as StatusKey] || statusConfig.offline;
    const DeviceIcon = deviceTypeIcons[device.device_type] || Activity;
    const battery = device.last_battery_pct;

    return (
        <div className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md transition-shadow">
            {/* Header */}
            <div className={`p-4 border-b ${config.bg} ${config.border}`}>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.bg} border ${config.border}`}>
                            <DeviceIcon className={`w-5 h-5 ${config.text}`} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-foreground truncate">{device.name}</h3>
                            <p className="text-xs text-muted-foreground truncate">
                                {deviceTypeLabels[device.device_type] || device.device_type}
                            </p>
                        </div>
                    </div>
                    {/* Status badge */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0 ${config.bg} border ${config.border}`}>
                        {device.status === "online" ? (
                            <span className="relative flex h-2 w-2">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-60`} />
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
                            </span>
                        ) : (
                            <span className={`h-2 w-2 rounded-full ${config.dot}`} />
                        )}
                        <span className={`text-xs font-bold ${config.text}`}>
                            {statusLabels[device.status] || device.status}
                        </span>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
                {device.model && <InfoRow label={labels.model} value={device.model} />}
                {device.serial_number && <InfoRow label={labels.serial} value={device.serial_number} mono />}
                {device.mac_address && <InfoRow label="MAC" value={device.mac_address} mono />}

                {battery != null && (
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-muted-foreground">{labels.battery}</span>
                            <div className="flex items-center gap-1">
                                <Battery className={`w-3.5 h-3.5 ${battery > 20 ? "text-emerald-500" : "text-red-500"}`} />
                                <span className={`text-xs font-bold ${battery > 50 ? "text-emerald-600" : battery > 20 ? "text-amber-600" : "text-red-600"}`}>
                                    {battery}%
                                </span>
                            </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${battery > 50 ? "bg-emerald-500" : battery > 20 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${Math.min(battery, 100)}%` }}
                            />
                        </div>
                    </div>
                )}

                {device.last_reading_at && (
                    <InfoRow label={labels.lastReading} value={formatLastReading(device.last_reading_at)} />
                )}
                {device.latitude && device.longitude && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="font-mono">{device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}</span>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="px-4 pb-4 flex gap-2">
                <button
                    onClick={() => onToggleStatus(device)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-muted/60 hover:bg-muted border border-border rounded-xl transition-colors text-sm font-medium"
                >
                    <Power className="w-3.5 h-3.5" />
                    {device.status === "online" ? labels.turnOff : labels.turnOn}
                </button>
                {device.device_type === "valve_controller" && (
                    <button
                        onClick={() => onValveControl(device)}
                        className={`px-3 py-2 rounded-xl border transition-colors ${
                            device.control_state?.valve_open
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
                                : "bg-muted/60 border-border text-muted-foreground hover:bg-muted"
                        }`}
                        title={device.control_state?.valve_open ? "Close Valve" : "Open Valve"}
                    >
                        <Droplets className="w-4 h-4" />
                    </button>
                )}
                <button className="px-3 py-2 bg-muted/60 hover:bg-muted border border-border rounded-xl transition-colors">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                </button>
            </div>
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    valueColor = "text-foreground",
    className = "",
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    valueColor?: string;
    className?: string;
}) {
    return (
        <div className={`bg-card rounded-xl p-4 border ${className}`}>
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide truncate">{label}</span>
            </div>
            <p className={`text-2xl font-black ${valueColor}`}>{value}</p>
        </div>
    );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground shrink-0">{label}</span>
            <span className={`text-sm font-medium truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
        </div>
    );
}
