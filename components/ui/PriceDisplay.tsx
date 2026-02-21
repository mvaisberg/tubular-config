"use client";

import { useConfigStore } from '@/lib/store';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const PriceDisplay = () => {
    const modules = useConfigStore((state) => state.modules);
    const totalPrice = useConfigStore((state) => state.totalPrice);
    const totalCost = useConfigStore((state) => state.totalCost);
    const bomSummary = useConfigStore((state) => state.bomSummary);
    const [showBom, setShowBom] = useState(false);

    const bomItems = Object.values(bomSummary);

    return (
        <div className="absolute top-4 right-4 bg-[#ebecdf]/95 backdrop-blur-md p-6 rounded-2xl shadow-2xl border border-white/50 w-80 max-h-[85vh] overflow-y-auto z-20 transition-all duration-300">
            <h3 className="text-sm font-bold mb-6 flex items-center justify-between text-[#354763] tracking-widest uppercase">
                <span>Resumen</span>
                <span className="text-[10px] bg-[#354763] text-white px-3 py-1 rounded-full font-black">
                    {modules.length} {modules.length === 1 ? 'MÓDULO' : 'MÓDULOS'}
                </span>
            </h3>

            <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center text-xs font-bold text-[#354763]/40 tracking-wider">
                    <span>LISTA / TARJETA:</span>
                    <span className="font-mono italic">${totalPrice.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                </div>

                <div className="bg-white/40 p-4 rounded-xl space-y-3 border border-[#354763]/5 shadow-inner">
                    <div className="flex justify-between items-center group">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-[#aab799] uppercase tracking-tighter">Efectivo</span>
                            <span className="text-[9px] font-bold text-[#354763]/30 uppercase tracking-widest">20% OFF</span>
                        </div>
                        <span className="text-xl font-black text-[#aab799] drop-shadow-sm transition-transform group-hover:scale-105">
                            ${(totalPrice * 0.8).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                        </span>
                    </div>

                    <div className="h-px bg-[#354763]/5 w-full" />

                    <div className="flex justify-between items-center group">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-[#354763] uppercase tracking-tighter">Transferencia</span>
                            <span className="text-[9px] font-bold text-[#354763]/30 uppercase tracking-widest">10% OFF</span>
                        </div>
                        <span className="text-lg font-black text-[#354763] transition-transform group-hover:scale-105">
                            ${(totalPrice * 0.9).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                        </span>
                    </div>
                </div>
            </div>

            <button
                onClick={() => setShowBom(!showBom)}
                className="w-full flex items-center justify-between py-3 px-4 bg-white/60 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#354763]/60 hover:text-[#354763] hover:bg-white transition-all mb-4 mt-2 border border-[#354763]/5"
            >
                <span>Detalle de Partes</span>
                {showBom ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showBom && (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {bomItems.length === 0 ? (
                        <p className="text-[10px] text-[#354763]/30 italic text-center py-4 font-bold uppercase tracking-widest">Cargando cálculos...</p>
                    ) : (
                        bomItems.map((item, idx) => (
                            <div key={idx} className="flex flex-col p-2.5 rounded-lg bg-white/30 border border-transparent hover:border-[#354763]/5 transition-colors">
                                <div className="flex justify-between font-bold text-[#354763] text-[11px] uppercase tracking-tighter">
                                    <span>{item.name}</span>
                                    <span className="bg-[#354763] text-white px-2 py-0.5 rounded text-[9px] font-black">x{item.quantity}</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-bold text-[#354763]/30 mt-1">
                                    <span>UNIT: ${item.unitCostARS.toLocaleString('es-AR')}</span>
                                    <span className="text-[#354763]/60">${item.totalCostARS.toLocaleString('es-AR')}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            <div className="mt-4 pt-4 border-t border-[#354763]/5">
                <p className="text-[9px] text-[#354763]/40 font-bold uppercase tracking-[0.05em] leading-relaxed italic">
                    * PRECIOS ESTIMADOS SEGÚN CONFIGURACIÓN ACTUAL.
                </p>
            </div>
        </div>
    );
};
