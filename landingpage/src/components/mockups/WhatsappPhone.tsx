import { motion } from "framer-motion";
import { Mic, Phone, Video, MoreVertical, ArrowLeft, Camera, Smile, Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";

export default function WhatsappPhone() {
    const t = useTranslations("Whatsapp");

    return (
        <div className="w-[300px] h-[600px] bg-white rounded-[40px] shadow-2xl overflow-hidden border-[8px] border-gray-900 relative flex flex-col">
            {/* Phone Notch */}
            <div className="absolute top-0 inset-x-0 h-6 bg-gray-900 rounded-b-3xl w-40 mx-auto z-50"></div>

            {/* WhatsApp Header */}
            <div className="bg-[#075E54] pt-10 pb-3 px-3 flex items-center justify-between text-white shrink-0 shadow-md z-10 w-full">
                <div className="flex items-center gap-2">
                    <ArrowLeft size={20} />
                    <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                        {/* We use a simple bot icon as avatar */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold text-[15px] leading-tight">{t('smartAssistant')}</span>
                        <span className="text-[11px] text-white/80">{t('online')}</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Video size={18} />
                    <Phone size={18} />
                    <MoreVertical size={18} />
                </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 bg-[#e5ddd5] relative w-full overflow-hidden flex flex-col p-3 gap-3 pt-6 z-0" style={{ backgroundImage: `url('https://transparenttextures.com/patterns/cubes.png')` }}>
                <div className="absolute inset-0 bg-[#e5ddd5]/60 mix-blend-overlay pointer-events-none"></div>

                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 1 }}
                    className="self-end bg-[#DCF8C6] rounded-xl rounded-tr-sm px-3 py-2 max-w-[85%] shadow-sm relative z-10"
                >
                    <p className="text-[13px] text-gray-800 leading-snug">{t('msg1')}</p>
                    <span className="text-[9px] text-gray-500 float-right mt-1 ml-2 flex items-center gap-1">
                        10:42 AM
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34B7F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline><polyline points="20 10 13 17 11 15" opacity="0.5"></polyline></svg>
                    </span>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 2.5 }}
                    className="self-start bg-white rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%] shadow-sm relative z-10 mt-1"
                >
                    <p className="text-[13px] text-gray-800 leading-snug">{t('msg2')}</p>
                    <span className="text-[9px] text-gray-400 float-right mt-1 ml-2">10:42 AM</span>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 5.5 }}
                    className="self-end bg-[#DCF8C6] rounded-xl rounded-tr-sm px-3 py-2 max-w-[85%] shadow-sm relative z-10 mt-2"
                >
                    <p className="text-[13px] text-gray-800 leading-snug">{t('msg3')}</p>
                    <span className="text-[9px] text-gray-500 float-right mt-1 ml-2 flex items-center gap-1">
                        10:43 AM
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34B7F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline><polyline points="20 10 13 17 11 15" opacity="0.5"></polyline></svg>
                    </span>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 7 }}
                    className="self-start bg-white rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%] shadow-sm relative z-10 mt-1"
                >
                    <p className="text-[13px] text-gray-800 leading-snug">{t('msg4')}</p>
                    <span className="text-[9px] text-gray-400 float-right mt-1 ml-2">10:43 AM</span>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 2, duration: 0.5, repeat: 1, repeatType: "reverse" }}
                    className="self-start bg-white rounded-2xl px-3 py-1 shadow-sm relative z-10 mt-1 text-gray-500 flex gap-1 items-center"
                >
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 6.5, duration: 0.5, repeat: 1, repeatType: "reverse" }}
                    className="self-start bg-white rounded-2xl px-3 py-1 shadow-sm relative z-10 mt-1 text-gray-500 flex gap-1 items-center absolute bottom-[88px]"
                >
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </motion.div>

            </div>

            {/* Input Footer */}
            <div className="bg-[#f0f0f0] px-2 py-2 flex items-center gap-2 pb-6 shrink-0 z-10 w-full relative">
                <div className="flex-1 bg-white rounded-full flex items-center px-3 py-2 shadow-sm gap-2">
                    <Smile size={20} className="text-gray-500" />
                    <input type="text" placeholder={t('placeholder')} className="flex-1 bg-transparent text-[13px] focus:outline-none text-gray-800 placeholder-gray-500 disabled cursor-default" readOnly />
                    <Paperclip size={20} className="text-gray-500" />
                    <Camera size={20} className="text-gray-500" />
                </div>
                <div className="w-10 h-10 bg-[#128C7E] rounded-full flex items-center justify-center text-white shrink-0 shadow-sm cursor-default">
                    <Mic size={20} />
                </div>
            </div>
        </div>
    );
}
