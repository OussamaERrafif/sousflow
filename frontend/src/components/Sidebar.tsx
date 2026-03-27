"use client";

import { Home, Leaf, Bell, Settings, Activity, FileText, Globe, LogIn, LogOut, User, Sparkles, Map, Cpu } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { useSignOutApiAuthSignoutPostMutation } from "@/lib/store/generated/api";
import { logout } from "@/lib/store/slices/authSlice";
import { useEffect, useState } from "react";

export default function Sidebar({ activePage, setActivePage }: { activePage: string, setActivePage: (id: string) => void }) {
    const t = useTranslations("Sidebar");
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const dispatch = useAppDispatch();
    const { isAuthenticated, user } = useAppSelector((state) => state.auth);
    const [signOut] = useSignOutApiAuthSignoutPostMutation();
    const [showMore, setShowMore] = useState(false);

    useEffect(() => {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (token && !isAuthenticated) {
            dispatch({ type: "auth/setCredentials", payload: { user: { id: "", username: "" }, token } });
        }
    }, [dispatch, isAuthenticated]);

    const switchLocale = () => {
        const nextLocale = locale === "ar" ? "fr" : "ar";
        router.replace(pathname, { locale: nextLocale });
    };

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

    const handleAuthClick = () => {
        if (isAuthenticated) {
            handleSignOut();
        } else {
            router.push("/login");
        }
    };

    const renderMenuButton = (id: string, icon: any, label: string, badge?: number) => {
        const Icon = icon;
        const isActive = activePage === id;
        return (
            <button
                onClick={() => setActivePage(id)}
                className={`w-full flex items-center px-4 py-2.5 transition-all duration-200 rounded-xl mx-2 my-0.5 group ${
                    isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
                style={{ width: "calc(100% - 16px)" }}
            >
                <div className="relative">
                    <Icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? "text-primary" : "group-hover:text-primary"}`} />
                    {badge && (
                        <span className="absolute -top-1.5 -right-1.5 bg-destructive text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
                            {badge}
                        </span>
                    )}
                </div>
                <div className="rtl:mr-3 ltr:ml-3 flex-1 text-start">
                    <span className={`font-medium text-sm leading-tight ${isActive ? "text-sidebar-foreground" : ""}`}>{label}</span>
                </div>
                {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary rtl:mr-2 ltr:ml-2"></div>
                )}
            </button>
        );
    };

    const renderSectionHeader = (label: string) => (
        <div className="px-5 mb-2 mt-4">
            <p className="text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest mx-2">{label}</p>
        </div>
    );

    return (
        <>
            <aside className="hidden md:flex flex-col w-64 fixed top-0 ltr:left-0 rtl:right-0 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border overflow-hidden z-50">
                {/* Logo Section */}
                <div className="p-5 border-b border-sidebar-border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                            <Leaf className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{t("subtitle")}</p>
                        </div>
                    </div>
                </div>

                {/* Farm Info Card */}
                <div className="p-4 border-b border-sidebar-border">
                    <div className="bg-sidebar-accent/50 p-3 rounded-xl border border-sidebar-border">
                        <p className="text-foreground font-semibold text-sm">{t("farmName")}</p>
                        <p className="text-muted-foreground text-xs mt-1">{t("farmInfo")}</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-4 overflow-y-auto">
                    {/* Main Section */}
                    <div className="mb-1">
                        {renderMenuButton("dashboard", Home, t("nav_dashboard"))}
                    </div>

                    {renderSectionHeader("العمليات")}
                    {renderMenuButton("zones", Leaf, t("nav_zones"))}
                    {renderMenuButton("pumps", Settings, t("nav_pumps"))}
                    {renderMenuButton("map", Map, t("nav_map"))}
                    {renderMenuButton("iot_devices", Cpu, t("nav_iot_devices"))}

                    {renderSectionHeader("المراقبة")}
                    {renderMenuButton("alerts", Bell, t("nav_alerts"), 2)}
                    {renderMenuButton("reports", FileText, t("nav_reports"))}

                    {renderSectionHeader("النظام")}
                    {renderMenuButton("ai_assistant", Sparkles, t("nav_ai_assistant"))}
                    {renderMenuButton("settings", Activity, t("nav_settings"))}
                </nav>

                {/* User Section */}
                <div className="p-4 border-t border-sidebar-border">
                    {isAuthenticated && user ? (
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-primary-foreground" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-foreground font-semibold text-sm truncate">{user.full_name || user.username}</p>
                                <p className="text-muted-foreground text-xs truncate">{user.username}</p>
                            </div>
                        </div>
                    ) : null}
                    <div className="flex items-center justify-between">
                        {isAuthenticated ? (
                            <div className="flex items-center">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0"></div>
                                <p className="rtl:mr-2 ltr:ml-2 text-emerald-500 text-xs font-semibold uppercase tracking-wider">{t("status")}</p>
                            </div>
                        ) : (
                            <div className="flex items-center">
                                <div className="w-2 h-2 bg-muted-foreground/40 rounded-full shrink-0"></div>
                                <p className="rtl:mr-2 ltr:ml-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">Not logged in</p>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={switchLocale}
                                className="p-2 bg-sidebar-accent rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/70 transition-colors"
                                title="Switch Language"
                            >
                                <Globe className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleAuthClick}
                                className="p-2 bg-sidebar-accent rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/70 transition-colors"
                                title={isAuthenticated ? "Sign Out" : "Sign In"}
                            >
                                {isAuthenticated ? <LogOut className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-sidebar border-t border-sidebar-border z-50 px-2 pb-safe pt-2 shadow-xl">
                <ul className="flex justify-between items-center h-16">
                    {[
                        { id: "dashboard", icon: Home, label: t("nav_dashboard") },
                        { id: "zones", icon: Leaf, label: t("nav_zones") },
                        { id: "map", icon: Map, label: t("nav_map") },
                        { id: "alerts", icon: Bell, label: t("nav_alerts"), badge: 2 },
                        { id: "iot_devices", icon: Cpu, label: t("nav_iot_devices") },
                        { id: "settings", icon: Activity, label: t("nav_settings") }
                    ].map((item) => (
                        <li key={item.id} className="flex-1 h-full">
                            <button
                                onClick={() => setActivePage(item.id)}
                                className={`w-full h-full flex flex-col items-center justify-center relative rounded-xl transition-colors ${
                                    activePage === item.id 
                                        ? "text-primary" 
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <item.icon className={`w-5 h-5 ${activePage === item.id ? "text-primary" : ""}`} />
                                <span className={`text-[10px] mt-1.5 font-medium ${activePage === item.id ? "text-primary" : ""}`}>
                                    {item.label}
                                </span>
                                {item.badge && (
                                    <span className="absolute top-1 right-2 bg-destructive text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                                        {item.badge}
                                    </span>
                                )}
                            </button>
                        </li>
                    ))}
                    <li className="flex-1 h-full">
                        <button
                            onClick={() => setShowMore(!showMore)}
                            className={`w-full h-full flex flex-col items-center justify-center relative rounded-xl transition-colors ${
                                showMore ? "text-primary" : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <div className={`w-5 h-5 flex items-center justify-center text-[18px] font-bold transition-transform duration-300 ${showMore ? "rotate-45 text-primary" : ""}`}>
                                +
                            </div>
                            <span className={`text-[10px] mt-1.5 font-medium transition-colors duration-300 ${showMore ? "text-primary" : ""}`}>
                                {showMore ? "إغلاق" : "المزيد"}
                            </span>
                        </button>
                    </li>
                </ul>

                {/* More Menu Dropdown */}
                <div className={`absolute bottom-16 left-2 right-2 bg-popover border border-border rounded-2xl p-2 shadow-2xl transition-all duration-300 ease-out ${showMore ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95 pointer-events-none"}`}>
                    {[
                        { id: "pumps", icon: Settings, label: t("nav_pumps") },
                        { id: "ai_assistant", icon: Sparkles, label: t("nav_ai_assistant") },
                        { id: "reports", icon: FileText, label: t("nav_reports") }
                    ].map((item, idx) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setActivePage(item.id);
                                setShowMore(false);
                            }}
                            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                                activePage === item.id 
                                    ? "bg-primary/10 text-primary" 
                                    : "text-foreground hover:bg-accent"
                            }`}
                            style={{ transitionDelay: showMore ? `${idx * 50}ms` : '0ms' }}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="mr-3 font-medium text-sm">{item.label}</span>
                        </button>
                    ))}
                    <div className="border-t border-border my-2"></div>
                    <button
                        onClick={switchLocale}
                        className="w-full flex items-center px-4 py-3 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200"
                    >
                        <Globe className="w-5 h-5" />
                        <span className="mr-3 font-medium text-sm">{locale === 'ar' ? 'العربية' : 'Français'}</span>
                    </button>
                </div>
            </nav>
        </>
    );
}
