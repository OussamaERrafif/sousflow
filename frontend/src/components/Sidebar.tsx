"use client";

import { Home, Leaf, Bell, Settings, Activity, FileText, Globe, LogIn, LogOut, User, Sparkles } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { useSignOutMutation } from "@/lib/store/apiSlice";
import { logout } from "@/lib/store/slices/authSlice";
import { useEffect } from "react";

export default function Sidebar({ activePage, setActivePage }: { activePage: string, setActivePage: (id: string) => void }) {
    const t = useTranslations("Sidebar");
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const dispatch = useAppDispatch();
    const { isAuthenticated, user } = useAppSelector((state) => state.auth);
    const [signOut] = useSignOutMutation();

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
                className={`w-full flex items-center px-5 py-3.5 transition-all rounded-xl mx-2 my-1 ${isActive
                    ? "bg-[#3D1F0F] text-[#C17A3A]"
                    : "text-[#8B7355] hover:bg-[#3D1F0F]/50 hover:text-white"
                    }`}
                style={{ width: "calc(100% - 16px)" }}
            >
                <div className="relative">
                    <Icon className="w-5 h-5 shrink-0" />
                    {badge && (
                        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[20px] h-5">
                            {badge}
                        </span>
                    )}
                </div>
                <div className="rtl:mr-4 ltr:ml-4 flex-1 text-start">
                    <span className="font-bold text-sm leading-tight">{label}</span>
                </div>
                {/* Active Indicator replacing the old full-height border */}
                {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#C17A3A] rtl:mr-2 ltr:ml-2"></div>
                )}
            </button>
        );
    };

    return (
        <>
            <aside className="hidden md:flex flex-col w-60 fixed top-0 ltr:left-0 rtl:right-0 h-screen bg-[#2C1810] text-[#F5F0E8] rtl:border-l ltr:border-r border-[#4A2C1A] overflow-y-auto z-50">
                <div className="p-5 border-b border-[#4A2C1A] flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-black text-white">{t("title")}</h1>
                        <p className="text-[#8B7355] text-[11px] mt-1 uppercase tracking-wider">{t("subtitle")}</p>
                    </div>
                </div>

                <div className="p-5 border-b border-[#4A2C1A]">
                    <div className="bg-[#3D1F0F]/30 p-3 rounded-xl border border-[#4A2C1A]/50">
                        <p className="text-white font-bold text-sm tracking-wide">{t("farmName")}</p>
                        <p className="text-[#8B7355] text-xs mt-1">{t("farmInfo")}</p>
                    </div>
                </div>

                <nav className="flex-1 py-4 flex flex-col gap-2">
                    <div className="mb-2">
                        {renderMenuButton("dashboard", Home, t("nav_dashboard"))}
                    </div>

                    <div className="px-5 mb-1 mt-2 border-t border-[#4A2C1A] pt-4">
                        <p className="text-[10px] font-bold text-[#8B7355] uppercase tracking-wider mx-2">العمليات</p>
                    </div>
                    {renderMenuButton("zones", Leaf, t("nav_zones"))}
                    {renderMenuButton("pumps", Settings, t("nav_pumps"))}

                    <div className="px-5 mb-1 mt-2 border-t border-[#4A2C1A] pt-4">
                        <p className="text-[10px] font-bold text-[#8B7355] uppercase tracking-wider mx-2">النظام</p>
                    </div>
                    {renderMenuButton("ai_assistant", Sparkles, t("nav_ai_assistant"))}
                    {renderMenuButton("alerts", Bell, t("nav_alerts"), 2)}
                    {renderMenuButton("reports", FileText, t("nav_reports"))}

                    <div className="mt-auto px-5 mb-1 pt-4">
                        {renderMenuButton("settings", Activity, t("nav_settings"))}
                    </div>
                </nav>

                <div className="p-5 border-t border-[#4A2C1A]">
                    {isAuthenticated && user ? (
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-[#C17A3A] rounded-full flex items-center justify-center">
                                    <User className="w-4 h-4 text-white" />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-white font-bold text-sm truncate">{user.full_name || user.username}</p>
                                    <p className="text-[#8B7355] text-xs truncate">{user.username}</p>
                                </div>
                            </div>
                        </div>
                    ) : null}
                    <div className="flex justify-between items-center">
                        {isAuthenticated ? (
                            <div className="flex items-center">
                                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shrink-0"></div>
                                <p className="rtl:mr-2 ltr:ml-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">{t("status")}</p>
                            </div>
                        ) : (
                            <div className="flex items-center">
                                <div className="w-2 h-2 bg-zinc-400 rounded-full shrink-0"></div>
                                <p className="rtl:mr-2 ltr:ml-2 text-zinc-400 text-xs font-bold uppercase tracking-wider">Not logged in</p>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={switchLocale}
                                className="p-1.5 bg-[#3D1F0F] rounded-lg text-[#8B7355] hover:text-white transition-colors flex items-center gap-1.5"
                                title="Switch Language"
                            >
                                <Globe className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase">{locale === 'ar' ? 'FR' : 'AR'}</span>
                            </button>
                            <button
                                onClick={handleAuthClick}
                                className="p-1.5 bg-[#3D1F0F] rounded-lg text-[#8B7355] hover:text-white transition-colors flex items-center gap-1.5"
                                title={isAuthenticated ? "Sign Out" : "Sign In"}
                            >
                                {isAuthenticated ? <LogOut className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#2C1810] border-t border-[#4A2C1A] z-50 px-2 pb-safe pt-1 shadow-[0_-8px_30px_rgb(0,0,0,0.12)]">
                <ul className="flex justify-between items-center h-16">
                    {[
                        { id: "dashboard", icon: Home, label: t("nav_dashboard") },
                        { id: "zones", icon: Leaf, label: t("nav_zones") },
                        { id: "alerts", icon: Bell, label: t("nav_alerts"), badge: 2 },
                        { id: "settings", icon: Activity, label: t("nav_settings") }
                    ].map((item) => (
                        <li key={item.id} className="flex-1 h-full">
                            <button
                                onClick={() => setActivePage(item.id)}
                                className="w-full h-full flex flex-col items-center justify-center relative rounded-xl hover:bg-[#3D1F0F]/50 transition-colors"
                            >
                                <item.icon className={`w-5 h-5 ${activePage === item.id ? "text-[#C17A3A]" : "text-[#8B7355]"}`} />
                                <span className={`text-[10px] mt-1 font-bold ${activePage === item.id ? "text-[#C17A3A]" : "text-[#8B7355]"}`}>
                                    {item.label}
                                </span>
                                {item.badge && (
                                    <span className="absolute top-1 right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                                        {item.badge}
                                    </span>
                                )}
                            </button>
                        </li>
                    ))}
                    <li className="flex-1 h-full">
                        <button
                            onClick={switchLocale}
                            className="w-full h-full flex flex-col items-center justify-center relative rounded-xl hover:bg-[#3D1F0F]/50 transition-colors"
                        >
                            <Globe className="w-5 h-5 text-[#8B7355]" />
                            <span className="text-[10px] mt-1 font-bold text-[#8B7355]">
                                {locale === 'ar' ? 'FR' : 'AR'}
                            </span>
                        </button>
                    </li>
                </ul>
            </nav>
        </>
    );
}
