"use client";

import { useEffect, useState } from 'react';
import { useConfigStore } from '@/lib/store';

/**
 * Hint de primera visita: le dice al usuario que puede tocar un módulo para editarlo.
 * Se muestra una sola vez (localStorage) y desaparece al primer click/tap sobre la escena.
 */
export const FirstVisitHint = () => {
    const [visible, setVisible] = useState(false);
    const selectedModuleId = useConfigStore((state) => state.selectedModuleId);

    useEffect(() => {
        try {
            if (localStorage.getItem('tubular_hint_seen')) return;
        } catch { /* storage bloqueado → mostrar igual */ }
        const t = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(t);
    }, []);

    // Al seleccionar un módulo por primera vez, el hint cumplió su función.
    useEffect(() => {
        if (visible && selectedModuleId) dismiss();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedModuleId]);

    const dismiss = () => {
        setVisible(false);
        try { localStorage.setItem('tubular_hint_seen', '1'); } catch { /* noop */ }
    };

    if (!visible) return null;

    return (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center animate-in fade-in slide-in-from-top-2 duration-300">
            <button
                onClick={dismiss}
                className="pointer-events-auto flex items-center gap-2 bg-white/95 backdrop-blur-md border border-[#354763]/15 shadow-xl rounded-full px-4 py-2.5 text-sm text-[#354763] font-medium cursor-pointer"
            >
                <span className="text-lg leading-none">👆</span>
                Tocá un módulo para editarlo · usá los <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#354763] text-white text-xs font-bold">+</span> para agregar
                <span className="ml-1 text-[#354763]/40 text-xs">✕</span>
            </button>
        </div>
    );
};
