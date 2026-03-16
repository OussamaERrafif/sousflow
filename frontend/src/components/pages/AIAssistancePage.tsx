"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
    Send,
    Bot,
    User,
    Loader2,
    Sparkles,
    Droplets,
    Thermometer,
    Leaf,
    AlertTriangle,
    Clock,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Zap,
    Plus,
    Trash2,
    MessageSquare,
    X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useAppSelector } from "@/lib/store/hooks";
import {
    useChatApiAiChatPostMutation,
    useGetChatHistoryApiAiChatConversationIdGetQuery,
    useListConversationsApiConversationsGetQuery,
    useDeleteConversationApiConversationsConversationIdDeleteMutation,
} from "@/lib/store/generated/api";

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

/** Strip ```svg ... ``` fences so rehype-raw can parse inline SVG */
function preprocessContent(content: string): string {
    return content.replace(/```svg\s*\n?([\s\S]*?)```/g, (_match, svgBlock: string) => {
        return svgBlock.trim();
    });
}

export default function AIAssistancePage() {
    const t = useTranslations("AIAssistant");
    const { readings, lastUpdate, connected } = useAppSelector((state) => state.iot);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [conversationTitle, setConversationTitle] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showDataPanel, setShowDataPanel] = useState(true);
    const [showHistoryPanel, setShowHistoryPanel] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const [sendMessage] = useChatApiAiChatPostMutation();
    const { data: conversationsData, refetch: refetchConversations } =
        useListConversationsApiConversationsGetQuery({});
    const [deleteConversation] =
        useDeleteConversationApiConversationsConversationIdDeleteMutation();

    const { data: history, isFetching: historyLoading, refetch: refetchHistory } =
        useGetChatHistoryApiAiChatConversationIdGetQuery(
            { conversationId: conversationId! },
            { skip: !conversationId, refetchOnMountOrArgChange: true }
        );

    const conversations = conversationsData?.conversations || [];

    const handleNewConversation = useCallback(() => {
        setConversationId(null);
        setConversationTitle(null);
        setMessages([]);
        setShowHistoryPanel(false);
    }, []);

    const handleSelectConversation = useCallback((conv: { id: string; title?: string }) => {
        if (conv.id === conversationId) {
            // Same conversation — just close the panel
            setShowHistoryPanel(false);
            return;
        }
        setConversationId(conv.id);
        setConversationTitle(conv.title || null);
        setMessages([]); // clear while loading
        setShowHistoryPanel(false);
    }, [conversationId]);

    const handleDeleteConversation = useCallback(
        async (e: React.MouseEvent, convId: string) => {
            e.stopPropagation();
            if (confirm(t("confirmDelete") || "Delete this conversation?")) {
                await deleteConversation({ conversationId: convId });
                refetchConversations();
                if (conversationId === convId) {
                    handleNewConversation();
                }
            }
        },
        [conversationId, deleteConversation, handleNewConversation, refetchConversations, t]
    );

    // Load history when conversation changes
    useEffect(() => {
        if (history && Array.isArray(history) && history.length > 0) {
            setMessages(
                history.map((msg: any) => ({
                    role: msg.role as "user" | "assistant",
                    content: msg.content,
                    created_at: msg.created_at ?? undefined,
                }))
            );
        }
    }, [history]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setIsLoading(true);

        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

        try {
            const result: { response: string; conversation_id: string } = await sendMessage({
                chatRequest: {
                    message: userMessage,
                    conversation_id: conversationId || undefined,
                },
            }).unwrap();

            if (result.conversation_id && !conversationId) {
                setConversationId(result.conversation_id);
                setConversationTitle(userMessage.slice(0, 50));
            }

            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: result.response },
            ]);

            // Refresh conversations list and history cache so all messages persist
            refetchConversations();
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: t("errorMessage") },
            ]);
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

    const latestReading =
        readings && readings.length > 0 ? readings[0] : null;

    return (
        <div className="w-full px-2 sm:px-0">
            {/* Header */}
            <div className="mb-4 sm:mb-6">
                <h1 className="text-2xl sm:text-3xl font-black text-zinc-800 dark:text-zinc-100 tracking-tight flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#C17A3A] to-[#8B5A2B] flex items-center justify-center">
                        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    {t("title")}
                </h1>
                <p className="text-zinc-500 font-bold mt-1">{t("subtitle")}</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-auto lg:h-[calc(100vh-200px)] min-h-[500px] lg:min-h-0">
                {/* Chat Area */}
                <div className="flex-1 flex flex-col bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden min-h-[400px] lg:min-h-0 relative">
                    {/* History Panel Overlay */}
                    {showHistoryPanel && (
                        <div className="absolute inset-y-0 start-0 w-72 bg-white dark:bg-zinc-800 border-e border-zinc-200 dark:border-zinc-700 z-20 flex flex-col shadow-xl">
                            <div className="p-4 border-b border-zinc-100 dark:border-zinc-700 flex items-center justify-between">
                                <h3 className="font-bold text-sm text-zinc-700 dark:text-zinc-200">
                                    {t("history")}
                                </h3>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={handleNewConversation}
                                        className="p-1.5 rounded-lg bg-[#C17A3A] text-white hover:bg-[#A86830] transition-colors"
                                        title={t("newChat")}
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setShowHistoryPanel(false)}
                                        className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        <X className="w-4 h-4 text-zinc-500" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                                {conversations.length === 0 ? (
                                    <p className="text-xs text-zinc-400 text-center py-8">
                                        {t("noConversations")}
                                    </p>
                                ) : (
                                    conversations.map((conv: any) => (
                                        <div
                                            key={conv.id}
                                            onClick={() => handleSelectConversation(conv)}
                                            className={`group p-3 rounded-lg cursor-pointer mb-1 transition-colors ${
                                                conversationId === conv.id
                                                    ? "bg-[#C17A3A]/10 border border-[#C17A3A]/30"
                                                    : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50 border border-transparent"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <p
                                                        className={`text-sm font-bold truncate ${
                                                            conversationId === conv.id
                                                                ? "text-[#C17A3A]"
                                                                : "text-zinc-700 dark:text-zinc-200"
                                                        }`}
                                                    >
                                                        {conv.title || t("newChat")}
                                                    </p>
                                                    <p className="text-[10px] text-zinc-400 mt-1">
                                                        {conv.updated_at
                                                            ? formatTimestamp(conv.updated_at)
                                                            : ""}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={(e) =>
                                                        handleDeleteConversation(e, conv.id)
                                                    }
                                                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Chat Header */}
                    <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-700 flex items-center justify-between bg-gradient-to-r from-[#3D1F0F]/5 to-transparent">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                                title={t("history")}
                            >
                                <MessageSquare className="w-4 h-4 text-zinc-500" />
                            </button>
                            <div className="w-8 h-8 rounded-lg bg-[#C17A3A]/10 flex items-center justify-center">
                                <Bot className="w-4 h-4 text-[#C17A3A]" />
                            </div>
                            <div>
                                <h2 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">
                                    {conversationTitle || "SoussFlow AI"}
                                </h2>
                                <p className="text-xs text-emerald-600 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                    {t("online")}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-500">
                                <Clock className="w-3.5 h-3.5" />
                                {t("dataFreshness")}
                            </div>
                            <button
                                onClick={handleNewConversation}
                                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                                title={t("newChat")}
                            >
                                <Plus className="w-4 h-4 text-zinc-500" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Loading history indicator */}
                        {historyLoading && conversationId && (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 text-[#C17A3A] animate-spin" />
                            </div>
                        )}

                        {/* Welcome screen */}
                        {messages.length === 0 && !historyLoading && (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#C17A3A]/20 to-[#8B5A2B]/10 flex items-center justify-center">
                                    <Sparkles className="w-8 h-8 text-[#C17A3A]" />
                                </div>
                                <h3 className="font-black text-zinc-800 dark:text-zinc-100 text-lg mb-2">
                                    {t("welcomeTitle")}
                                </h3>
                                <p className="text-zinc-500 text-sm max-w-xs mx-auto mb-6">
                                    {t("welcomeDesc")}
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-sm mx-auto">
                                    {SUGGESTIONS.map((s) => (
                                        <button
                                            key={s.key}
                                            onClick={() => handleSuggestion(t(s.labelKey))}
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-700/50 hover:bg-[#C17A3A]/10 hover:border-[#C17A3A]/30 border border-zinc-200 dark:border-zinc-600 transition-colors text-start"
                                        >
                                            <s.icon className="w-4 h-4 text-[#C17A3A]" />
                                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 truncate">
                                                {t(s.labelKey)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Message bubbles */}
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`flex gap-2 sm:gap-3 max-w-[90%] sm:max-w-[85%] ${
                                        msg.role === "user" ? "flex-row-reverse" : ""
                                    }`}
                                >
                                    <div
                                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                            msg.role === "user"
                                                ? "bg-[#3D1F0F]"
                                                : "bg-gradient-to-br from-[#C17A3A] to-[#8B5A2B]"
                                        }`}
                                    >
                                        {msg.role === "user" ? (
                                            <User className="w-4 h-4 text-white" />
                                        ) : (
                                            <Bot className="w-4 h-4 text-white" />
                                        )}
                                    </div>
                                    <div
                                        className={`px-4 py-3 rounded-2xl overflow-hidden ${
                                            msg.role === "user"
                                                ? "bg-[#3D1F0F] text-white rounded-tr-sm"
                                                : "bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 rounded-tl-sm"
                                        }`}
                                    >
                                        {msg.role === "assistant" ? (
                                            <MarkdownMessage content={msg.content} />
                                        ) : (
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                                {msg.content}
                                            </p>
                                        )}
                                        {msg.created_at && (
                                            <p
                                                className={`text-[10px] mt-2 ${
                                                    msg.role === "user"
                                                        ? "text-white/50"
                                                        : "text-zinc-400"
                                                }`}
                                            >
                                                {formatTimestamp(msg.created_at)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#C17A3A] to-[#8B5A2B] flex items-center justify-center">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="px-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-700 rounded-tl-sm">
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 text-[#C17A3A] animate-spin" />
                                            <span className="text-sm text-zinc-500">
                                                {t("thinking")}
                                            </span>
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
                        <p className="text-[10px] text-zinc-400 mt-2 text-center">
                            {t("inputHint")}
                        </p>
                    </div>
                </div>

                {/* Data Panel */}
                <div className="lg:w-80 shrink-0 flex flex-col gap-4 order-first lg:order-last">
                    {/* Current Data Card */}
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                        <button
                            onClick={() => setShowDataPanel(!showDataPanel)}
                            className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-[#C17A3A]/10 to-transparent border-b border-zinc-100 dark:border-zinc-700"
                        >
                            <div className="flex items-center gap-2">
                                <Droplets className="w-4 h-4 text-[#C17A3A]" />
                                <span className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">
                                    {t("currentData")}
                                </span>
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
                                        <div
                                            className={`w-2 h-2 rounded-full ${
                                                connected
                                                    ? "bg-emerald-500 animate-pulse"
                                                    : "bg-zinc-400"
                                            }`}
                                        />
                                        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                                            {t("connection")}
                                        </span>
                                    </div>
                                    <span
                                        className={`text-xs font-bold ${
                                            connected ? "text-emerald-600" : "text-zinc-400"
                                        }`}
                                    >
                                        {connected ? t("live") : t("disconnected")}
                                    </span>
                                </div>

                                {/* Last Update */}
                                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-700/50">
                                    <div className="flex items-center gap-2">
                                        <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                                        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                                            {t("lastUpdate")}
                                        </span>
                                    </div>
                                    <span className="text-xs font-bold text-zinc-500">
                                        {lastUpdate ? formatTimestamp(lastUpdate) : "--"}
                                    </span>
                                </div>

                                {/* Sensor data */}
                                {latestReading && (
                                    <>
                                        <div className="grid grid-cols-2 gap-2">
                                            <DataCard
                                                icon={<Thermometer className="w-3 h-3 text-amber-500" />}
                                                label={t("temperature")}
                                                labelColor="text-amber-600 dark:text-amber-400"
                                                bgFrom="from-amber-50"
                                                bgTo="to-orange-50"
                                                borderColor="border-amber-100"
                                                value={
                                                    latestReading.air_temperature_c != null
                                                        ? `${latestReading.air_temperature_c.toFixed(1)}°C`
                                                        : "--"
                                                }
                                            />
                                            <DataCard
                                                icon={<Droplets className="w-3 h-3 text-blue-500" />}
                                                label={t("humidity")}
                                                labelColor="text-blue-600 dark:text-blue-400"
                                                bgFrom="from-blue-50"
                                                bgTo="to-cyan-50"
                                                borderColor="border-blue-100"
                                                value={
                                                    latestReading.air_humidity_pct != null
                                                        ? `${latestReading.air_humidity_pct.toFixed(0)}%`
                                                        : "--"
                                                }
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <DataCard
                                                icon={<Leaf className="w-3 h-3 text-emerald-500" />}
                                                label={t("soilMoisture")}
                                                labelColor="text-emerald-600 dark:text-emerald-400"
                                                bgFrom="from-emerald-50"
                                                bgTo="to-green-50"
                                                borderColor="border-emerald-100"
                                                value={
                                                    latestReading.soil_moisture_pct != null
                                                        ? `${latestReading.soil_moisture_pct.toFixed(1)}%`
                                                        : "--"
                                                }
                                            />
                                            <DataCard
                                                icon={<Zap className="w-3 h-3 text-purple-500" />}
                                                label={t("stress")}
                                                labelColor="text-purple-600 dark:text-purple-400"
                                                bgFrom="from-purple-50"
                                                bgTo="to-violet-50"
                                                borderColor="border-purple-100"
                                                value={latestReading.stress_class ?? "--"}
                                                capitalize
                                            />
                                        </div>

                                        {/* Reservoir */}
                                        <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-zinc-700/50 dark:to-zinc-600/50 border border-cyan-100 dark:border-zinc-600">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                                                    {t("reservoir")}
                                                </span>
                                                <span
                                                    className={`text-[10px] font-bold ${
                                                        (latestReading.reservoir_level_pct ?? 0) < 25
                                                            ? "text-red-500"
                                                            : (latestReading.reservoir_level_pct ?? 0) < 40
                                                              ? "text-amber-500"
                                                              : "text-emerald-500"
                                                    }`}
                                                >
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
                                                    style={{
                                                        width: `${Math.min(latestReading.reservoir_level_pct ?? 0, 100)}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Health */}
                                        <div className="p-3 rounded-xl bg-gradient-to-br from-rose-50 to-orange-50 dark:from-zinc-700/50 dark:to-zinc-600/50 border border-rose-100 dark:border-zinc-600">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                                    {t("health")}
                                                </span>
                                                <span className="font-black text-lg text-zinc-800 dark:text-zinc-100">
                                                    {latestReading.health_score?.toFixed(1) ?? "--"}/10
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {!latestReading && (
                                    <div className="text-center py-6">
                                        <p className="text-zinc-400 text-sm">{t("noData")}</p>
                                        <p className="text-zinc-500 text-xs mt-1">
                                            {t("noDataDesc")}
                                        </p>
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

/** Reusable small data card for the side panel */
function DataCard({
    icon,
    label,
    labelColor,
    bgFrom,
    bgTo,
    borderColor,
    value,
    capitalize,
}: {
    icon: React.ReactNode;
    label: string;
    labelColor: string;
    bgFrom: string;
    bgTo: string;
    borderColor: string;
    value: string;
    capitalize?: boolean;
}) {
    return (
        <div
            className={`p-3 rounded-xl bg-gradient-to-br ${bgFrom} ${bgTo} dark:from-zinc-700/50 dark:to-zinc-600/50 border ${borderColor} dark:border-zinc-600`}
        >
            <div className="flex items-center gap-1.5 mb-1">
                {icon}
                <span className={`text-[10px] font-bold ${labelColor}`}>{label}</span>
            </div>
            <p className={`font-black text-lg text-zinc-800 dark:text-zinc-100 ${capitalize ? "capitalize" : ""}`}>
                {value}
            </p>
        </div>
    );
}

/** Renders assistant markdown with SVG support */
function MarkdownMessage({ content }: { content: string }) {
    const processed = preprocessContent(content);

    return (
        <div className="markdown-content text-sm leading-relaxed">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                    // SVG charts rendered in a styled container
                    svg: ({ children, ...props }: any) => (
                        <div className="my-3 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-600 overflow-x-auto">
                            <svg {...props}>{children}</svg>
                        </div>
                    ),
                    // Code blocks
                    code: ({ className, children, ...props }: any) => {
                        const isBlock = /language-(\w+)/.test(className || "");
                        if (!isBlock) {
                            return (
                                <code
                                    className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-600 rounded text-xs font-mono"
                                    {...props}
                                >
                                    {children}
                                </code>
                            );
                        }
                        return (
                            <code
                                className={`${className} block p-3 bg-zinc-900 text-zinc-100 rounded-lg overflow-x-auto text-xs font-mono my-2`}
                                {...props}
                            >
                                {children}
                            </code>
                        );
                    },
                    pre: ({ children }: any) => (
                        <pre className="overflow-x-auto my-2">{children}</pre>
                    ),
                    // Lists
                    ul: ({ children }: any) => (
                        <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
                    ),
                    ol: ({ children }: any) => (
                        <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
                    ),
                    li: ({ children }: any) => <li className="ms-2">{children}</li>,
                    // Headings
                    h1: ({ children }: any) => (
                        <h1 className="text-xl font-bold my-3 text-[#C17A3A]">{children}</h1>
                    ),
                    h2: ({ children }: any) => (
                        <h2 className="text-lg font-bold my-2 text-zinc-800 dark:text-zinc-100">{children}</h2>
                    ),
                    h3: ({ children }: any) => (
                        <h3 className="text-md font-semibold my-1.5">{children}</h3>
                    ),
                    p: ({ children }: any) => <p className="my-1.5">{children}</p>,
                    // Tables
                    table: ({ children }: any) => (
                        <div className="overflow-x-auto my-3 rounded-lg border border-zinc-200 dark:border-zinc-600">
                            <table className="min-w-full text-xs">{children}</table>
                        </div>
                    ),
                    thead: ({ children }: any) => (
                        <thead className="bg-zinc-100 dark:bg-zinc-700">{children}</thead>
                    ),
                    th: ({ children }: any) => (
                        <th className="px-3 py-2 text-start font-bold text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-600">
                            {children}
                        </th>
                    ),
                    td: ({ children }: any) => (
                        <td className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-700">
                            {children}
                        </td>
                    ),
                    // Blockquote
                    blockquote: ({ children }: any) => (
                        <blockquote className="border-s-4 border-[#C17A3A] ps-3 my-2 text-zinc-600 dark:text-zinc-300 italic">
                            {children}
                        </blockquote>
                    ),
                    // Links
                    a: ({ href, children }: any) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#C17A3A] underline hover:text-[#A86830]"
                        >
                            {children}
                        </a>
                    ),
                    // Strong / emphasis
                    strong: ({ children }: any) => (
                        <strong className="font-bold text-zinc-900 dark:text-zinc-50">{children}</strong>
                    ),
                    hr: () => <hr className="my-3 border-zinc-200 dark:border-zinc-600" />,
                }}
            >
                {processed}
            </ReactMarkdown>
        </div>
    );
}
