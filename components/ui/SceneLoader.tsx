"use client";

import { useProgress } from '@react-three/drei';
import { Loader2 } from 'lucide-react';

export const SceneLoader = () => {
    const { active, progress } = useProgress();

    if (!active) return null;

    return (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-6 py-4 shadow-lg flex items-center gap-3 border border-[#354763]/10">
                <Loader2 className="animate-spin text-[#354763]" size={24} />
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-[#354763]">Cargando ambiente...</span>
                    <span className="text-xs text-[#354763]/60">{Math.round(progress)}%</span>
                </div>
            </div>
        </div>
    );
};
