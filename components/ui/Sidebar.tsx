"use client";

import { useConfigStore } from '@/lib/store';
import { ModuleConfig, ModuleMaterial, Dimension } from '@/lib/types';
import { useMemo } from 'react';

const MATERIAL_OPTIONS = [
    { value: 'steel', label: 'Acero' },
    { value: 'acrylic', label: 'Acrílico' },
];

const STEEL_COLORS = [
    { value: 'black', label: 'Negro', hex: '#000000', opacity: 1 },
    { value: 'white', label: 'Blanco', hex: '#FFFFFF', opacity: 1 },
    { value: 'beige', label: 'Beige', hex: '#F5F5DC', opacity: 1 },
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
        // Enforce global color change for the entire furniture
        updateAllModules({ color });
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
    const currentSteelStyle = getSteelStyle();

    return (
        <div className="h-full w-80 bg-[#ebecdf] shadow-2xl border-r border-[#354763]/10 p-8 overflow-y-auto flex-shrink-0 z-10">
            <div className="flex flex-col items-center mb-10 gap-2">
                <img src="/brandbook/logo/logo-azul.svg" alt="Tubular" className="w-32 mb-2" />
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#354763]/30">Configurator</span>
            </div>

            <h2 className="text-xl font-bold mb-8 text-[#354763] tracking-tight">Personalización</h2>

            {/* Material */}
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Material</h3>
                <div className="flex gap-2">
                    {MATERIAL_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => handleMaterialChange(opt.value as ModuleMaterial)}
                            className={`flex-1 py-2.5 px-4 rounded-xl border-2 transition-all font-bold text-xs uppercase tracking-widest ${currentMaterial === opt.value
                                ? 'bg-[#354763] text-white border-[#354763] shadow-lg shadow-[#354763]/20'
                                : 'bg-white text-[#354763]/60 border-transparent hover:border-[#354763]/10 hover:bg-white/50'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-px w-full bg-[#354763]/5 my-8" />

            {selectedModuleId ? (
                <>
                    <div className="mb-8 p-4 bg-[#aab799]/10 text-[#354763] text-[10px] uppercase tracking-widest font-bold rounded-xl border border-[#aab799]/20 flex justify-center items-center">
                        Módulo seleccionado
                    </div>

                    {/* Steel Configuration */}
                    {currentMaterial === 'steel' && (
                        <div className="mb-10">
                            <h3 className="text-[10px] uppercase tracking-widest font-extrabold text-[#354763]/40 mb-4 ml-1">Estilo Acero</h3>
                            <div className="flex flex-col gap-2.5">
                                <button
                                    onClick={() => handleSteelStyleChange('all')}
                                    className={`py-3 px-4 text-left rounded-xl border-2 transition-all text-sm font-bold ${currentSteelStyle === 'all' ? 'bg-white border-[#354763] text-[#354763] shadow-md' : 'border-transparent text-[#354763]/50 hover:bg-white/50'}`}
                                >
                                    Completo (5 caras)
                                </button>
                                <button
                                    onClick={() => handleSteelStyleChange('no-back')}
                                    className={`py-3 px-4 text-left rounded-xl border-2 transition-all text-sm font-bold ${currentSteelStyle === 'no-back' ? 'bg-white border-[#354763] text-[#354763] shadow-md' : 'border-transparent text-[#354763]/50 hover:bg-white/50'}`}
                                >
                                    Abierto atrás (4 caras)
                                </button>
                                <button
                                    onClick={() => handleSteelStyleChange('top-bottom')}
                                    className={`py-3 px-4 text-left rounded-xl border-2 transition-all text-sm font-bold ${currentSteelStyle === 'top-bottom' ? 'bg-white border-[#354763] text-[#354763] shadow-md' : 'border-transparent text-[#354763]/50 hover:bg-white/50'}`}
                                >
                                    Solo Arriba/Abajo (2 caras)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Dimensions */}
                    <div className="mb-10">
                        <h3 className="text-[10px] uppercase tracking-widest font-extrabold text-[#354763]/40 mb-4 ml-1">Dimensiones</h3>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold text-[#354763]/60 mb-2.5 ml-1">ANCHO (COLUMNA)</label>
                                <div className="flex gap-2.5">
                                    {[350, 750].map((w) => (
                                        <button
                                            key={w}
                                            onClick={() => updateColumnWidth(selectedModuleId, w)}
                                            className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold text-sm ${targetModule.size.w === w
                                                ? 'bg-white border-[#aab799] text-[#354763] shadow-md'
                                                : 'border-transparent text-[#354763]/40 hover:bg-white/50'
                                                }`}
                                        >
                                            {w}mm
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-[#354763]/60 mb-2.5 ml-1">ALTO (FILA)</label>
                                <div className="flex gap-2.5">
                                    {[350, 750].map((h) => (
                                        <button
                                            key={h}
                                            onClick={() => updateRowHeight(selectedModuleId, h)}
                                            className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold text-sm ${targetModule.size.h === h
                                                ? 'bg-white border-[#aab799] text-[#354763] shadow-md'
                                                : 'border-transparent text-[#354763]/40 hover:bg-white/50'
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
                <div className="p-6 bg-[#ebecdf] border-2 border-dashed border-[#354763]/10 rounded-2xl text-center mb-10">
                    <p className="text-[#354763]/40 text-xs font-medium leading-relaxed italic">Selecciona un módulo en la vista 3D para editar sus dimensiones y estilo.</p>
                </div>
            )}

            <div className="h-px w-full bg-[#354763]/5 my-8" />

            {/* Colors */}
            <div>
                <h3 className="text-[10px] uppercase tracking-widest font-extrabold text-[#354763]/40 mb-5 ml-1">Color</h3>
                <div className="grid grid-cols-2 gap-3">
                    {currentColors.map((col) => (
                        <button
                            key={col.value}
                            onClick={() => handleColorChange(col.value)}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${targetModule.color === col.value
                                ? 'border-[#354763] bg-white shadow-lg shadow-[#354763]/5'
                                : 'border-transparent hover:bg-white/50 hover:border-[#354763]/5'
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
    );
};
