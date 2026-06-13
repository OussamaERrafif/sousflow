"use client";

import { Home, Leaf, Bell, Settings, Activity, FileText, LogIn, LogOut, User, Sparkles, Map, Cpu, Heart, Menu } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
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
    const { anomalyCount, activeCriticalAnomalies } = useAppSelector((state) => state.iot);
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
        window.location.href = "/login";
    };

    const handleAuthClick = () => {
        if (isAuthenticated) {
            handleSignOut();
        } else {
            window.location.href = "/login";
        }
    };

    const renderMenuButton = (id: string, icon: any, label: string, badge?: number, badgeCritical?: boolean) => {
        const Icon = icon;
        const isActive = activePage === id;
        return (
            <button
                onClick={() => setActivePage(id)}
                className={`w-full flex items-center px-4 py-2.5 transition-all duration-200 rounded-xl mx-2 my-0.5 group ${isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                    }`}
                style={{ width: "calc(100% - 16px)" }}
                aria-current={isActive ? "page" : undefined}
                role="link"
            >
                <div className="relative">
                    <Icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? "text-primary" : "group-hover:text-primary"}`} aria-hidden="true" />
                    {badge && (
                        <span className={`absolute -top-1.5 -right-1.5 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[18px] h-[18px] ${badgeCritical ? "bg-red-500 animate-pulse" : "bg-destructive"}`} aria-label={`${badge} notifications`}>
                            {badge}
                        </span>
                    )}
                </div>
                <div className="rtl:mr-3 ltr:ml-3 flex-1 text-start">
                    <span className={`font-medium text-sm leading-tight ${isActive ? "text-sidebar-foreground" : ""}`}>{label}</span>
                </div>
                {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary rtl:mr-2 ltr:ml-2" aria-hidden="true"></div>
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
            <aside className="hidden md:flex flex-col w-64 fixed top-0 ltr:left-0 rtl:right-0 h-screen bg-sidebar text-sidebar-foreground ltr:border-r rtl:border-l border-sidebar-border overflow-hidden z-50">
                {/* Logo Section */}
                <div className="p-5 border-b border-sidebar-border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                            <Leaf className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
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

                    {renderSectionHeader(t("section_operations"))}
                    {renderMenuButton("zones", Leaf, t("nav_zones"))}
                    {renderMenuButton("pumps", Settings, t("nav_pumps"))}
                    {renderMenuButton("map", Map, t("nav_map"))}
                    {renderMenuButton("iot_devices", Cpu, t("nav_iot_devices"))}

                    {renderSectionHeader(t("section_monitoring"))}
                    {renderMenuButton("alerts", Bell, t("nav_alerts"), anomalyCount > 0 ? anomalyCount : undefined, activeCriticalAnomalies > 0)}
                    {renderMenuButton("reports", FileText, t("nav_reports"))}
                    {renderMenuButton("system_health", Heart, t("nav_system_health"))}

                    {renderSectionHeader(t("section_system"))}
                    {renderMenuButton("ai_assistant", Sparkles, t("nav_ai_assistant"))}
                    {renderMenuButton("settings", Activity, t("nav_settings"))}
                </nav>

                {/* User Section */}
                <div className="p-4 border-t border-sidebar-border space-y-3">
                    {/* User identity */}
                    {isAuthenticated && user ? (
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-primary-foreground" />
                            </div>
                            <div className="overflow-hidden flex-1">
                                <p className="text-foreground font-semibold text-sm truncate">{user.full_name || user.username}</p>
                                <p className="text-muted-foreground text-xs truncate">{user.username}</p>
                            </div>
                        </div>
                    ) : null}

                    {/* Row 1: Connection status — full width, never truncated */}
                    {isAuthenticated ? (
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0"></div>
                            <p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wide">{t("status")}</p>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-muted-foreground/40 rounded-full shrink-0"></div>
                            <p className="text-muted-foreground text-xs font-bold uppercase tracking-wide">{t("not_logged_in")}</p>
                        </div>
                    )}

                    {/* Row 2: Language toggle + logout — always has room */}
                    <div className="flex items-center gap-2">
                        {/* Language pill — always LTR so FR|ع order never flips */}
                        <button
                            onClick={switchLocale}
                            dir="ltr"
                            className="flex-1 flex items-center bg-sidebar-accent rounded-full p-0.5 border border-sidebar-border hover:border-primary/40 transition-all duration-300"
                            aria-label={locale === "ar" ? "Passer en Français" : "التبديل إلى العربية"}
                        >
                            <span className={`flex-1 text-center px-2 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${locale === 'fr' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                                }`}>FR</span>
                            <span className={`flex-1 text-center px-2 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${locale === 'ar' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                                }`}>ع</span>
                        </button>

                        {/* Logout / Login button */}
                        <button
                            onClick={handleAuthClick}
                            className="w-9 h-9 flex items-center justify-center bg-sidebar-accent rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/70 transition-colors shrink-0"
                            aria-label={isAuthenticated ? t("logout") : t("login")}
                            title={isAuthenticated ? t("logout") : t("login")}
                        >
                            {isAuthenticated
                                ? <LogOut className="w-4 h-4" aria-hidden="true" />
                                : <LogIn className="w-4 h-4" aria-hidden="true" />}
                        </button>
                    </div>
                </div>


            </aside>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-sidebar border-t-2 border-sidebar-border z-50 px-1 pb-2 pt-1 shadow-2xl">
                <ul className="flex justify-between items-center h-20">
                    {[
                        { id: "dashboard", icon: Home, label: t("nav_dashboard") },
                        { id: "zones", icon: Leaf, label: t("nav_zones") },
                        { id: "map", icon: Map, label: t("nav_map") },
                        { id: "alerts", icon: Bell, label: t("nav_alerts"), badge: anomalyCount > 0 ? anomalyCount : undefined },
                        { id: "settings", icon: Activity, label: t("nav_settings") }
                    ].map((item) => (
                        <li key={item.id} className="flex-1 h-full">
                            <button
                                onClick={() => setActivePage(item.id)}
                                className="w-full h-full flex flex-col items-center justify-center relative"
                                aria-current={activePage === item.id ? "page" : undefined}
                            >
                                <div className={`w-12 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 ${activePage === item.id ? "bg-primary/15" : ""}`}>
                                    <item.icon className={`w-6 h-6 transition-colors ${activePage === item.id ? "text-primary" : "text-muted-foreground"}`} strokeWidth={activePage === item.id ? 2.5 : 2} />
                                    {item.badge && (
                                        <span className="absolute top-0 ltr:right-1 rtl:left-1 bg-destructive text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                            {item.badge}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[11px] font-bold mt-0.5 leading-none ${activePage === item.id ? "text-primary" : "text-muted-foreground"}`}>
                                    {item.label}
                                </span>
                            </button>
                        </li>
                    ))}
                    <li className="flex-1 h-full">
                        <button
                            onClick={() => setShowMore(!showMore)}
                            className="w-full h-full flex flex-col items-center justify-center"
                        >
                            <div className={`w-12 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 ${showMore ? "bg-primary text-white" : "text-muted-foreground"}`}>
                                <Menu className={`w-6 h-6 transition-transform duration-300 ${showMore ? "rotate-90" : ""}`} />
                            </div>
                            <span className={`text-[11px] font-bold mt-0.5 leading-none transition-colors ${showMore ? "text-primary" : "text-muted-foreground"}`}>
                                {showMore ? t("close") : t("more")}
                            </span>
                        </button>
                    </li>
                </ul>

                {/* More Menu Dropdown */}
                <div className={`absolute bottom-[88px] inset-x-2 bg-popover border border-border rounded-2xl p-2 shadow-2xl transition-all duration-300 ease-out ${showMore ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95 pointer-events-none"}`}>
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
                            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${activePage === item.id
                                    ? "bg-primary/10 text-primary"
                                    : "text-foreground hover:bg-accent"
                                }`}
                            style={{ transitionDelay: showMore ? `${idx * 50}ms` : '0ms' }}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="ltr:ml-3 rtl:mr-3 font-medium text-sm">{item.label}</span>
                        </button>
                    ))}
                    <div className="border-t border-border my-2"></div>
                    {/* Language pill toggle */}
                    <div className="px-2 py-1">
                        <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-2 px-1">
                            {locale === 'ar' ? 'اللغة' : 'Langue'}
                        </p>
                        <button
                            onClick={switchLocale}
                            className="w-full flex items-center bg-sidebar-accent border border-sidebar-border rounded-2xl p-1.5 gap-1 hover:border-primary/30 transition-all duration-300"
                            aria-label={locale === "ar" ? "Passer en Français" : "التبديل إلى العربية"}
                        >
                            <span className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${locale === 'fr'
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'text-muted-foreground'
                                }`}>
                                🇫🇷 Français
                            </span>
                            <span className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${locale === 'ar'
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'text-muted-foreground'
                                }`}>
                                🇲🇦 العربية
                            </span>
                        </button>
                    </div>
                    <div className="border-t border-border mt-2 pt-1">
                        <button
                            onClick={() => {
                                setShowMore(false);
                                handleAuthClick();
                            }}
                            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                                isAuthenticated
                                    ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    : "text-foreground hover:bg-accent"
                            }`}
                        >
                            {isAuthenticated
                                ? <LogOut className="w-5 h-5" />
                                : <LogIn className="w-5 h-5" />}
                            <span className="ltr:ml-3 rtl:mr-3 font-medium text-sm">
                                {isAuthenticated ? t("logout") : t("login")}
                            </span>
                        </button>
                    </div>
                </div>
            </nav>
        </>
    );
}
