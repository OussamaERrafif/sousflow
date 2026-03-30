"use client";

import { Droplets } from "lucide-react";

interface ReservoirIndicatorProps {
  level: number;
  capacity?: number;
  showLabel?: boolean;
}

export function ReservoirIndicator({
  level,
  capacity = 100,
  showLabel = true,
}: ReservoirIndicatorProps) {
  const percentage = Math.min(100, Math.max(0, (level / capacity) * 100));
  
  const isLow = percentage < 25;
  const liquidColor = isLow ? "text-red-500 bg-red-500" : "text-blue-500 bg-blue-500";

  return (
    <div className="flex flex-col items-center gap-2 border border-border/40 p-3 rounded-2xl bg-card">
      
      {/* Physical Tank Representation */}
      <div className="relative w-16 h-24 md:w-20 md:h-28 bg-muted/50 border-[3px] border-border rounded-b-3xl rounded-t-sm overflow-hidden flex flex-col justify-end ring-2 ring-background">
        
        {/* Empty Tank Background Icon */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <Droplets className="w-8 h-8" />
        </div>

        {/* 50% Mark line */}
        <div className="absolute top-1/2 w-full border-b-2 border-dashed border-border/50 z-10"></div>

        {/* Water Liquid Fill */}
        <div 
          className={`relative w-full transition-all duration-1000 ease-in-out ${liquidColor}`}
          style={{ height: `${percentage}%` }}
        >
            {/* Literal Wave Shape at the surface */}
            <div className="absolute -top-[14px] left-0 right-0 overflow-hidden w-full h-[15px]">
                <svg
                    className={`absolute bottom-0 w-[200%] h-full animate-[wave_3s_linear_infinite] ${liquidColor.split(' ')[0]}`}
                    viewBox="0 0 100 20"
                    preserveAspectRatio="none"
                >
                    <path
                        fill="currentColor"
                        d="M0,10 C15,20 35,0 50,10 C65,20 85,0 100,10 L100,20 L0,20 Z"
                    />
                </svg>
            </div>
            
            {/* Water depth color */}
            <div className="w-full h-full bg-current opacity-90"></div>
        </div>
      </div>

      {showLabel && (
        <div className="flex items-center gap-1.5 pt-1">
          <Droplets className={`w-4 h-4 ${isLow ? 'text-red-500' : 'text-blue-500'}`} />
          <span className="text-sm md:text-base font-black text-foreground">
            {percentage.toFixed(0)}%
          </span>
        </div>
      )}

      {/* Tailwind animation for the wave */}
      <style jsx>{`
        @keyframes wave {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}