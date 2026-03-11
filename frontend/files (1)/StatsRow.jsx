"use client";

const STATS = [
  {
    icon: "💧",
    value: "73%",
    labelAr: "توفير الماء",
    labelFr: "Eau économisée",
    trend: "+5%",
    trendUp: true,
    color: "bg-sky-50 border-sky-200",
    iconBg: "bg-sky-100",
  },
  {
    icon: "⚡",
    value: "57%",
    labelAr: "توفير الطاقة",
    labelFr: "Énergie économisée",
    trend: "+3%",
    trendUp: true,
    color: "bg-amber-50 border-amber-200",
    iconBg: "bg-amber-100",
  },
  {
    icon: "🌡️",
    value: "28°C",
    labelAr: "درجة الحرارة",
    labelFr: "Température",
    trend: "حار",
    trendUp: false,
    color: "bg-red-50 border-red-200",
    iconBg: "bg-red-100",
  },
  {
    icon: "🌱",
    value: "6/8",
    labelAr: "قطاعات نشطة",
    labelFr: "Zones actives",
    trend: "جيد",
    trendUp: true,
    color: "bg-emerald-50 border-emerald-200",
    iconBg: "bg-emerald-100",
  },
];

export default function StatsRow() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {STATS.map((stat, i) => (
        <div
          key={i}
          className={`rounded-2xl border-2 ${stat.color} p-4 bg-white shadow-sm hover:shadow-md transition-shadow`}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center text-xl`}
            >
              {stat.icon}
            </div>
            <span
              className={`text-xs font-bold px-2 py-1 rounded-full ${
                stat.trendUp
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {stat.trend}
            </span>
          </div>
          <p className="text-3xl font-black text-[#2C1810]">{stat.value}</p>
          <p className="text-sm font-bold text-[#5A4A3A] mt-1">{stat.labelAr}</p>
          <p className="text-xs text-[#8B7355]">{stat.labelFr}</p>
        </div>
      ))}
    </div>
  );
}
