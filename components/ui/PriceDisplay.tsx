"use client";

import { useConfigStore } from '@/lib/store';
import { useState } from 'react';
import { addConfigToWooCart } from '@/lib/cart-helpers';

export const PriceDisplay = ({ className }: { className?: string }) => {
    const modules = useConfigStore((state) => state.modules);
    const totalPrice = useConfigStore((state) => state.totalPrice);
    const settings = useConfigStore((state) => state.settings);
    const hasWheels = useConfigStore((state) => state.hasWheels);
    const [isAddingToCart, setIsAddingToCart] = useState(false);
    const [addToCartError, setAddToCartError] = useState<string | null>(null);

    const finalPrice = Math.round(totalPrice);
    const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 0 });

    const handleAddToCart = async () => {
        if (modules.length === 0) return;
        setIsAddingToCart(true);
        setAddToCartError(null);

        try {
            const usdRate = settings?.usd_exchange_rate || 1000;
            const totalPriceUSD = finalPrice / usdRate;

            const result = await addConfigToWooCart({
                modules,
                hasWheels,
                totalPriceARS: finalPrice,
                totalPriceUSD,
            });

            if (result.success && result.cart_url) {
                window.location.href = result.cart_url;
            } else {
                setAddToCartError(result.error || 'Error desconocido');
                setIsAddingToCart(false);
            }
        } catch (err) {
            console.error('Error adding to cart:', err);
            setAddToCartError('Error de conexión. Intentá de nuevo.');
            setIsAddingToCart(false);
        }
    };

    return (
        <div className={`${className === undefined ? 'absolute top-4 left-4 right-4 md:left-auto md:w-80 max-h-[30vh] md:max-h-[85vh] overflow-y-auto z-10' : className} bg-white/95 backdrop-blur-md p-3 md:p-6 rounded-2xl shadow-xl md:shadow-2xl border border-[#354763]/10 transition-all duration-300`}>

            {/* Header — hidden on mobile */}
            <h3 className="price-desktop-only text-sm font-bold mb-2 items-center justify-between text-[#354763] tracking-widest uppercase">
                <span>Resumen</span>
                <span className="text-[10px] bg-[#354763] text-white px-3 py-1 rounded-full font-black">
                    {modules.length} {modules.length === 1 ? 'MÓDULO' : 'MÓDULOS'}
                </span>
            </h3>

            <div className="space-y-3 md:space-y-4 mb-4 md:mb-8">
                <div className="bg-white/40 p-3 md:p-4 rounded-xl space-y-3 md:space-y-4 border border-[#354763]/10 shadow-inner">
                    <div className="flex justify-between items-center group">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[0.875rem] md:text-sm font-black text-[#354763] uppercase">6 Cuotas Sin Interés</span>
                            <span className="text-[0.75rem] md:text-xs font-bold text-slate-500 uppercase tracking-widest">Total: ${fmt(finalPrice)}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[1.25rem] md:text-xl font-black text-[#354763]">
                                ${fmt(Math.round(finalPrice / 6))}
                            </span>
                        </div>
                    </div>

                    <div className="h-px bg-[#354763]/10 w-full" />

                    <div className="flex justify-between items-center group">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[0.875rem] md:text-sm font-black text-[#354763] uppercase">Efectivo / Transferencia</span>
                            <span className="text-[0.75rem] md:text-xs font-bold text-slate-500 uppercase tracking-widest">20% OFF</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[1.25rem] md:text-xl font-black text-[#354763]">
                                ${fmt(Math.round(finalPrice * 0.80))}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {addToCartError && (
                <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold text-center">
                    {addToCartError}
                </div>
            )}

            <button
                type="button"
                disabled={isAddingToCart}
                className="w-full py-3 md:py-4 px-6 bg-[#354763] text-white font-bold text-[0.8125rem] md:text-sm tracking-widest uppercase rounded-xl hover:bg-[#2a3850] transition-colors shadow-lg shadow-[#354763]/20 flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleAddToCart}
            >
                {isAddingToCart ? (
                    <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Agregando...
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                        </svg>
                        Comprar
                    </>
                )}
            </button>
        </div>
    );
};
