"use client";

import { useConfigStore } from '@/lib/store';
import { useMemo, useState } from 'react';

export const PriceDisplay = () => {
    const modules = useConfigStore((state) => state.modules);
    const totalPrice = useConfigStore((state) => state.totalPrice);
    const [isRedirecting, setIsRedirecting] = useState(false);

    const handleCheckout = async () => {
        if (modules.length === 0) return;
        setIsRedirecting(true);

        try {
            const res = await fetch('/api/tiendanube/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modules, totalPrice })
            });
            const data = await res.json();

            if (!res.ok) {
                console.error("Error al procesar checkout", data.error);
                alert("Uy, tuvimos un problema al preparar tu carrito (Avisanos por WhatsApp).");
                setIsRedirecting(false);
                return;
            }

            if (data.checkoutUrl) {
                // Redirect user exactly to TN's checkout URL
                window.location.href = data.checkoutUrl;
            } else {
                alert("Ocurrió un problema de enlace con Tiendanube.");
                setIsRedirecting(false);
            }

        } catch (error) {
            console.error("Connection error trying to checkout:", error);
            alert("Error de conexión al procesar la compra.");
            setIsRedirecting(false);
        }
    };

    return (
        <>
            {isRedirecting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-md">
                    <style>{`
                        @keyframes slideRight {
                            0% { transform: translateX(-100%); opacity: 0; }
                            20% { opacity: 1; }
                            80% { opacity: 1; }
                            100% { transform: translateX(300%); opacity: 0; }
                        }
                    `}</style>
                    <div className="flex flex-col items-center max-w-5xl text-center p-8 space-y-16 mt-[-10vh]">
                        <div className="flex items-center gap-10">
                            {/* Tubular Logo */}
                            <div className="w-80 h-80 bg-white rounded-[3rem] shadow-2xl flex items-center justify-center p-12 border border-[#354763]/10 relative">
                                <img src="/brandbook/logo/logo-azul.svg" alt="Tubular" className="w-full object-contain" />
                            </div>

                            {/* Animated Transfer Indicator */}
                            <div className="flex flex-col items-center justify-center w-48 relative gap-4">
                                <div className="w-full h-3 bg-[#354763]/10 rounded-full relative overflow-hidden shadow-inner">
                                    <div className="absolute top-0 bottom-0 left-0 w-1/3 bg-[#354763] rounded-full animate-[slideRight_1.5s_ease-in-out_infinite]" />
                                </div>
                                <span className="text-sm font-black text-[#354763] tracking-widest uppercase opacity-80">Transfiriendo</span>
                            </div>

                            {/* Tiendanube Logo */}
                            <div className="w-80 h-80 bg-white rounded-[3rem] shadow-2xl flex items-center justify-center p-12 border border-[#354763]/10 relative">
                                <img src="/tiendanube.svg" alt="Tiendanube" className="w-48 h-48 object-contain" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-4xl font-black text-[#354763] tracking-tighter">Preparando tu carrito en Tiendanube...</h2>
                            <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-2xl mx-auto">
                                Te estamos redirigiendo para que puedas cargar tus datos de envío y realizar el pago de forma segura.
                            </p>
                        </div>
                    </div>
                </div>
            )}

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
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-black text-[#354763] uppercase">6 Cuotas Sin Interés</span>
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Precio de Lista: ${totalPrice.toLocaleString('es-AR')}</span>
                            </div>
                            <span className="text-lg font-black text-[#354763] transition-transform group-hover:scale-105">
                                ${(totalPrice / 6).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                            </span>
                        </div>

                        <div className="h-px bg-[#354763]/10 w-full" />

                        <div className="flex justify-between items-center group">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-black text-[#354763] uppercase">Transferencia</span>
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">10% OFF</span>
                            </div>
                            <span className="text-lg font-black text-[#354763] transition-transform group-hover:scale-105">
                                ${(totalPrice * 0.9).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                            </span>
                        </div>

                        <div className="h-px bg-[#354763]/10 w-full" />

                        <div className="flex justify-between items-center group">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-black text-[#354763] uppercase">Efectivo</span>
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">15% OFF</span>
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
                    onClick={handleCheckout}
                >
                    Comprar
                </button>
            </div>
        </>
    );
};
