"use client";

import { useConfigStore } from '@/lib/store';
import { ModuleConfig, ModuleMaterial, Dimension } from '@/lib/types';
import { useMemo } from 'react';

const MATERIAL_OPTIONS = [
    { value: 'steel', label: 'Acero' },
    { value: 'acrylic', label: 'Acrílico' },
];

const STEEL_COLORS = [
    { value: 'white', label: 'Blanco', hex: '#FFFFFF', opacity: 1 },
    { value: 'black', label: 'Negro', hex: '#000000', opacity: 1 },
    { value: 'beige', label: 'Beige', hex: '#F5F5DC', opacity: 1 },
];

const ACRYLIC_COLORS = [
    { value: 'transparent', label: 'Transparente', hex: '#E0F7FA', opacity: 0.3 },
    { value: 'orange_translucent', label: 'Naranja', hex: '#FF9800', opacity: 0.5 },
    { value: 'blue_translucent', label: 'Azul', hex: '#2196F3', opacity: 0.5 },
    { value: 'green_translucent', label: 'Verde', hex: '#4CAF50', opacity: 0.5 },
];

export const Sidebar = () => {
    const modules = useConfigStore((state) => state.modules);
    const selectedModuleId = useConfigStore((state) => state.selectedModuleId);
    const updateModule = useConfigStore((state) => state.actions.updateModule);
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
                bottom: false,
                left: false,
                right: false,
                front: false,
                back: false
            };
            // Default acrylic color
            updates.color = 'transparent';
        } else {
            // Default steel panels (all except front)
            updates.hasPanel = {
                top: true,
                bottom: true,
                left: true,
                right: true,
                front: false,
                back: true
            };
            // Default steel color
            updates.color = 'white';
        }

        handleUpdate(updates);
    };

    const currentMaterial = targetModule?.material || 'steel';
    const currentColors = currentMaterial === 'steel' ? STEEL_COLORS : ACRYLIC_COLORS;

    return (
        <div className="absolute top-0 left-0 h-full w-80 bg-white shadow-xl border-r border-gray-200 p-6 overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Configuración</h2>

            {selectedModuleId ? (
                <div className="mb-4 p-2 bg-blue-50 text-blue-700 text-sm rounded border border-blue-100">
                    Editando módulo seleccionado
                </div>
            ) : (
                <div className="mb-4 p-2 bg-gray-50 text-gray-600 text-sm rounded border border-gray-100">
                    Editando todos los módulos
                </div>
            )}

            {/* Material */}
            <div className="mb-8">
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

            {/* Dimensions */}
            <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Dimensiones</h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-700 mb-2">Ancho</label>
                        <div className="flex gap-2">
                            {[350, 750].map((w) => (
                                <button
                                    key={w}
                                    onClick={() => handleUpdate({ size: { ...targetModule.size, w: w as Dimension } })}
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
                        <label className="block text-sm text-gray-700 mb-2">Alto</label>
                        <div className="flex gap-2">
                            {[350, 750].map((h) => (
                                <button
                                    key={h}
                                    onClick={() => handleUpdate({ size: { ...targetModule.size, h: h as Dimension } })}
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

            {/* Colors */}
            <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Color</h3>
                <div className="grid grid-cols-2 gap-3">
                    {currentColors.map((col) => (
                        <button
                            key={col.value}
                            onClick={() => handleUpdate({ color: col.value })}
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
