"use client";

import { useConfigStore } from '@/lib/store';
import { useMemo } from 'react';

export const PriceDisplay = () => {
    const modules = useConfigStore((state) => state.modules);
    const totalPrice = useConfigStore((state) => state.totalPrice);

    return (
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-2xl border border-[#354763]/10 w-80 max-h-[85vh] overflow-y-auto z-20 transition-all duration-300">
            <h3 className="text-sm font-bold mb-6 flex items-center justify-between text-[#354763] tracking-widest uppercase">
                <span>Resumen</span>
                <span className="text-[10px] bg-[#354763] text-white px-3 py-1 rounded-full font-black">
                    {modules.length} {modules.length === 1 ? 'MÓDULO' : 'MÓDULOS'}
                </span>
            </h3>

            <div className="space-y-4 mb-8">
                <div className="bg-white/40 p-4 rounded-xl space-y-4 border border-[#354763]/10 shadow-inner">
                    <div className="flex justify-between items-center group">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-[#354763] uppercase tracking-tighter">6 Cuotas Sin Interés</span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Precio de Lista: ${totalPrice.toLocaleString('es-AR')}</span>
                        </div>
                        <span className="text-lg font-black text-[#354763] transition-transform group-hover:scale-105">
                            ${(totalPrice / 6).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                        </span>
                    </div>

                    <div className="h-px bg-[#354763]/10 w-full" />

                    <div className="flex justify-between items-center group">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-[#354763] uppercase tracking-tighter">Transferencia</span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">10% OFF</span>
                        </div>
                        <span className="text-lg font-black text-[#354763] transition-transform group-hover:scale-105">
                            ${(totalPrice * 0.9).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                        </span>
                    </div>

                    <div className="h-px bg-[#354763]/10 w-full" />

                    <div className="flex justify-between items-center group">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-[#354763] uppercase tracking-tighter">Efectivo</span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">15% OFF</span>
                        </div>
                        <span className="text-lg font-black text-[#354763] transition-transform group-hover:scale-105">
                            ${(totalPrice * 0.85).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                        </span>
                    </div>
                </div>
            </div>

            <button
                type="button"
                className="w-full py-4 px-6 bg-[#354763] text-white font-bold text-sm tracking-widest uppercase rounded-xl hover:bg-[#2a3850] transition-colors shadow-lg shadow-[#354763]/20 flex justify-center items-center"
                onClick={() => { }}
            >
                Comprar
            </button>
        </div>
    );
};
