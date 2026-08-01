"use client";

import { useConfigStore } from '@/lib/store';

/** Toast liviano sobre el canvas — reemplaza los alert() del navegador. */
export const Toast = () => {
    const message = useConfigStore((state) => state.toastMessage);
    if (!message) return null;
    return (
        <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="bg-[#354763] text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-xl max-w-[85vw] text-center">
                {message}
            </div>
        </div>
    );
};
