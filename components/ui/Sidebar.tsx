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
        <div className="h-full w-80 bg-white shadow-xl border-r border-gray-200 p-6 overflow-y-auto flex-shrink-0 z-10">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Configuración</h2>

            {/* Material */}
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Material</h3>
                <div className="flex gap-2">
                    {MATERIAL_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => handleMaterialChange(opt.value as ModuleMaterial)}
                            className={`flex-1 py-2 px-4 rounded-lg border transition-all ${currentMaterial === opt.value
                                ? 'bg-black text-white border-black'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <hr className="my-6 border-gray-100" />

            {selectedModuleId ? (
                <>
                    <div className="mb-6 p-3 bg-blue-50 text-blue-800 text-sm rounded-lg border border-blue-100 flex justify-between items-center">
                        <span className="font-medium">Módulo seleccionado</span>
                    </div>

                    {/* Steel Configuration */}
                    {currentMaterial === 'steel' && (
                        <div className="mb-8">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Estilo Acero</h3>
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => handleSteelStyleChange('all')}
                                    className={`py-2 px-3 text-left rounded border ${currentSteelStyle === 'all' ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-700'}`}
                                >
                                    Completo (5 caras)
                                </button>
                                <button
                                    onClick={() => handleSteelStyleChange('no-back')}
                                    className={`py-2 px-3 text-left rounded border ${currentSteelStyle === 'no-back' ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-700'}`}
                                >
                                    Abierto atrás (4 caras)
                                </button>
                                <button
                                    onClick={() => handleSteelStyleChange('top-bottom')}
                                    className={`py-2 px-3 text-left rounded border ${currentSteelStyle === 'top-bottom' ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-700'}`}
                                >
                                    Solo Arriba/Abajo (2 caras)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Dimensions */}
                    <div className="mb-8">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Dimensiones</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-700 mb-2">Ancho (Columna)</label>
                                <div className="flex gap-2">
                                    {[350, 750].map((w) => (
                                        <button
                                            key={w}
                                            onClick={() => updateColumnWidth(selectedModuleId, w)}
                                            className={`flex-1 py-2 rounded border ${targetModule.size.w === w
                                                ? 'bg-gray-100 border-black font-medium'
                                                : 'border-gray-200 text-gray-600'
                                                }`}
                                        >
                                            {w}mm
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-700 mb-2">Alto (Fila)</label>
                                <div className="flex gap-2">
                                    {[350, 750].map((h) => (
                                        <button
                                            key={h}
                                            onClick={() => updateRowHeight(selectedModuleId, h)}
                                            className={`flex-1 py-2 rounded border ${targetModule.size.h === h
                                                ? 'bg-gray-100 border-black font-medium'
                                                : 'border-gray-200 text-gray-600'
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
                <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg text-center mb-8">
                    <p className="text-gray-500 text-sm">Selecciona un módulo en la vista 3D para editar sus dimensiones y estilo.</p>
                </div>
            )}

            <hr className="my-6 border-gray-100" />

            {/* Colors */}
            <div className="mt-auto">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Color</h3>
                <div className="grid grid-cols-2 gap-3">
                    {currentColors.map((col) => (
                        <button
                            key={col.value}
                            onClick={() => handleColorChange(col.value)}
                            className={`flex items-center gap-2 p-2 rounded border transition-all ${targetModule.color === col.value
                                ? 'border-black bg-gray-50 ring-1 ring-black'
                                : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <div
                                className="w-6 h-6 rounded-full border border-gray-200 shadow-sm"
                                style={{ backgroundColor: col.hex, opacity: col.opacity || 1 }}
                            />
                            <span className="text-sm text-gray-700">{col.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
