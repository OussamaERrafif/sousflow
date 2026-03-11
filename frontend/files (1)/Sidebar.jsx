"use client";

const NAV_ITEMS = [
  { id: "dashboard", icon: "🏠", label: "الرئيسية", labelFr: "Accueil" },
  { id: "zones", icon: "🌿", label: "القطاعات", labelFr: "Zones" },
  { id: "alerts", icon: "🔔", label: "التنبيهات", labelFr: "Alertes", badge: 2 },
  { id: "pumps", icon: "⚙️", label: "المضخات", labelFr: "Pompes" },
  { id: "reports", icon: "📊", label: "التقارير", labelFr: "Rapports" },
  { id: "settings", icon: "🔧", label: "الإعدادات", labelFr: "Paramètres" },
];

export default function Sidebar({ activePage, setActivePage }) {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed top-0 left-0 h-full w-64 bg-[#2C1810] hidden md:flex flex-col z-40">
        {/* Logo */}
        <div className="p-6 border-b border-[#4A2C1A]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C17A3A] flex items-center justify-center text-xl">
              💧
            </div>
            <div>
              <p className="text-white font-black text-base leading-tight">
                AQUA
              </p>
              <p className="text-[#8B7355] text-xs font-medium">Smart Irrigation</p>
            </div>
          </div>
        </div>

        {/* Farm Info */}
        <div className="mx-4 mt-5 p-4 rounded-2xl bg-[#3D1F0F] border border-[#4A2C1A]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌾</span>
            <div>
              <p className="text-white font-bold text-sm">مزرعة الأمل</p>
              <p className="text-[#8B7355] text-xs">Souss-Massa · 12 هكتار</p>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 group relative ${
                activePage === item.id
                  ? "bg-[#C17A3A] text-white shadow-lg shadow-[#C17A3A]/30"
                  : "text-[#8B9E8A] hover:bg-[#3D1F0F] hover:text-white"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <div className="flex-1 text-right">
                <p
                  className={`font-bold text-sm ${
                    activePage === item.id ? "text-white" : ""
                  }`}
                >
                  {item.label}
                </p>
                <p
                  className={`text-xs mt-0.5 ${
                    activePage === item.id
                      ? "text-orange-200"
                      : "text-[#5A6A5A]"
                  }`}
                >
                  {item.labelFr}
                </p>
              </div>
              {item.badge && (
                <span className="absolute left-3 top-3 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom status */}
        <div className="p-4 border-t border-[#4A2C1A]">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#3D1F0F]">
            <div className="w-8 h-8 rounded-full bg-emerald-900 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div>
              <p className="text-white text-xs font-bold">LoRaWAN</p>
              <p className="text-emerald-400 text-xs">متصل · 18 جهاز</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#2C1810] flex md:hidden z-40 px-2 py-2 gap-1">
        {NAV_ITEMS.slice(0, 5).map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={`flex-1 flex flex-col items-center py-2 px-1 rounded-xl transition-all ${
              activePage === item.id
                ? "bg-[#C17A3A]"
                : "text-[#8B7355]"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span
              className={`text-[9px] mt-0.5 font-bold ${
                activePage === item.id ? "text-white" : "text-[#8B7355]"
              }`}
            >
              {item.labelFr}
            </span>
          </button>
        ))}
      </nav>
    </>
  );
}
