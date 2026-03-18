"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Power, X, Clock } from "lucide-react";

interface ControlConfirmDialogProps {
    zoneName: string;
    action: "start_irrigation" | "stop_irrigation";
    loading: boolean;
    onConfirm: (durationMinutes?: number) => void;
    onCancel: () => void;
}

export function ControlConfirmDialog({ zoneName, action, loading, onConfirm, onCancel }: ControlConfirmDialogProps) {
    const t = useTranslations("DeviceControl");
    const [duration, setDuration] = useState<string>("");
    const isStart = action === "start_irrigation";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md mx-4 p-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isStart ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"
                        }`}>
                            <Power className={`w-5 h-5 ${isStart ? "text-emerald-600" : "text-red-600"}`} />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">
                            {isStart ? t("start_irrigation") : t("stop_irrigation")}
                        </h3>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                    {isStart ? t("confirm_start", { zone: zoneName }) : t("confirm_stop", { zone: zoneName })}
                </p>

                {isStart && (
                    <div className="mb-4">
                        <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                            <Clock className="w-4 h-4" />
                            {t("duration_label") || "Duration (minutes, optional)"}
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="480"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            placeholder="∞"
                            className="w-full px-4 py-2.5 rounded-xl border border-input bg-background focus:border-primary focus:outline-none font-medium"
                        />
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={() => onConfirm(duration ? parseInt(duration) : undefined)}
                        disabled={loading}
                        className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 ${
                            isStart
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "bg-red-600 text-white hover:bg-red-700"
                        }`}
                    >
                        {loading ? "..." : (isStart ? t("start_irrigation") : t("stop_irrigation"))}
                    </button>
                    <button
                        onClick={onCancel}
                        className="px-4 py-2.5 rounded-xl font-bold text-sm bg-muted text-muted-foreground hover:bg-accent transition-colors"
                    >
                        {t("cancel") || "Cancel"}
                    </button>
                </div>
            </div>
        </div>
    );
}
