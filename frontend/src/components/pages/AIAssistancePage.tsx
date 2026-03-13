"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { 
    MessageCircle, 
    Send, 
    Bot, 
    User, 
    Loader2, 
    Sparkles, 
    Droplets, 
    Thermometer, 
    Leaf, 
    AlertTriangle,
    Wind,
    Sun,
    Clock,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Zap
} from "lucide-react";
import { useAppSelector } from "@/lib/store/hooks";
import { useChatApiAiChatPostMutation, useGetChatHistoryApiAiChatConversationIdGetQuery } from "@/lib/store/generated/api";

interface Message {
    role: "user" | "assistant";
    content: string;
    created_at?: string;
}

const SUGGESTIONS = [
    { key: "suggestion1", icon: Droplets, labelKey: "suggestion1" },
    { key: "suggestion2", icon: Thermometer, labelKey: "suggestion2" },
    { key: "suggestion3", icon: AlertTriangle, labelKey: "suggestion3" },
    { key: "suggestion4", icon: Leaf, labelKey: "suggestion4" },
];

export default function AIAssistancePage() {
    const t = useTranslations("AIAssistant");
    const { readings, lastUpdate, connected } = useAppSelector((state) => state.iot);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showDataPanel, setShowDataPanel] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const [sendMessage] = useChatApiAiChatPostMutation();
    
    const { data: history } = useGetChatHistoryApiAiChatConversationIdGetQuery(
        { conversationId: conversationId! },
        { skip: !conversationId }
    );

    useEffect(() => {
        if (history && history.length > 0) {
            setMessages(history.map((msg: any) => ({
                role: msg.role as "user" | "assistant",
                content: msg.content,
                created_at: msg.created_at
            })));
        }
    }, [history]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setIsLoading(true);

        setMessages(prev => [...prev, { role: "user", content: userMessage }]);

        try {
            const result: any = await sendMessage({
                chatRequest: {
                    message: userMessage,
                    conversation_id: conversationId || undefined
                }
            }).unwrap();

            if (result.conversation_id && !conversationId) {
                setConversationId(result.conversation_id);
            }

            setMessages(prev => [...prev, { 
                role: "assistant", 
                content: result.response 
            }]);
        } catch (error) {
            setMessages(prev => [...prev, { 
                role: "assistant", 
                content: t("errorMessage") 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleSuggestion = (suggestion: string) => {
        setInput(suggestion);
        inputRef.current?.focus();
    };

    const formatTimestamp = (timestamp?: string) => {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) return t("justNow");
        if (minutes < 60) return t("minutesAgo", { min: minutes });
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return t("hoursAgo", { hour: hours });
        return date.toLocaleDateString();
    };

    const getQuickSuggestions = () => [
        t("suggestion1"),
        t("suggestion2"),
        t("suggestion3"),
        t("suggestion4")
    ];

    const getLatestReading = () => {
        if (!readings || readings.length === 0) return null;
        return readings[0];
    };

    const latestReading = getLatestReading();

    return (
        <div className="w-full">
            <div className="mb-6">
                <h1 className="text-3xl font-black text-zinc-800 tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C17A3A] to-[#8B5A2B] flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    {t("title")}
                </h1>
                <p className="text-zinc-500 font-bold mt-1">{t("subtitle")}</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)] min-h-[500px]">
                {/* Chat Area */}
                <div className="flex-1 flex flex-col bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                    {/* Chat Header */}
                    <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-700 flex items-center justify-between bg-gradient-to-r from-[#3D1F0F]/5 to-transparent">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#C17A3A]/10 flex items-center justify-center">
                                <Bot className="w-4 h-4 text-[#C17A3A]" />
                            </div>
                            <div>
                                <h2 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">SoussFlow AI</h2>
                                <p className="text-xs text-emerald-600 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                    {t("online")}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <Clock className="w-3.5 h-3.5" />
                            {t("dataFreshness")}
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 && (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#C17A3A]/20 to-[#8B5A2B]/10 flex items-center justify-center">
                                    <Sparkles className="w-8 h-8 text-[#C17A3A]" />
                                </div>
                                <h3 className="font-black text-zinc-800 dark:text-zinc-100 text-lg mb-2">{t("welcomeTitle")}</h3>
                                <p className="text-zinc-500 text-sm max-w-xs mx-auto mb-6">{t("welcomeDesc")}</p>
                                
                                <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                                    {SUGGESTIONS.map((s) => (
                                        <button
                                            key={s.key}
                                            onClick={() => handleSuggestion(t(s.labelKey))}
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-700/50 hover:bg-[#C17A3A]/10 hover:border-[#C17A3A]/30 border border-zinc-200 dark:border-zinc-600 transition-colors text-start"
                                        >
                                            <s.icon className="w-4 h-4 text-[#C17A3A]" />
                                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 truncate">{t(s.labelKey)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div 
                                key={idx} 
                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                        msg.role === "user" 
                                            ? "bg-[#3D1F0F]" 
                                            : "bg-gradient-to-br from-[#C17A3A] to-[#8B5A2B]"
                                    }`}>
                                        {msg.role === "user" ? (
                                            <User className="w-4 h-4 text-white" />
                                        ) : (
                                            <Bot className="w-4 h-4 text-white" />
                                        )}
                                    </div>
                                    <div className={`px-4 py-3 rounded-2xl ${
                                        msg.role === "user"
                                            ? "bg-[#3D1F0F] text-white rounded-tr-sm"
                                            : "bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 rounded-tl-sm"
                                    }`}>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                        {msg.created_at && (
                                            <p className={`text-[10px] mt-2 ${msg.role === "user" ? "text-white/50" : "text-zinc-400"}`}>
                                                {formatTimestamp(msg.created_at)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#C17A3A] to-[#8B5A2B] flex items-center justify-center">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="px-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-700 rounded-tl-sm">
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 text-[#C17A3A] animate-spin" />
                                            <span className="text-sm text-zinc-500">{t("thinking")}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                        <div className="flex gap-3">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder={t("inputPlaceholder")}
                                className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-600 focus:border-[#C17A3A] focus:outline-none resize-none bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 text-sm font-bold"
                                rows={1}
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!input.trim() || isLoading}
                                className="px-4 py-3 rounded-xl bg-gradient-to-r from-[#3D1F0F] to-[#5C2E0A] hover:from-[#4A2C1A] hover:to-[#6B3A10] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                            >
                                <Send className="w-5 h-5 text-white" />
                            </button>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-2 text-center">{t("inputHint")}</p>
                    </div>
                </div>

                {/* Data Panel */}
                <div className="lg:w-80 shrink-0 flex flex-col gap-4">
                    {/* Current Data Card */}
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                        <button
                            onClick={() => setShowDataPanel(!showDataPanel)}
                            className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-[#C17A3A]/10 to-transparent border-b border-zinc-100 dark:border-zinc-700"
                        >
                            <div className="flex items-center gap-2">
                                <Droplets className="w-4 h-4 text-[#C17A3A]" />
                                <span className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">{t("currentData")}</span>
                            </div>
                            {showDataPanel ? (
                                <ChevronUp className="w-4 h-4 text-zinc-400" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-zinc-400" />
                            )}
                        </button>

                        {showDataPanel && (
                            <div className="p-4 space-y-4">
                                {/* Connection Status */}
                                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-700/50">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`}></div>
                                        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">{t("connection")}</span>
                                    </div>
                                    <span className={`text-xs font-bold ${connected ? "text-emerald-600" : "text-zinc-400"}`}>
                                        {connected ? t("live") : t("disconnected")}
                                    </span>
                                </div>

                                {/* Last Update */}
                                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-700/50">
                                    <div className="flex items-center gap-2">
                                        <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                                        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">{t("lastUpdate")}</span>
                                    </div>
                                    <span className="text-xs font-bold text-zinc-500">
                                        {lastUpdate ? formatTimestamp(lastUpdate) : "--"}
                                    </span>
                                </div>

                                {/* Weather */}
                                {latestReading && (
                                    <>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-zinc-700/50 dark:to-zinc-600/50 border border-amber-100 dark:border-zinc-600">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <Thermometer className="w-3 h-3 text-amber-500" />
                                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{t("temperature")}</span>
                                                </div>
                                                <p className="font-black text-lg text-zinc-800 dark:text-zinc-100">
                                                    {latestReading.air_temperature_c?.toFixed(1) ?? "--"}°C
                                                </p>
                                            </div>
                                            
                                            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-zinc-700/50 dark:to-zinc-600/50 border border-blue-100 dark:border-zinc-600">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <Droplets className="w-3 h-3 text-blue-500" />
                                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{t("humidity")}</span>
                                                </div>
                                                <p className="font-black text-lg text-zinc-800 dark:text-zinc-100">
                                                    {latestReading.air_humidity_pct?.toFixed(0) ?? "--"}%
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 dark:from-zinc-700/50 dark:to-zinc-600/50 border border-emerald-100 dark:border-zinc-600">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <Leaf className="w-3 h-3 text-emerald-500" />
                                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{t("soilMoisture")}</span>
                                                </div>
                                                <p className="font-black text-lg text-zinc-800 dark:text-zinc-100">
                                                    {latestReading.soil_moisture_pct?.toFixed(1) ?? "--"}%
                                                </p>
                                            </div>
                                            
                                            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-zinc-700/50 dark:to-zinc-600/50 border border-purple-100 dark:border-zinc-600">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <Zap className="w-3 h-3 text-purple-500" />
                                                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">{t("stress")}</span>
                                                </div>
                                                <p className="font-black text-lg text-zinc-800 dark:text-zinc-100 capitalize">
                                                    {latestReading.stress_class ?? "--"}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Reservoir & Health */}
                                        <div className="space-y-2">
                                            <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-zinc-700/50 dark:to-zinc-600/50 border border-cyan-100 dark:border-zinc-600">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400">{t("reservoir")}</span>
                                                    <span className={`text-[10px] font-bold ${
                                                        (latestReading.reservoir_level_pct ?? 0) < 25 
                                                            ? "text-red-500" 
                                                            : (latestReading.reservoir_level_pct ?? 0) < 40 
                                                                ? "text-amber-500" 
                                                                : "text-emerald-500"
                                                    }`}>
                                                        {latestReading.reservoir_level_pct?.toFixed(0) ?? "--"}%
                                                    </span>
                                                </div>
                                                <div className="h-2 bg-zinc-200 dark:bg-zinc-600 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full transition-all ${
                                                            (latestReading.reservoir_level_pct ?? 0) < 25 
                                                                ? "bg-red-500" 
                                                                : (latestReading.reservoir_level_pct ?? 0) < 40 
                                                                    ? "bg-amber-500" 
                                                                    : "bg-emerald-500"
                                                        }`}
                                                        style={{ width: `${Math.min(latestReading.reservoir_level_pct ?? 0, 100)}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="p-3 rounded-xl bg-gradient-to-br from-rose-50 to-orange-50 dark:from-zinc-700/50 dark:to-zinc-600/50 border border-rose-100 dark:border-zinc-600">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">{t("health")}</span>
                                                    <span className="font-black text-lg text-zinc-800 dark:text-zinc-100">
                                                        {latestReading.health_score?.toFixed(1) ?? "--"}/10
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {!latestReading && (
                                    <div className="text-center py-6">
                                        <p className="text-zinc-400 text-sm">{t("noData")}</p>
                                        <p className="text-zinc-500 text-xs mt-1">{t("noDataDesc")}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Quick Tips */}
                    <div className="bg-gradient-to-br from-[#3D1F0F] to-[#5C2E0A] rounded-2xl p-4 text-white">
                        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[#C17A3A]" />
                            {t("tipsTitle")}
                        </h3>
                        <ul className="space-y-2 text-xs text-white/70">
                            <li className="flex items-start gap-2">
                                <span className="text-[#C17A3A]">•</span>
                                {t("tip1")}
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#C17A3A]">•</span>
                                {t("tip2")}
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#C17A3A]">•</span>
                                {t("tip3")}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
