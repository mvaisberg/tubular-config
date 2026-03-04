"use client";

import { useConfigStore } from '@/lib/store';
import { ModuleConfig, ModuleMaterial, Dimension } from '@/lib/types';
import { useMemo, useState } from 'react';

const MATERIAL_OPTIONS = [
    { value: 'steel', label: 'Acero' },
    { value: 'acrylic', label: 'Acrílico' },
];

const STEEL_COLORS = [
    { value: 'black', label: 'Negro', hex: '#000000', opacity: 1 },
    { value: 'white', label: 'Blanco', hex: '#FFFFFF', opacity: 1 },
    { value: 'beige', label: 'Beige', hex: '#a48f7a', opacity: 1 },
];

const ACRYLIC_COLORS = [
    { value: 'orange_translucent', label: 'Naranja', hex: '#FF9800', opacity: 0.5 },
    { value: 'transparent', label: 'Transparente', hex: '#E0F7FA', opacity: 0.3 },
    { value: 'blue_translucent', label: 'Azul', hex: '#2196F3', opacity: 0.5 },
    { value: 'green_translucent', label: 'Verde', hex: '#4CAF50', opacity: 0.5 },
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
    const [isRedirecting, setIsRedirecting] = useState(false);

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

    const handleCheckout = async () => {
        if (modules.length === 0) return;
        setIsRedirecting(true);

        let imageData = null;
        try {
            const canvas = document.querySelector('canvas');
            if (canvas) {
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

    const is750x750 = targetModule.size.w === 750 && targetModule.size.h === 750;

    return (
        <>
            {/* WhatsApp redirect overlay */}
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
                            <div className="w-24 h-24 md:w-80 md:h-80 bg-white rounded-2xl md:rounded-[3rem] shadow-xl md:shadow-2xl flex items-center justify-center p-4 md:p-12 border border-[#354763]/10 relative shrink-0">
                                <img src="/brandbook/logo/logo-azul.svg" alt="Tubular" className="w-full object-contain" />
                            </div>
                            <div className="flex flex-col items-center justify-center w-24 md:w-48 relative gap-2 md:gap-4 shrink-0">
                                <div className="w-full h-2 md:h-3 bg-[#354763]/10 rounded-full relative overflow-hidden shadow-inner">
                                    <div className="absolute top-0 bottom-0 left-0 w-1/3 bg-[#354763] rounded-full animate-[slideRight_1.5s_ease-in-out_infinite]" />
                                </div>
                                <span className="text-[10px] md:text-sm font-black text-[#354763] tracking-widest uppercase opacity-80">Transfiriendo</span>
                            </div>
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

            <div className="h-[45dvh] md:h-full w-full md:w-[500px] bg-white shadow-[0_-15px_40px_rgba(0,0,0,0.1)] md:shadow-2xl border-t md:border-t-0 border-r-0 md:border-r border-[#354763]/10 flex-shrink-0 z-20 relative flex flex-col">
                {/* Scrollable config area */}
                <div className="flex-1 overflow-y-auto p-5">
                    <div className="hidden md:flex flex-col items-center mb-4 gap-2">
                        <img src="/brandbook/logo/logo-azul.svg" alt="Tubular" className="w-[135px] mb-1" />
                    </div>

                    {/* Material */}
                    <div className="mb-4">
                        <h3 className="text-sm uppercase tracking-widest font-extrabold text-black mb-4 ml-1">Tipo de mueble</h3>
                        <div className="flex gap-2">
                            {MATERIAL_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => handleMaterialChange(opt.value as ModuleMaterial)}
                                    className={`flex-1 py-2 px-3 cursor-pointer rounded-xl border-2 transition-all font-bold text-xs uppercase tracking-widest ${currentMaterial === opt.value
                                        ? 'bg-[#354763] text-white border-[#354763] shadow-lg shadow-[#354763]/20'
                                        : 'bg-[#f5f5f5] text-black/70 border-transparent hover:border-[#354763]/10 hover:bg-[#354763]/5'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-px w-full bg-[#354763]/5 my-5" />

                    {
                        selectedModuleId ? (
                            <>

                                {/* Steel Configuration */}
                                {currentMaterial === 'steel' && (
                                    <div className="mb-5">
                                        <div className="flex flex-col gap-2">
                                            {[
                                                { key: 'back', label: 'Panel Trasero' },
                                                { key: 'left', label: 'Panel Izquierdo' },
                                                { key: 'right', label: 'Panel Derecho' }
                                            ]
                                                .filter(panel => !(panel.key === 'left' && hasLeftNeighbor))
                                                .map(panel => {
                                                    const isDisabled = panel.key === 'back' && (is750x750 || targetModule.size.h === 200);
                                                    return (
                                                        <label
                                                            key={panel.key}
                                                            className={`flex items-center justify-between p-3 rounded-xl border-2 border-[#354763]/5 bg-white shadow-sm transition-all ${isDisabled ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:border-[#354763]/20 cursor-pointer'}`}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-black">{panel.label}</span>
                                                                {isDisabled && <span className="text-[9px] text-[#354763]/60 font-bold uppercase tracking-tight">
                                                                    {is750x750 && targetModule.size.h !== 200 ? 'No disponible 750x750' : 'No en esta medida'}
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
                                )}

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
                <div className="border-t border-[#354763]/10 bg-white p-4 md:p-5 flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-[#354763] tracking-widest uppercase">Resumen</span>
                        <span className="text-[10px] bg-[#354763] text-white px-3 py-1 rounded-full font-black">
                            {modules.length} {modules.length === 1 ? 'MÓDULO' : 'MÓDULOS'}
                        </span>
                    </div>

                    <div className="bg-[#354763]/5 p-3 rounded-xl space-y-2 mb-4 border border-[#354763]/10 shadow-inner">
                        <div className="flex justify-between items-center group">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-[#354763] uppercase tracking-widest leading-tight">6 Cuotas s/ interés</span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">Lista: ${Math.round(totalPrice).toLocaleString('es-AR')}</span>
                            </div>
                            <span className="text-sm font-black text-[#354763] transition-transform group-hover:scale-105">
                                6 x ${Math.round(totalPrice / 6).toLocaleString('es-AR')}
                            </span>
                        </div>
                        <div className="h-px bg-[#354763]/10 w-full" />
                        <div className="flex justify-between items-center group">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-[#354763] uppercase tracking-widest leading-tight">
                                    Efectivo <span className="text-emerald-600 font-bold tracking-tight ml-0.5">(15% OFF)</span>
                                </span>
                            </div>
                            <span className="text-sm font-black text-[#354763] transition-transform group-hover:scale-105">
                                ${Math.round(totalPrice * 0.85).toLocaleString('es-AR')}
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="w-full py-4 px-6 bg-[#354763] text-white font-bold text-sm tracking-widest uppercase rounded-xl hover:bg-[#2a3850] transition-colors shadow-lg shadow-[#354763]/20 flex justify-center items-center gap-2 cursor-pointer"
                        onClick={handleCheckout}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        Comprar
                    </button>
                </div>
            </div>
        </>
    );
};
