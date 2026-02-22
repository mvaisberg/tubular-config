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
        if (selectedModuleId) {
            handleUpdate({ color });
        } else {
            updateAllModules({ color });
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
    const currentSteelStyle = getSteelStyle();

    return (
        <div className="h-full w-[450px] bg-white shadow-2xl border-r border-[#354763]/10 p-8 overflow-y-auto flex-shrink-0 z-10">
            <div className="flex flex-col items-center mb-6 gap-2">
                <img src="/brandbook/logo/logo-azul.svg" alt="Tubular" className="w-32 mb-2" />
            </div>

            <h2 className="text-xl font-bold mb-8 text-[#354763] tracking-tight">Personalización</h2>

            {/* Material */}
            <div className="mb-4">
                <h3 className="text-sm font-semibold text-black uppercase tracking-wider mb-3">Tipo de mueble</h3>
                <div className="flex gap-2">
                    {MATERIAL_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => handleMaterialChange(opt.value as ModuleMaterial)}
                            className={`flex-1 py-2.5 px-4 rounded-xl border-2 transition-all font-bold text-xs uppercase tracking-widest ${currentMaterial === opt.value
                                ? 'bg-[#354763] text-white border-[#354763] shadow-lg shadow-[#354763]/20'
                                : 'bg-white text-black/70 border-transparent hover:border-[#354763]/10 hover:bg-[#354763]/5'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-px w-full bg-[#354763]/5 my-6" />

            {selectedModuleId ? (
                <>

                    {/* Steel Configuration */}
                    {currentMaterial === 'steel' && (
                        <div className="mb-8">
                            <h3 className="text-[10px] uppercase tracking-widest font-extrabold text-black mb-4 ml-1">Paneles</h3>
                            <div className="flex flex-col gap-3">
                                {[
                                    { key: 'back', label: 'Panel Trasero' },
                                    { key: 'left', label: 'Panel Izquierdo' },
                                    { key: 'right', label: 'Panel Derecho' }
                                ].map(panel => (
                                    <label key={panel.key} className="flex items-center justify-between p-3 rounded-xl border-2 border-[#354763]/5 bg-white shadow-sm hover:border-[#354763]/20 cursor-pointer transition-all">
                                        <span className="text-sm font-bold text-black">{panel.label}</span>
                                        <div className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={targetModule.hasPanel[panel.key as keyof typeof targetModule.hasPanel] as boolean}
                                                onChange={(e) => handleUpdate({ hasPanel: { ...targetModule.hasPanel, [panel.key]: e.target.checked } })}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#354763]"></div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Dimensions */}
                    <div className="mb-8">
                        <h3 className="text-[10px] uppercase tracking-widest font-extrabold text-black mb-4 ml-1">Dimensiones</h3>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold text-black mb-2.5 ml-1">ANCHO (COLUMNA)</label>
                                <div className="flex gap-2.5">
                                    {[350, 750].map((w) => (
                                        <button
                                            key={w}
                                            onClick={() => updateColumnWidth(selectedModuleId, w)}
                                            className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold text-sm ${targetModule.size.w === w
                                                ? 'bg-white border-[#354763] text-black shadow-md'
                                                : 'border-transparent text-black/60 hover:bg-[#354763]/5'
                                                }`}
                                        >
                                            {w}mm
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-black mb-2.5 ml-1">ALTO (FILA)</label>
                                <div className="flex gap-2.5">
                                    {[350, 750].map((h) => (
                                        <button
                                            key={h}
                                            onClick={() => updateRowHeight(selectedModuleId, h)}
                                            className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold text-sm ${targetModule.size.h === h
                                                ? 'bg-white border-[#354763] text-black shadow-md'
                                                : 'border-transparent text-black/60 hover:bg-[#354763]/5'
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
                <div className="p-6 bg-[#354763]/10 border-2 border-dashed border-[#354763]/20 rounded-2xl text-center mb-8">
                    <p className="text-black text-sm font-bold leading-relaxed">Selecciona un módulo en la vista 3D para editar sus dimensiones y estilo.</p>
                </div>
            )}

            <div className="h-px w-full bg-[#354763]/5 my-6" />

            {/* Colors */}
            <div>
                <h3 className="text-[10px] uppercase tracking-widest font-extrabold text-black mb-5 ml-1">Color</h3>
                <div className="grid grid-cols-2 gap-3">
                    {currentColors.map((col) => (
                        <button
                            key={col.value}
                            onClick={() => handleColorChange(col.value)}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${targetModule.color === col.value
                                ? 'border-[#354763] bg-white shadow-lg shadow-[#354763]/5'
                                : 'border-transparent hover:bg-[#354763]/5 hover:border-[#354763]/10'
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
