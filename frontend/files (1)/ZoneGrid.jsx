"use client";
import { useState } from "react";

const ZONES = [
  {
    id: 1,
    name: "القطاع 1",
    nameFr: "Zone 1 — Orangers",
    status: "good",
    pressure: "3.2 bar",
    flow: "12 L/min",
    moisture: 72,
    active: true,
  },
  {
    id: 2,
    name: "القطاع 2",
    nameFr: "Zone 2 — Tomates",
    status: "good",
    pressure: "3.1 bar",
    flow: "11 L/min",
    moisture: 65,
    active: true,
  },
  {
    id: 3,
    name: "القطاع 3",
    nameFr: "Zone 3 — Agrumes",
    status: "warning",
    pressure: "4.8 bar",
    flow: "4 L/min",
    moisture: 38,
    active: true,
    alert: "انسداد في الموزعات",
    alertFr: "Bouchage détecté",
  },
  {
    id: 4,
    name: "القطاع 4",
    nameFr: "Zone 4 — Courgettes",
    status: "good",
    pressure: "3.0 bar",
    flow: "10 L/min",
    moisture: 80,
    active: false,
  },
  {
    id: 5,
    name: "القطاع 5",
    nameFr: "Zone 5 — Piment",
    status: "critical",
    pressure: "1.2 bar",
    flow: "18 L/min",
    moisture: 20,
    active: true,
    alert: "تسرب مياه — الخط 5",
    alertFr: "Fuite d'eau ligne 5",
  },
  {
    id: 6,
    name: "القطاع 6",
    nameFr: "Zone 6 — Pastèques",
    status: "good",
    pressure: "3.3 bar",
    flow: "13 L/min",
    moisture: 68,
    active: true,
  },
  {
    id: 7,
    name: "القطاع 7",
    nameFr: "Zone 7 — Oliviers",
    status: "good",
    pressure: "2.9 bar",
    flow: "9 L/min",
    moisture: 55,
    active: false,
  },
  {
    id: 8,
    name: "القطاع 8",
    nameFr: "Zone 8 — Fèves",
    status: "off",
    pressure: "—",
    flow: "—",
    moisture: 45,
    active: false,
  },
];

const statusConfig = {
  good: {
    label: "بخير",
    labelFr: "OK",
    dot: "bg-emerald-400",
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    icon: "✅",
  },
  warning: {
    label: "تنبيه",
    labelFr: "Attention",
    dot: "bg-amber-400 animate-pulse",
    border: "border-amber-300",
    badge: "bg-amber-100 text-amber-700",
    icon: "⚠️",
  },
  critical: {
    label: "خطر",
    labelFr: "Critique",
    dot: "bg-red-500 animate-pulse",
    border: "border-red-300",
    badge: "bg-red-100 text-red-700",
    icon: "🚨",
  },
  off: {
    label: "متوقف",
    labelFr: "Arrêté",
    dot: "bg-gray-300",
    border: "border-gray-200",
    badge: "bg-gray-100 text-gray-500",
    icon: "⏸️",
  },
};

function MoistureBar({ value, status }) {
  const color =
    value >= 60
      ? "bg-emerald-400"
      : value >= 40
      ? "bg-amber-400"
      : "bg-red-400";
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-[#8B7355]">رطوبة التربة</span>
        <span className="text-xs font-black text-[#2C1810]">{value}%</span>
      </div>
      <div className="h-2.5 bg-[#E8DFD0] rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function ZoneGrid() {
  const [selected, setSelected] = useState(null);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black text-[#2C1810]">
          القطاعات · <span className="text-[#8B7355] font-medium text-base">Zones d'irrigation</span>
        </h2>
        <span className="text-sm text-[#8B7355]">8 قطاعات</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {ZONES.map((zone) => {
          const sc = statusConfig[zone.status];
          const isSelected = selected === zone.id;

          return (
            <div
              key={zone.id}
              onClick={() => setSelected(isSelected ? null : zone.id)}
              className={`bg-white rounded-2xl border-2 ${sc.border} p-5 cursor-pointer 
                hover:shadow-lg transition-all duration-200 relative overflow-hidden
                ${isSelected ? "ring-2 ring-[#C17A3A] ring-offset-2" : ""}`}
            >
              {/* Status dot */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${sc.dot}`} />
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${sc.badge}`}
                  >
                    {sc.icon} {sc.label}
                  </span>
                </div>
                {/* Toggle switch */}
                <div
                  className={`w-11 h-6 rounded-full transition-colors ${
                    zone.active ? "bg-emerald-400" : "bg-gray-200"
                  } flex items-center px-1`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      zone.active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>

              {/* Zone name */}
              <h3 className="text-lg font-black text-[#2C1810]">{zone.name}</h3>
              <p className="text-xs text-[#8B7355] mb-4">{zone.nameFr}</p>

              {/* Alert message */}
              {zone.alert && (
                <div
                  className={`rounded-xl p-3 mb-4 text-xs font-bold ${
                    zone.status === "critical"
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {zone.icon} {zone.alert}
                  <br />
                  <span className="font-normal opacity-80">{zone.alertFr}</span>
                </div>
              )}

              {/* Moisture */}
              <MoistureBar value={zone.moisture} status={zone.status} />

              {/* Expanded details */}
              {isSelected && (
                <div className="mt-4 pt-4 border-t border-[#E8DFD0] grid grid-cols-2 gap-3">
                  <div className="bg-[#F5F0E8] rounded-xl p-3 text-center">
                    <p className="text-2xl">🔩</p>
                    <p className="text-lg font-black text-[#2C1810]">
                      {zone.pressure}
                    </p>
                    <p className="text-xs text-[#8B7355]">الضغط · Pression</p>
                  </div>
                  <div className="bg-[#F5F0E8] rounded-xl p-3 text-center">
                    <p className="text-2xl">💧</p>
                    <p className="text-lg font-black text-[#2C1810]">
                      {zone.flow}
                    </p>
                    <p className="text-xs text-[#8B7355]">التدفق · Débit</p>
                  </div>
                </div>
              )}

              {/* Tap hint */}
              {!isSelected && (
                <p className="text-center text-[10px] text-[#C4B49A] mt-3">
                  اضغط للتفاصيل · Appuyer pour plus
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
