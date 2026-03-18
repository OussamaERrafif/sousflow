"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
    Filter,
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

const deviceTypeLabels: Record<string, string> = {
    flow_meter: "Flow Meter",
    pressure_sensor: "Pressure Sensor",
    moisture_sensor: "Moisture Sensor",
    valve_controller: "Valve Controller",
    temperature_sensor: "Temperature Sensor",
    humidity_sensor: "Humidity Sensor",
    gateway: "Gateway",
    battery: "Battery",
};

type StatusKey = "online" | "offline" | "error" | "maintenance";

const statusConfig: Record<StatusKey, {
    color: string;
    text: string;
    bg: string;
    border: string;
    icon: React.ComponentType<{ className?: string }>;
}> = {
    online: {
        color: "bg-emerald-500",
        text: "text-emerald-700",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        icon: Wifi,
    },
    offline: {
        color: "bg-gray-400",
        text: "text-gray-700",
        bg: "bg-gray-50",
        border: "border-gray-200",
        icon: WifiOff,
    },
    error: {
        color: "bg-red-500",
        text: "text-red-700",
        bg: "bg-red-50",
        border: "border-red-200",
        icon: AlertTriangle,
    },
    maintenance: {
        color: "bg-amber-500",
        text: "text-amber-700",
        bg: "bg-amber-50",
        border: "border-amber-200",
        icon: Wrench,
    },
};

export default function IoTDevicesPage() {
    const t = useTranslations("IoTDevicesPage");
    const { activeFarmId } = useAppSelector((state) => state.auth);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [filterType, setFilterType] = useState<string | null>(null);
    const [showAddDevice, setShowAddDevice] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const { data: devices, isLoading, error } = useListDevicesApiInfrastructureDevicesGetQuery(
        {
            status: filterStatus || undefined,
            deviceType: filterType || undefined,
        },
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
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-amber-800 font-medium">{t("no_farm_selected")}</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="w-full">
                <div className="h-8 bg-muted rounded-xl animate-pulse w-48 mb-6"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-red-800 font-medium">{t("error_loading")}</p>
                </div>
            </div>
        );
    }

    const deviceList = devices || [];
    const filteredDevices = deviceList.filter((device: any) =>
        device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.serial_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.mac_address?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const stats = {
        total: deviceList.length,
        online: deviceList.filter((d: any) => d.status === "online").length,
        offline: deviceList.filter((d: any) => d.status === "offline").length,
        error: deviceList.filter((d: any) => d.status === "error").length,
    };

    const handleAddDevice = async () => {
        if (!newDevice.name || !activeFarmId) return;
        try {
            await createDevice({
                ioTDeviceCreate: newDevice,
            });
            setNewDevice({
                device_type: "flow_meter",
                name: "",
                model: "",
                serial_number: "",
                mac_address: "",
            });
            setShowAddDevice(false);
        } catch (err) {
            console.error("Failed to create device:", err);
        }
    };

    const handleToggleStatus = async (device: any) => {
        const newStatus = device.status === "online" ? "offline" : "online";
        try {
            await updateDevice({
                deviceId: device.id,
                ioTDeviceUpdate: { status: newStatus },
            });
        } catch (err) {
            console.error("Failed to update device:", err);
        }
    };

    const deviceTypes = [...new Set(deviceList.map((d: any) => d.device_type))];

    return (
        <div className="w-full">
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight">{t("title")}</h1>
                    <p className="text-muted-foreground font-bold mt-1">{t("subtitle")}</p>
                </div>
                <button
                    onClick={() => setShowAddDevice(!showAddDevice)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                    <Plus className="w-4 h-4" />
                    {t("add_device")}
                </button>
            </div>

            {showAddDevice && (
                <div className="mb-6 p-4 bg-card rounded-xl border border-border">
                    <h3 className="font-bold mb-4">{t("new_device")}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("device_name")}</label>
                            <input
                                type="text"
                                value={newDevice.name}
                                onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded-lg"
                                placeholder={t("device_name_placeholder")}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("device_type")}</label>
                            <select
                                value={newDevice.device_type}
                                onChange={(e) => setNewDevice({ ...newDevice, device_type: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded-lg"
                            >
                                {Object.entries(deviceTypeLabels).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("model")}</label>
                            <input
                                type="text"
                                value={newDevice.model}
                                onChange={(e) => setNewDevice({ ...newDevice, model: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded-lg"
                                placeholder={t("model_placeholder")}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("serial_number")}</label>
                            <input
                                type="text"
                                value={newDevice.serial_number}
                                onChange={(e) => setNewDevice({ ...newDevice, serial_number: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded-lg"
                                placeholder={t("serial_placeholder")}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("mac_address")}</label>
                            <input
                                type="text"
                                value={newDevice.mac_address}
                                onChange={(e) => setNewDevice({ ...newDevice, mac_address: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded-lg"
                                placeholder="00:00:00:00:00:00"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={handleAddDevice}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                            {t("save")}
                        </button>
                        <button
                            onClick={() => setShowAddDevice(false)}
                            className="px-4 py-2 bg-muted rounded-lg"
                        >
                            {t("cancel")}
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold text-muted-foreground uppercase">{t("total")}</span>
                    </div>
                    <p className="text-2xl font-black text-foreground">{stats.total}</p>
                </div>
                <div className="bg-card rounded-xl p-4 border border-emerald-200">
                    <div className="flex items-center gap-2 mb-1">
                        <Wifi className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold text-muted-foreground uppercase">{t("online")}</span>
                    </div>
                    <p className="text-2xl font-black text-emerald-600">{stats.online}</p>
                </div>
                <div className="bg-card rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                        <WifiOff className="w-4 h-4 text-gray-500" />
                        <span className="text-xs font-bold text-muted-foreground uppercase">{t("offline")}</span>
                    </div>
                    <p className="text-2xl font-black text-gray-600">{stats.offline}</p>
                </div>
                <div className="bg-card rounded-xl p-4 border border-red-200">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-xs font-bold text-muted-foreground uppercase">{t("errors")}</span>
                    </div>
                    <p className="text-2xl font-black text-red-600">{stats.error}</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("search_placeholder")}
                        className="w-full pl-4 pr-10 py-2 border border-border rounded-lg"
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        value={filterStatus || ""}
                        onChange={(e) => setFilterStatus(e.target.value || null)}
                        className="px-3 py-2 border border-border rounded-lg"
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
                        className="px-3 py-2 border border-border rounded-lg"
                    >
                        <option value="">{t("all_types")}</option>
                        {deviceTypes.map((type: any) => (
                            <option key={type} value={type}>{deviceTypeLabels[type] || type}</option>
                        ))}
                    </select>
                </div>
            </div>

            {filteredDevices.length === 0 ? (
                <div className="p-8 bg-muted/30 rounded-xl border border-dashed border-border text-center">
                    <Activity className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-bold text-foreground mb-2">{t("empty_title")}</h3>
                    <p className="text-muted-foreground">{t("empty_description")}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDevices.map((device: any) => {
                        const config = statusConfig[device.status as StatusKey] || statusConfig.offline;
                        const StatusIcon = config.icon;
                        const DeviceIcon = deviceTypeIcons[device.device_type] || Activity;

                        return (
                            <div
                                key={device.id}
                                className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-shadow"
                            >
                                <div className={`p-4 border-b ${config.bg} ${config.border}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.bg}`}>
                                                <DeviceIcon className={`w-5 h-5 ${config.text}`} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-foreground">{device.name}</h3>
                                                <p className="text-xs text-muted-foreground capitalize">
                                                    {deviceTypeLabels[device.device_type] || device.device_type}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${config.bg} border ${config.border}`}>
                                            <StatusIcon className={`w-3.5 h-3.5 ${config.text}`} />
                                            <span className={`text-xs font-bold ${config.text}`}>{device.status}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 space-y-3">
                                    {device.model && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">{t("model")}</span>
                                            <span className="text-sm font-medium">{device.model}</span>
                                        </div>
                                    )}
                                    {device.serial_number && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">{t("serial")}</span>
                                            <span className="text-sm font-mono text-xs">{device.serial_number}</span>
                                        </div>
                                    )}
                                    {device.mac_address && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">MAC</span>
                                            <span className="text-sm font-mono text-xs">{device.mac_address}</span>
                                        </div>
                                    )}
                                    {device.last_battery_pct && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">{t("battery")}</span>
                                            <div className="flex items-center gap-2">
                                                <Battery className={`w-4 h-4 ${device.last_battery_pct > 20 ? "text-green-500" : "text-red-500"}`} />
                                                <span className="text-sm font-bold">{device.last_battery_pct}%</span>
                                            </div>
                                        </div>
                                    )}
                                    {device.last_reading_at && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">{t("last_reading")}</span>
                                            <span className="text-xs">
                                                {new Date(device.last_reading_at).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                    {device.latitude && device.longitude && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <MapPin className="w-3 h-3" />
                                            <span>{device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="p-3 bg-muted/30 border-t border-border flex gap-2">
                                    <button
                                        onClick={() => handleToggleStatus(device)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors text-sm font-medium"
                                    >
                                        <Power className="w-4 h-4" />
                                        {device.status === "online" ? t("turn_off") : t("turn_on")}
                                    </button>
                                    <button className="px-3 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors">
                                        <Settings className="w-4 h-4" />
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
