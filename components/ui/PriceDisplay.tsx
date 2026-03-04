"use client";

import { useConfigStore } from '@/lib/store';
import { useMemo, useState } from 'react';

export const PriceDisplay = ({ className }: { className?: string }) => {
    const modules = useConfigStore((state) => state.modules);
    const totalPrice = useConfigStore((state) => state.totalPrice);
    const settings = useConfigStore((state) => state.settings);
    const [isRedirecting, setIsRedirecting] = useState(false);

    const handleCheckout = async () => {
        if (modules.length === 0) return;
        setIsRedirecting(true);

        let imageData = null;
        try {
            const canvas = document.querySelector('canvas');
            if (canvas) {
                // Get image data from WebGL context preserving drawing buffer
                imageData = canvas.toDataURL('image/jpeg', 0.8);
            }
        } catch (e) {
            console.error("Failed to capture canvas screenshot:", e);
        }

        try {
            const res = await fetch('/api/checkout/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modules,
                    totalPrice,
                    usdExchangeRate: settings?.usd_exchange_rate || 1000,
                    imageData
                })
            });
            const data = await res.json();

            if (!res.ok) {
                console.error("Error al procesar checkout", data.error);
                alert(`Uy, tuvimos un problema al preparar tu diseño:\n\n${data.error || "Avisanos por WhatsApp."}`);
                setIsRedirecting(false);
                return;
            }

            if (data.quoteId) {
                const baseUrl = window.location.origin;
                const configUrl = `${baseUrl}/?quote=${data.quoteId}`;
                const waMessage = `Hola que tal?\n\nQuisiera encargar este mueble con esta configuracion.\n\n${configUrl}`;
                const waUrl = `https://wa.me/5491173629958?text=${encodeURIComponent(waMessage)}`;
                window.location.href = waUrl;
            } else {
                alert("Ocurrió un problema de enlace.");
                setIsRedirecting(false);
            }

        } catch (error) {
            console.error("Connection error trying to checkout:", error);
            alert("Error de conexión al procesar la solicitud.");
            setIsRedirecting(false);
        }
    };

    return (
        <>
            {isRedirecting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-md p-4">
                    <style>{`
                        @keyframes slideRight {
                            0% { transform: translateX(-100%); opacity: 0; }
                            20% { opacity: 1; }
                            80% { opacity: 1; }
                            100% { transform: translateX(300%); opacity: 0; }
                        }
                    `}</style>
                    <div className="flex flex-col items-center max-w-5xl text-center space-y-8 md:space-y-16 md:mt-[-10vh] w-full">
                        <div className="flex items-center gap-4 md:gap-10 w-full justify-center">
                            {/* Tubular Logo */}
                            <div className="w-24 h-24 md:w-80 md:h-80 bg-white rounded-2xl md:rounded-[3rem] shadow-xl md:shadow-2xl flex items-center justify-center p-4 md:p-12 border border-[#354763]/10 relative shrink-0">
                                <img src="/brandbook/logo/logo-azul.svg" alt="Tubular" className="w-full object-contain" />
                            </div>

                            {/* Animated Transfer Indicator */}
                            <div className="flex flex-col items-center justify-center w-24 md:w-48 relative gap-2 md:gap-4 shrink-0">
                                <div className="w-full h-2 md:h-3 bg-[#354763]/10 rounded-full relative overflow-hidden shadow-inner">
                                    <div className="absolute top-0 bottom-0 left-0 w-1/3 bg-[#354763] rounded-full animate-[slideRight_1.5s_ease-in-out_infinite]" />
                                </div>
                                <span className="text-[10px] md:text-sm font-black text-[#354763] tracking-widest uppercase opacity-80">Transfiriendo</span>
                            </div>

                            {/* WhatsApp Logo */}
                            <div className="w-24 h-24 md:w-80 md:h-80 bg-[#25D366] rounded-2xl md:rounded-[3rem] shadow-xl md:shadow-2xl flex items-center justify-center p-4 md:p-12 relative shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 md:w-32 md:h-32 text-white" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-2xl md:text-4xl font-black text-[#354763] tracking-tighter">Preparando tu diseño para enviar por WhatsApp...</h2>
                            <p className="text-base md:text-xl text-slate-500 font-medium leading-relaxed max-w-2xl mx-auto px-4">
                                Te estamos redirigiendo para que puedas comunicarte con nosotros y encargar tu mueble.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className={`${className === undefined ? 'absolute top-4 left-4 right-4 md:left-auto md:w-80 max-h-[30vh] md:max-h-[85vh] overflow-y-auto z-10' : className} bg-white/95 backdrop-blur-md p-3 md:p-6 rounded-2xl shadow-xl md:shadow-2xl border border-[#354763]/10 transition-all duration-300`}>
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
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Precio de Lista: ${Math.round(totalPrice).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <span className="text-lg font-black text-[#354763] transition-transform group-hover:scale-105">
                                ${Math.round(totalPrice / 6).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                        </div>

                        <div className="h-px bg-[#354763]/10 w-full" />

                        <div className="flex justify-between items-center group">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-black text-[#354763] uppercase">Transferencia</span>
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">10% OFF</span>
                            </div>
                            <span className="text-lg font-black text-[#354763] transition-transform group-hover:scale-105">
                                ${Math.round(totalPrice * 0.9).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                        </div>

                        <div className="h-px bg-[#354763]/10 w-full" />

                        <div className="flex justify-between items-center group">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-black text-[#354763] uppercase">Efectivo</span>
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">15% OFF</span>
                            </div>
                            <span className="text-lg font-black text-[#354763] transition-transform group-hover:scale-105">
                                ${Math.round(totalPrice * 0.85).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    className="w-full py-4 px-6 bg-[#354763] text-white font-bold text-sm tracking-widest uppercase rounded-xl hover:bg-[#2a3850] transition-colors shadow-lg shadow-[#354763]/20 flex justify-center items-center gap-2"
                    onClick={handleCheckout}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Encargar
                </button>
            </div>
        </>
    );
};
