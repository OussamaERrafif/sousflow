"use client";
import { useState } from "react";

const ALERTS = [
  {
    id: 1,
    type: "critical",
    icon: "🚨",
    titleAr: "تسرب مياه — القطاع 5",
    titleFr: "Fuite d'eau — Zone 5",
    descAr: "انخفاض حاد في الضغط مع ارتفاع في التدفق",
    descFr: "Chute de pression + hausse du débit détectées",
    time: "منذ 8 دقائق",
    timeFr: "Il y a 8 min",
    read: false,
  },
  {
    id: 2,
    type: "warning",
    icon: "⚠️",
    titleAr: "انسداد في القطاع 3",
    titleFr: "Bouchage Zone 3",
    descAr: "ضغط مرتفع مع تدفق منخفض — الجير يسد الموزعات",
    descFr: "Pression élevée, débit faible — calcaire",
    time: "منذ 25 دقيقة",
    timeFr: "Il y a 25 min",
    read: false,
  },
  {
    id: 3,
    type: "info",
    icon: "💡",
    titleAr: "نصيحة الري اليوم",
    titleFr: "Conseil du jour",
    descAr: "ري مبكر الصباح يوفر 20% من الماء بسبب الحرارة",
    descFr: "Irriguer tôt le matin économise 20% d'eau",
    time: "الصباح",
    timeFr: "Ce matin",
    read: true,
  },
  {
    id: 4,
    type: "success",
    icon: "✅",
    titleAr: "تم توفير 340 لتر اليوم",
    titleFr: "340L économisés aujourd'hui",
    descAr: "الذكاء الاصطناعي أوقف الري في الوقت المناسب",
    descFr: "L'IA a optimisé le cycle d'irrigation",
    time: "أمس",
    timeFr: "Hier",
    read: true,
  },
];

const alertStyles = {
  critical: "bg-red-50 border-red-300",
  warning: "bg-amber-50 border-amber-300",
  info: "bg-sky-50 border-sky-200",
  success: "bg-emerald-50 border-emerald-200",
};

export default function AlertPanel() {
  const [alerts, setAlerts] = useState(ALERTS);

  const markRead = (id) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read: true } : a))
    );
  };

  const unread = alerts.filter((a) => !a.read).length;

  return (
    <div className="mb-24 md:mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black text-[#2C1810]">
          التنبيهات{" "}
          {unread > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 ml-2">
              {unread}
            </span>
          )}
        </h2>
        <span className="text-sm text-[#8B7355]">Alertes récentes</span>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`rounded-2xl border-2 ${alertStyles[alert.type]} p-4 transition-all
              ${!alert.read ? "shadow-md" : "opacity-70"}
            `}
          >
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl flex-shrink-0">
                {alert.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-black text-[#2C1810] text-sm">
                    {alert.titleAr}
                  </h3>
                  <span className="text-xs text-[#8B7355] flex-shrink-0">
                    {alert.time}
                  </span>
                </div>
                <p className="text-xs text-[#5A4A3A] font-medium mt-0.5">
                  {alert.titleFr}
                </p>
                <p className="text-xs text-[#8B7355] mt-1">{alert.descFr}</p>
              </div>
            </div>

            {!alert.read && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-white/50">
                <button
                  onClick={() => markRead(alert.id)}
                  className="flex-1 bg-white rounded-xl py-2 text-xs font-bold text-[#2C1810] shadow-sm hover:bg-[#F5F0E8] transition-colors"
                >
                  تم الاطلاع · Lu
                </button>
                {(alert.type === "critical" || alert.type === "warning") && (
                  <button className="flex-1 bg-[#2C1810] rounded-xl py-2 text-xs font-bold text-white hover:bg-[#C17A3A] transition-colors">
                    إرسال للتقني · Appeler technicien
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
