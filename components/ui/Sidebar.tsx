"use client";

import { useConfigStore, getAvailablePanels } from '@/lib/store';
import { ModuleConfig, ModuleMaterial, Dimension } from '@/lib/types';
import { useMemo, useState } from 'react';
import { addConfigToWooCart } from '@/lib/cart-helpers';

const MATERIAL_OPTIONS = [
    { value: 'steel', label: 'Acero' },
    { value: 'acrylic', label: 'Acrílico' },
];

const STEEL_COLORS = [
    { value: 'black', label: 'Negro Grafito RAL9010', hex: '#000000', opacity: 1 },
    { value: 'white', label: 'Blanco Puro RAL9011', hex: '#FFFFFF', opacity: 1 },
];

const ACRYLIC_COLORS = [
    { value: 'orange_translucent', label: 'Naranja', hex: '#E64A00', opacity: 0.5 },
    { value: 'transparent', label: 'Transparente', hex: '#E0F7FA', opacity: 0.3 },
    { value: 'blue_translucent', label: 'Azul', hex: '#0055A4', opacity: 0.5 },
    { value: 'green_translucent', label: 'Verde', hex: '#006B3C', opacity: 0.5 },
];

export const Sidebar = () => {
    const modules = useConfigStore((state) => state.modules);
    const selectedModuleId = useConfigStore((state) => state.selectedModuleId);
    const updateModule = useConfigStore((state) => state.actions.updateModule);
    const updateColumnWidth = useConfigStore((state) => state.actions.updateColumnWidth);
    const updateRowHeight = useConfigStore((state) => state.actions.updateRowHeight);
    const updateAllModules = useConfigStore((state) => state.actions.updateAllModules);
    const totalPrice = useConfigStore((state) => state.totalPrice);
    const settings = useConfigStore((state) => state.settings);
    const hasWheels = useConfigStore((state) => state.hasWheels);
    const setHasWheels = useConfigStore((state) => state.actions.setHasWheels);
    const [isAddingToCart, setIsAddingToCart] = useState(false);
    const [addToCartError, setAddToCartError] = useState<string | null>(null);

    const targetModule = useMemo(() =>
        modules.find(m => m.id === selectedModuleId) || modules[0],
        [modules, selectedModuleId]
    );

    // If no modules, don't render (or render empty state)
    if (modules.length === 0) return null;

    // Helper to apply updates
    const handleUpdate = (updates: Partial<ModuleConfig>) => {
        if (selectedModuleId) {
            updateModule(selectedModuleId, updates);
        } else {
            updateAllModules(updates);
        }
    };

    const handleMaterialChange = (material: ModuleMaterial) => {
        const updates: Partial<ModuleConfig> = { material };

        // Reset panels based on material
        if (material === 'acrylic') {
            updates.hasPanel = {
                top: true,
                bottom: true,
                left: false,
                right: false,
                front: false,
                back: false
            };
            // Default acrylic color
            updates.color = 'orange_translucent';
        } else {
            // Default steel panels (All styles default to 'closed' logic usually)
            // Let's set default to 'all' (no front)
            updates.hasPanel = {
                top: true,
                bottom: true,
                left: true,
                right: true,
                front: false,
                back: true
            };
            // Default steel color
            updates.color = 'black';
        }

        // Always update all modules for material change
        updateAllModules(updates);
    };

    const handleSteelStyleChange = (style: 'all' | 'no-back' | 'top-bottom') => {
        let hasPanel = { ...targetModule.hasPanel };

        // Base reset
        hasPanel = {
            top: true,
            bottom: true,
            left: false,
            right: false,
            front: false,
            back: false
        };

        if (style === 'all') {
            hasPanel.left = true;
            hasPanel.right = true;
            hasPanel.back = true;
        } else if (style === 'no-back') {
            hasPanel.left = true;
            hasPanel.right = true;
            hasPanel.back = false;
        } else if (style === 'top-bottom') {
            // Just top/bottom, already set
        }

        handleUpdate({ hasPanel });
    };

    const handleColorChange = (color: string) => {
        if (selectedModuleId) {
            handleUpdate({ color });
        } else {
            updateAllModules({ color });
        }
    };

    const handleAddToCart = async () => {
        if (modules.length === 0) return;
        setIsAddingToCart(true);
        setAddToCartError(null);

        try {
            const usdRate = settings?.usd_exchange_rate || 1000;
            const finalPrice = Math.round(totalPrice);
            const totalPriceUSD = finalPrice / usdRate;

            const result = await addConfigToWooCart({
                modules,
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

    const currentMaterial = targetModule?.material || 'steel';
    const currentColors = currentMaterial === 'steel' ? STEEL_COLORS : ACRYLIC_COLORS;

    // Determine current steel style from panels
    const getSteelStyle = (): 'all' | 'no-back' | 'top-bottom' => {
        const p = targetModule.hasPanel;
        if (!p.left && !p.right && !p.back) return 'top-bottom';
        if (p.left && p.right && !p.back) return 'no-back';
        return 'all'; // Default/Fallback
    };
    const hasLeftNeighbor = modules.some(m =>
        Math.abs((m.position.x + m.size.w) - targetModule.position.x) < 1 &&
        Math.abs(m.position.y - targetModule.position.y) < 1 &&
        Math.abs(m.position.z - targetModule.position.z) < 1
    );

    return (
        <>
            <div className="h-[45dvh] md:h-full w-full md:w-[500px] bg-white shadow-[0_-15px_40px_rgba(0,0,0,0.1)] md:shadow-2xl border-t md:border-t-0 border-r-0 md:border-r border-[#354763]/10 flex-shrink-0 z-20 relative flex flex-col">
                {/* Scrollable config area */}
                <div className="flex-1 overflow-y-auto p-5">
                    <div className="hidden md:flex flex-col items-center mb-4 gap-2">
                        <a href="https://tubular.com.ar/"><img src="/brandbook/logo/logo-azul.svg" alt="Tubular" className="w-[135px] mb-1" /></a>
                    </div>

                    {/* Material */}
                    <div className="mb-4">
                        <h3 className="text-sm uppercase tracking-widest font-extrabold text-black mb-4 ml-1">Tipo de mueble</h3>
                        <div className="flex gap-2">
                            {MATERIAL_OPTIONS.map((opt) => {
                                const isDisabled = opt.value === 'acrylic';
                                return (
                                    <button
                                        key={opt.value}
                                        disabled={isDisabled}
                                        onClick={() => !isDisabled && handleMaterialChange(opt.value as ModuleMaterial)}
                                        className={`flex-1 py-2 px-3 rounded-xl border-2 transition-all font-bold text-xs uppercase tracking-widest ${isDisabled
                                            ? 'bg-[#f5f5f5] text-black/30 border-transparent cursor-not-allowed'
                                            : currentMaterial === opt.value
                                                ? 'bg-[#354763] text-white border-[#354763] shadow-lg shadow-[#354763]/20 cursor-pointer'
                                                : 'bg-[#f5f5f5] text-black/70 border-transparent hover:border-[#354763]/10 hover:bg-[#354763]/5 cursor-pointer'
                                            }`}
                                    >
                                        <span>{opt.label}</span>
                                        {isDisabled && <span className="block text-[8px] font-bold tracking-tight normal-case mt-0.5">Disponible proximamente</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="h-px w-full bg-[#354763]/5 my-5" />

                    {/* Base: Patas vs Ruedas */}
                    <div className="mb-4">
                        <h3 className="text-sm uppercase tracking-widest font-extrabold text-black mb-4 ml-1">Base</h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setHasWheels(false)}
                                className={`flex-1 py-2 px-3 rounded-xl border-2 transition-all font-bold text-xs uppercase tracking-widest ${!hasWheels
                                    ? 'bg-[#354763] text-white border-[#354763] shadow-lg shadow-[#354763]/20 cursor-pointer'
                                    : 'bg-[#f5f5f5] text-black/70 border-transparent hover:border-[#354763]/10 hover:bg-[#354763]/5 cursor-pointer'
                                    }`}
                            >
                                Patas
                            </button>
                            <button
                                onClick={() => setHasWheels(true)}
                                className={`flex-1 py-2 px-3 rounded-xl border-2 transition-all font-bold text-xs uppercase tracking-widest ${hasWheels
                                    ? 'bg-[#354763] text-white border-[#354763] shadow-lg shadow-[#354763]/20 cursor-pointer'
                                    : 'bg-[#f5f5f5] text-black/70 border-transparent hover:border-[#354763]/10 hover:bg-[#354763]/5 cursor-pointer'
                                    }`}
                            >
                                Ruedas
                            </button>
                        </div>
                    </div>

                    <div className="h-px w-full bg-[#354763]/5 my-5" />

                    {
                        selectedModuleId ? (
                            <>

                                {/* Steel Configuration */}
                                {currentMaterial === 'steel' && (() => {
                                    const avail = getAvailablePanels(targetModule.size.w, targetModule.size.h, targetModule.size.d);
                                    return (
                                    <div className="mb-5">
                                        <div className="flex flex-col gap-2">
                                            {[
                                                { key: 'back', label: 'Panel Trasero', available: avail.frontBack },
                                                { key: 'left', label: 'Panel Izquierdo', available: avail.leftRight },
                                                { key: 'right', label: 'Panel Derecho', available: avail.leftRight }
                                            ]
                                                .filter(panel => !(panel.key === 'left' && hasLeftNeighbor))
                                                .map(panel => {
                                                    const isDisabled = !panel.available;
                                                    return (
                                                        <label
                                                            key={panel.key}
                                                            className={`flex items-center justify-between p-3 rounded-xl border-2 border-[#354763]/5 bg-white shadow-sm transition-all ${isDisabled ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:border-[#354763]/20 cursor-pointer'}`}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-black">{panel.label}</span>
                                                                {isDisabled && <span className="text-[9px] text-[#354763]/60 font-bold uppercase tracking-tight">
                                                                    No hay panel en esta medida
                                                                </span>}
                                                            </div>
                                                            <div className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only peer"
                                                                    disabled={isDisabled}
                                                                    checked={targetModule.hasPanel[panel.key as keyof typeof targetModule.hasPanel] as boolean}
                                                                    onChange={(e) => handleUpdate({ hasPanel: { ...targetModule.hasPanel, [panel.key]: e.target.checked } })}
                                                                />
                                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#354763]"></div>
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                    );
                                })()}

                                {/* Dimensions */}
                                <div className="mb-5">

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] uppercase tracking-widest font-extrabold text-black mb-2.5 ml-1">ANCHO (COLUMNA)</label>
                                            <div className="flex gap-2">
                                                {[350, 750].map((w) => (
                                                    <button
                                                        key={w}
                                                        onClick={() => updateColumnWidth(targetModule.id, w)}
                                                        className={`flex-1 py-2 cursor-pointer rounded-xl border-2 transition-all font-bold text-xs ${targetModule.size.w === w
                                                            ? 'bg-white border-[#354763] text-black shadow-md'
                                                            : 'bg-[#f5f5f5] border-transparent text-black/60 hover:bg-[#354763]/5'
                                                            }`}
                                                    >
                                                        {w}mm
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] uppercase tracking-widest font-extrabold text-black mb-2.5 ml-1">ALTO (FILA)</label>
                                            <div className="flex gap-2">
                                                {[200, 350, 750].map((h) => (
                                                    <button
                                                        key={h}
                                                        onClick={() => updateRowHeight(targetModule.id, h)}
                                                        className={`flex-1 py-2 cursor-pointer rounded-xl border-2 transition-all font-bold text-xs ${targetModule.size.h === h
                                                            ? 'bg-white border-[#354763] text-black shadow-md'
                                                            : 'bg-[#f5f5f5] border-transparent text-black/60 hover:bg-[#354763]/5'
                                                            }`}
                                                    >
                                                        {h}mm
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="p-5 bg-[#354763]/10 border-2 border-dashed border-[#354763]/20 rounded-2xl text-center mb-5">
                                <p className="text-black text-sm font-bold leading-relaxed">Selecciona un módulo en la vista 3D para editar sus dimensiones y estilo.</p>
                            </div>
                        )
                    }

                    <div className="h-px w-full bg-[#354763]/5 my-5" />

                    {/* Colors */}
                    <div>
                        <h3 className="text-[10px] uppercase tracking-widest font-extrabold text-black mb-3 ml-1">Color</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {currentColors.map((col) => (
                                <button
                                    key={col.value}
                                    onClick={() => handleColorChange(col.value)}
                                    className={`flex items-center cursor-pointer gap-2.5 p-2 rounded-xl border-2 transition-all ${targetModule.color === col.value
                                        ? 'border-[#354763] bg-white shadow-lg shadow-[#354763]/5'
                                        : 'bg-[#f5f5f5] border-transparent hover:bg-[#354763]/5 hover:border-[#354763]/10'
                                        }`}
                                >
                                    <div
                                        className="w-5 h-5 rounded-full border border-black/5 shadow-inner"
                                        style={{ backgroundColor: col.hex, opacity: col.opacity || 1 }}
                                    />
                                    <span className="text-xs text-[#354763] font-bold">{col.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sticky footer with summary */}
                <div className="border-t border-[#354763]/10 bg-white p-3 md:p-5 flex-shrink-0">
                    {/* Desktop only: Resumen header + modules badge */}
                    <div className="price-desktop-only items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#354763] tracking-widest uppercase">Resumen</span>
                        <span className="text-[10px] bg-[#354763] text-white px-3 py-1 rounded-full font-black">
                            {modules.length} {modules.length === 1 ? 'MÓDULO' : 'MÓDULOS'}
                        </span>
                    </div>

                    <div className="bg-[#354763]/5 p-2 md:p-3 rounded-xl space-y-1.5 md:space-y-2 mb-2 md:mb-3 border border-[#354763]/10 shadow-inner">
                        <div className="flex justify-between items-center">
                            <span style={{fontSize: '0.75rem'}} className="font-black text-[#354763] uppercase tracking-widest leading-tight">6 Cuotas s/ interés</span>
                            <span style={{fontSize: '1rem'}} className="font-black text-[#354763]">
                                ${Math.round(totalPrice).toLocaleString('es-AR')}
                            </span>
                        </div>
                        <div className="h-px bg-[#354763]/10 w-full" />
                        <div className="flex justify-between items-center">
                            <span style={{fontSize: '0.75rem'}} className="font-black text-[#354763] uppercase tracking-widest leading-tight">
                                Efectivo <span className="text-emerald-600 font-bold tracking-tight ml-0.5">20%OFF</span>
                            </span>
                            <span style={{fontSize: '1rem'}} className="font-black text-[#354763]">
                                ${Math.round(totalPrice * 0.80).toLocaleString('es-AR')}
                            </span>
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
                        className="w-full py-4 px-6 bg-[#1e314b] text-white font-bold text-sm tracking-widest uppercase rounded-none hover:bg-[#162438] transition-colors shadow-lg shadow-[#1e314b]/20 flex justify-center items-center gap-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
                                Agregar al Carrito
                            </>
                        )}
                    </button>

                </div>
            </div>
        </>
    );
};
