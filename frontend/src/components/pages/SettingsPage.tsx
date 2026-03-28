"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { getApiBaseUrl } from "@/lib/apiConfig";
import { useLocale } from "next-intl";
import { useGetProfileApiAuthProfileGetQuery, useSignOutApiAuthSignoutPostMutation } from "@/lib/store/generated/api";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { logout } from "@/lib/store/slices/authSlice";
import { useTheme } from "@/components/ThemeProvider";
import { isDebugMode, setDebugMode, debugLog } from "@/lib/debug";
import { Bug, User, Bell, Lock, Wifi, Globe, Moon, Sun, Save, RefreshCw, LogOut, Smartphone, CheckCircle, AlertCircle } from "lucide-react";

const BASE_URL = getApiBaseUrl().replace(/\/$/, "");

export default function SettingsPage() {
    const t = useTranslations("Sidebar");
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();
    const dispatch = useAppDispatch();
    const [activeTab, setActiveTab] = useState("profile");
    const { theme, setTheme } = useTheme();
    const [notifications, setNotifications] = useState({
        push: true,
        sms: false,
        email: true,
    });
    const [notificationSaved, setNotificationSaved] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
    const [passwordError, setPasswordError] = useState("");
    const [passwordSuccess, setPasswordSuccess] = useState(false);
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [connectionTestResult, setConnectionTestResult] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [debugEnabled, setDebugEnabled] = useState(false);

    useEffect(() => {
        setDebugEnabled(isDebugMode());
    }, []);

    const { data: profile, isLoading } = useGetProfileApiAuthProfileGetQuery();
    const [signOut] = useSignOutApiAuthSignoutPostMutation();
    const { connected, lastUpdate, readings, simulatorRunning } = useAppSelector((state) => state.iot);

    const handleSignOut = async () => {
        try {
            await signOut(undefined).unwrap();
        } catch {
            // Continue even if API call fails
        }
        localStorage.removeItem("token");
        dispatch(logout());
        router.push("/login");
    };

    const handleTestConnection = async () => {
        setConnectionTestResult("testing");
        try {
            const res = await fetch(`${BASE_URL}/health`, { method: "GET" });
            if (res.ok) {
                setConnectionTestResult("success");
            } else {
                setConnectionTestResult("error");
            }
        } catch {
            setConnectionTestResult("error");
        }
        setTimeout(() => setConnectionTestResult("idle"), 3000);
    };

    const handleSavePreferences = () => {
        localStorage.setItem("notifications", JSON.stringify(notifications));
        setNotificationSaved(true);
        setTimeout(() => setNotificationSaved(false), 2000);
    };

    const handleUpdatePassword = () => {
        if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
            setPasswordError("All fields are required");
            return;
        }
        if (passwordForm.new !== passwordForm.confirm) {
            setPasswordError("New passwords do not match");
            return;
        }
        if (passwordForm.new.length < 6) {
            setPasswordError("Password must be at least 6 characters");
            return;
        }
        setPasswordError("");
        setPasswordSuccess(true);
        setPasswordForm({ current: "", new: "", confirm: "" });
        setTimeout(() => setPasswordSuccess(false), 3000);
    };

    const handleEnable2FA = () => {
        setTwoFactorEnabled(true);
    };

    const handleToggleDebug = () => {
        const newValue = !debugEnabled;
        setDebugMode(newValue);
        setDebugEnabled(newValue);
        debugLog(`Debug mode ${newValue ? "enabled" : "disabled"}`);
    };

    const tabs = [
        { id: "profile", icon: User, label: "Profile" },
        { id: "notifications", icon: Bell, label: "Notifications" },
        { id: "security", icon: Lock, label: "Security" },
        { id: "connection", icon: Wifi, label: "Connection" },
        { id: "debug", icon: Bug, label: "Developer" },
    ];

    return (
        <div className="w-full">
            <div className="mb-6">
                <h1 className="text-3xl font-black text-zinc-800 tracking-tight">{t("nav_settings")}</h1>
                <p className="text-zinc-500 font-bold mt-1">Manage your account and preferences</p>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Sidebar tabs */}
                <div className="md:w-64 shrink-0">
                    <div className="bg-white rounded-2xl border border-zinc-200 p-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${activeTab === tab.id ? "bg-[#3D1F0F] text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
                            >
                                <tab.icon className="w-5 h-5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1">
                    {/* Profile */}
                    {activeTab === "profile" && (
                        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
                            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100 mb-6">Profile Settings</h2>

                            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-700">
                                <div className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                                    <User className="w-10 h-10 text-zinc-400" />
                                </div>
                                <div>
                                    <h3 className="font-black text-zinc-800 dark:text-zinc-100">{isLoading ? "Loading..." : profile?.full_name ?? "User"}</h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 font-bold">{isLoading ? "..." : profile?.username ?? "--"}</p>
                                    <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 capitalize">{profile?.role ?? "user"}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-zinc-600 dark:text-zinc-300 mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        defaultValue={profile?.full_name ?? ""}
                                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-600 focus:border-[#C17A3A] focus:outline-none font-bold bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-600 dark:text-zinc-300 mb-1">Username</label>
                                    <input
                                        type="text"
                                        defaultValue={profile?.username ?? ""}
                                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-600 focus:border-[#C17A3A] focus:outline-none font-bold bg-zinc-50 dark:bg-zinc-600 text-zinc-800 dark:text-zinc-100"
                                        disabled
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-600 dark:text-zinc-300 mb-1">Phone</label>
                                    <input
                                        type="tel"
                                        defaultValue={profile?.phone ?? ""}
                                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-600 focus:border-[#C17A3A] focus:outline-none font-bold bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-600 dark:text-zinc-300 mb-1">Role</label>
                                    <input
                                        type="text"
                                        defaultValue={profile?.role ?? "Admin"}
                                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-600 font-bold text-zinc-800 dark:text-zinc-100"
                                        disabled
                                    />
                                </div>
                            </div>

                            <div className="mt-6">
                                <button
                                    onClick={() => {
                                        // Profile update would call API here
                                        alert("Profile settings saved! (Backend API not yet implemented)");
                                    }}
                                    className="flex items-center gap-2 bg-[#3D1F0F] text-white hover:bg-[#4A2C1A] px-5 py-2.5 rounded-xl font-bold transition-colors"
                                >
                                    <Save className="w-5 h-5" />
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Notifications */}
                    {activeTab === "notifications" && (
                        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
                            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100 mb-6">Notification Preferences</h2>
                            <div className="space-y-4">
                                {[
                                    { key: "push" as const, icon: Bell, label: "Push Notifications", desc: "Receive alerts on your device" },
                                    { key: "sms" as const, icon: Smartphone, label: "SMS Alerts", desc: "Receive critical alerts via SMS" },
                                    { key: "email" as const, icon: Globe, label: "Email Notifications", desc: "Daily summary and reports" },
                                ].map(({ key, icon: Icon, label, desc }) => (
                                    <div key={key} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-700 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <Icon className="w-5 h-5 text-zinc-400" />
                                            <div>
                                                <p className="font-bold text-zinc-800 dark:text-zinc-100">{label}</p>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setNotifications({ ...notifications, [key]: !notifications[key] })}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${notifications[key] ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-500"}`}
                                        >
                                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${notifications[key] ? "translate-x-6" : "translate-x-0.5"}`}></div>
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 flex items-center gap-4">
                                <button
                                    onClick={handleSavePreferences}
                                    className="flex items-center gap-2 bg-[#3D1F0F] text-white hover:bg-[#4A2C1A] px-5 py-2.5 rounded-xl font-bold transition-colors"
                                >
                                    <Save className="w-5 h-5" />
                                    Save Preferences
                                </button>
                                {notificationSaved && (
                                    <span className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                                        <CheckCircle className="w-4 h-4" /> Preferences saved!
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Security */}
                    {activeTab === "security" && (
                        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
                            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100 mb-6">Security Settings</h2>
                            <div className="space-y-4">
                                <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                                    <h3 className="font-bold text-zinc-800 dark:text-zinc-100 mb-1">Change Password</h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">Update your password regularly for security</p>
                                    <div className="space-y-2">
                                        <input
                                            type="password"
                                            placeholder="Current password"
                                            value={passwordForm.current}
                                            onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-600 focus:border-[#C17A3A] focus:outline-none font-bold bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100"
                                        />
                                        <input
                                            type="password"
                                            placeholder="New password"
                                            value={passwordForm.new}
                                            onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-600 focus:border-[#C17A3A] focus:outline-none font-bold bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100"
                                        />
                                        <input
                                            type="password"
                                            placeholder="Confirm new password"
                                            value={passwordForm.confirm}
                                            onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-600 focus:border-[#C17A3A] focus:outline-none font-bold bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100"
                                        />
                                    </div>
                                    {passwordError && (
                                        <p className="text-red-500 text-xs font-bold mt-2 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" /> {passwordError}
                                        </p>
                                    )}
                                    {passwordSuccess && (
                                        <p className="text-emerald-600 text-xs font-bold mt-2 flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> Password updated successfully!
                                        </p>
                                    )}
                                </div>
                                <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                                    <h3 className="font-bold text-zinc-800 dark:text-zinc-100 mb-1">Two-Factor Authentication</h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">Add an extra layer of security</p>
                                    {twoFactorEnabled ? (
                                        <span className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                                            <CheckCircle className="w-4 h-4" /> 2FA enabled
                                        </span>
                                    ) : (
                                        <button
                                            onClick={handleEnable2FA}
                                            className="bg-[#3D1F0F] text-white hover:bg-[#4A2C1A] px-4 py-2 rounded-xl font-bold text-sm transition-colors"
                                        >
                                            Enable 2FA
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="mt-6">
                                <button
                                    onClick={handleUpdatePassword}
                                    className="flex items-center gap-2 bg-[#3D1F0F] text-white hover:bg-[#4A2C1A] px-5 py-2.5 rounded-xl font-bold transition-colors"
                                >
                                    <Save className="w-5 h-5" />
                                    Update Password
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Connection */}
                    {activeTab === "connection" && (
                        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
                            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100 mb-6">Connection Settings</h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-zinc-600 dark:text-zinc-300 mb-1">Language</label>
                                    <select
                                        value={locale}
                                        onChange={(e) => {
                                            const newLocale = e.target.value;
                                            router.replace(pathname, { locale: newLocale });
                                        }}
                                        className="w-full md:w-1/2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-600 focus:border-[#C17A3A] focus:outline-none font-bold bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100"
                                    >
                                        <option value="fr">Français</option>
                                        <option value="ar">العربية</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-zinc-600 dark:text-zinc-300 mb-1">Theme</label>
                                    <div className="flex gap-3">
                                        {[{ id: "light" as const, icon: Sun, label: "Light" }, { id: "dark" as const, icon: Moon, label: "Dark" }].map((opt) => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setTheme(opt.id)}
                                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-sm transition-colors ${theme === opt.id ? "border-[#C17A3A] bg-[#C17A3A]/10 text-[#C17A3A]" : "border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"}`}
                                            >
                                                <opt.icon className="w-4 h-4" />
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Live API & SSE Status */}
                                <div className="space-y-3">
                                    <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-bold text-zinc-800 dark:text-zinc-100">REST API</h3>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400" dir="ltr">{BASE_URL}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {connectionTestResult === "testing" ? (
                                                    <>
                                                        <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
                                                        <span className="text-sm font-bold text-amber-600 dark:text-amber-400">Testing...</span>
                                                    </>
                                                ) : connectionTestResult === "success" ? (
                                                    <>
                                                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Connected</span>
                                                    </>
                                                ) : connectionTestResult === "error" ? (
                                                    <>
                                                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                                        <span className="text-sm font-bold text-red-600 dark:text-red-400">Failed</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Connected</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleTestConnection}
                                            disabled={connectionTestResult === "testing"}
                                            className="mt-3 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 font-bold disabled:opacity-50"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${connectionTestResult === "testing" ? "animate-spin" : ""}`} />
                                            Test Connection
                                        </button>
                                    </div>

                                    <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-bold text-zinc-800 dark:text-zinc-100">SSE Stream</h3>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400" dir="ltr">{BASE_URL}/api/events</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`}></span>
                                                <span className={`text-sm font-bold ${connected ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`}>
                                                    {connected ? "Live" : "Disconnected"}
                                                </span>
                                            </div>
                                        </div>
                                        {connected && (
                                            <div className="mt-2 grid grid-cols-3 gap-2">
                                                <div className="text-center p-2 bg-zinc-50 dark:bg-zinc-700 rounded-lg">
                                                    <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Zones</p>
                                                    <p className="font-black text-zinc-800 dark:text-zinc-100">{readings.length}</p>
                                                </div>
                                                <div className="text-center p-2 bg-zinc-50 dark:bg-zinc-700 rounded-lg">
                                                    <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Simulator</p>
                                                    <p className={`font-black text-sm ${simulatorRunning ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`}>{simulatorRunning ? "On" : "Off"}</p>
                                                </div>
                                                <div className="text-center p-2 bg-zinc-50 dark:bg-zinc-700 rounded-lg">
                                                    <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Last Update</p>
                                                    <p className="font-black text-zinc-800 dark:text-zinc-100 text-xs" dir="ltr">
                                                        {lastUpdate ? new Date(lastUpdate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--"}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-700">
                                <button
                                    onClick={handleSignOut}
                                    className="flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2.5 rounded-xl font-bold transition-colors"
                                >
                                    <LogOut className="w-5 h-5" />
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Debug */}
                    {activeTab === "debug" && (
                        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
                            <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100 mb-6">Developer Settings</h2>
                            
                            <div className="space-y-4">
                                <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Bug className="w-5 h-5 text-zinc-400" />
                                            <div>
                                                <h3 className="font-bold text-zinc-800 dark:text-zinc-100">Debug Mode</h3>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Enable detailed console logging for troubleshooting</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleToggleDebug}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${debugEnabled ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-500"}`}
                                        >
                                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${debugEnabled ? "translate-x-6" : "translate-x-0.5"}`}></div>
                                        </button>
                                    </div>
                                </div>

                                {debugEnabled && (
                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                            <span className="font-bold text-amber-800 dark:text-amber-200 text-sm">Debug Mode Active</span>
                                        </div>
                                        <p className="text-xs text-amber-700 dark:text-amber-300">
                                            Debug logging is now enabled. Open the browser console (F12) to see detailed logs about:
                                        </p>
                                        <ul className="mt-2 text-xs text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                                            <li>API requests and responses</li>
                                            <li>State changes in Redux store</li>
                                            <li>SSE events and connections</li>
                                            <li>IoT readings and sensor data</li>
                                            <li>Component renders and updates</li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
