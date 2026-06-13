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
} from "lucide-react";

const deviceTypeIcons: Record<string, any> = {
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

const statusConfig: Record<StatusKey, {
    dot: string;
    text: string;
    bg: string;
    border: string;
    icon: React.ComponentType<{ className?: string }>;
}> = {
    online: {
        dot: "bg-emerald-500",
        text: "text-emerald-700",
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        border: "border-emerald-200 dark:border-emerald-800",
        icon: Wifi,
    },
    offline: {
        dot: "bg-gray-400",
        text: "text-gray-600 dark:text-gray-400",
        bg: "bg-gray-50 dark:bg-gray-900/30",
        border: "border-gray-200 dark:border-gray-700",
        icon: WifiOff,
    },
    error: {
        dot: "bg-red-500",
        text: "text-red-700 dark:text-red-400",
        bg: "bg-red-50 dark:bg-red-950/30",
        border: "border-red-200 dark:border-red-800",
        icon: AlertTriangle,
    },
    maintenance: {
        dot: "bg-amber-500",
        text: "text-amber-700 dark:text-amber-400",
        bg: "bg-amber-50 dark:bg-amber-950/30",
        border: "border-amber-200 dark:border-amber-800",
        icon: Wrench,
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
    const [filterType, setFilterType] = useState<string | null>(null);
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

    const { data: devices, isLoading, error } = useListDevicesApiInfrastructureDevicesGetQuery(
        { status: filterStatus || undefined, deviceType: filterType || undefined },
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
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-56 bg-muted rounded-2xl animate-pulse" />
                    ))}
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

    const deviceList = devices || [];
    const filteredDevices = deviceList
        .filter((device: any) =>
            device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            device.serial_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            device.mac_address?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a: any, b: any) =>
            (STATUS_SORT_ORDER[a.status] ?? 4) - (STATUS_SORT_ORDER[b.status] ?? 4)
        );

    const stats = {
        total: deviceList.length,
        online: deviceList.filter((d: any) => d.status === "online").length,
        offline: deviceList.filter((d: any) => d.status === "offline").length,
        error: deviceList.filter((d: any) => d.status === "error").length,
    };

    const deviceTypes = [...new Set(deviceList.map((d: any) => d.device_type as string))];

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
            const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
            const farmId = typeof window !== "undefined" ? localStorage.getItem("activeFarmId") : null;
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;
            if (farmId) headers["X-Farm-ID"] = farmId;
            const isOpen = device.control_state?.valve_open;
            await fetch(`${getApiBaseUrl()}/api/control/device/${device.id}`, {
                method: "POST",
                headers,
                body: JSON.stringify({ command_type: isOpen ? "valve_close" : "valve_open" }),
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
                    <span className="sm:hidden"><Plus className="w-4 h-4" /></span>
                </button>
            </div>

            {/* Add Device Form */}
            {showAddDevice && (
                <div className="mb-6 p-5 bg-card rounded-2xl border border-border shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-foreground">{t("new_device")}</h3>
                        <button
                            onClick={() => setShowAddDevice(false)}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                        >
                            <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-foreground">{t("device_name")}</label>
                            <input
                                type="text"
                                value={newDevice.name}
                                onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:border-primary transition-colors"
                                placeholder={t("device_name_placeholder")}
                            />
                        </div>
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
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-foreground">{t("model")}</label>
                            <input
                                type="text"
                                value={newDevice.model}
                                onChange={(e) => setNewDevice({ ...newDevice, model: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:border-primary transition-colors"
                                placeholder={t("model_placeholder")}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-foreground">{t("serial_number")}</label>
                            <input
                                type="text"
                                value={newDevice.serial_number}
                                onChange={(e) => setNewDevice({ ...newDevice, serial_number: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:border-primary transition-colors"
                                placeholder={t("serial_placeholder")}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-foreground">{t("mac_address")}</label>
                            <input
                                type="text"
                                value={newDevice.mac_address}
                                onChange={(e) => setNewDevice({ ...newDevice, mac_address: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:border-primary transition-colors font-mono"
                                placeholder="00:00:00:00:00:00"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-5">
                        <button
                            onClick={handleAddDevice}
                            className="px-5 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-medium transition-colors"
                        >
                            {t("save")}
                        </button>
                        <button
                            onClick={() => setShowAddDevice(false)}
                            className="px-5 py-2 bg-muted text-muted-foreground rounded-xl hover:bg-muted/70 font-medium transition-colors"
                        >
                            {t("cancel")}
                        </button>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <StatCard
                    icon={<Activity className="w-4 h-4 text-primary" />}
                    label={t("total")}
                    value={stats.total}
                    className="border-border"
                />
                <StatCard
                    icon={<Wifi className="w-4 h-4 text-emerald-500" />}
                    label={t("online")}
                    value={stats.online}
                    valueColor="text-emerald-600"
                    className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20"
                />
                <StatCard
                    icon={<WifiOff className="w-4 h-4 text-gray-400" />}
                    label={t("offline")}
                    value={stats.offline}
                    valueColor="text-gray-500"
                    className="border-gray-200 dark:border-gray-700"
                />
                <StatCard
                    icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
                    label={t("errors")}
                    value={stats.error}
                    valueColor="text-red-600"
                    className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                />
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("search_placeholder")}
                        className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-4 rtl:pl-4 py-2 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:border-primary transition-colors"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted transition-colors"
                        >
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
                    <select
                        value={filterType || ""}
                        onChange={(e) => setFilterType(e.target.value || null)}
                        className="flex-1 sm:flex-none px-3 py-2 border border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                        <option value="">{t("all_types")}</option>
                        {deviceTypes.map((type) => (
                            <option key={type} value={type}>
                                {deviceTypeLabels[type] || type}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Device Grid */}
            {filteredDevices.length === 0 ? (
                <div className="p-12 bg-muted/20 rounded-2xl border border-dashed border-border text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                        <Cpu className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-1">{t("empty_title")}</h3>
                    <p className="text-muted-foreground text-sm">{t("empty_description")}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDevices.map((device: any) => {
                        const config = statusConfig[device.status as StatusKey] || statusConfig.offline;
                        const DeviceIcon = deviceTypeIcons[device.device_type] || Activity;
                        const battery = device.last_battery_pct;

                        return (
                            <div
                                key={device.id}
                                className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md transition-shadow"
                            >
                                {/* Card Header */}
                                <div className={`p-4 border-b ${config.bg} ${config.border}`}>
                                    <div className="flex items-center justify-between">
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

                                {/* Card Body */}
                                <div className="p-4 space-y-3">
                                    {device.model && (
                                        <InfoRow label={t("model")} value={device.model} />
                                    )}
                                    {device.serial_number && (
                                        <InfoRow label={t("serial")} value={device.serial_number} mono />
                                    )}
                                    {device.mac_address && (
                                        <InfoRow label="MAC" value={device.mac_address} mono />
                                    )}

                                    {/* Battery with progress bar */}
                                    {battery != null && (
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xs text-muted-foreground">{t("battery")}</span>
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
                                        <InfoRow
                                            label={t("last_reading")}
                                            value={formatLastReading(device.last_reading_at)}
                                        />
                                    )}
                                    {device.latitude && device.longitude && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <MapPin className="w-3 h-3 shrink-0" />
                                            <span className="font-mono">
                                                {device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Card Actions */}
                                <div className="px-4 pb-4 flex gap-2">
                                    <button
                                        onClick={() => handleToggleStatus(device)}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-muted/60 hover:bg-muted border border-border rounded-xl transition-colors text-sm font-medium"
                                    >
                                        <Power className="w-3.5 h-3.5" />
                                        {device.status === "online" ? t("turn_off") : t("turn_on")}
                                    </button>
                                    {device.device_type === "valve_controller" && (
                                        <button
                                            onClick={() => handleValveControl(device)}
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
                    })}
                </div>
            )}
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
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide truncate">
                    {label}
                </span>
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
