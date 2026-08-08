"use client";

import { useConfigStore } from '@/lib/store';
import { PRESETS, Preset } from '@/lib/presets';
import { X } from 'lucide-react';
/* eslint-disable @next/next/no-img-element */

export const PresetsModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const setModules = useConfigStore((state) => state.actions.setModules);
    const setHasWheels = useConfigStore((state) => state.actions.setHasWheels);
    const selectModule = useConfigStore((state) => state.actions.selectModule);
    const triggerCameraReset = useConfigStore((state) => state.actions.triggerCameraReset);

    if (!open) return null;

    const applyPreset = (preset: Preset) => {
        // Clonar los módulos para no mutar la definición del preset al editar después.
        setModules(preset.modules.map((m) => ({ ...m, position: { ...m.position }, size: { ...m.size }, hasPanel: { ...m.hasPanel } })));
        setHasWheels(preset.hasWheels);
        selectModule(null);
        triggerCameraReset();
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl p-6 md:p-8"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-1">
                    <h2 className="text-xl font-bold text-[#354763]">Empezá desde un modelo</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        title="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                    Elegí una base y después modificá medidas, colores y paneles a gusto.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {PRESETS.map((preset) => (
                        <button
                            key={preset.id}
                            onClick={() => applyPreset(preset)}
                            className="group text-left rounded-2xl border-2 border-gray-100 hover:border-[#354763] hover:shadow-lg transition-all overflow-hidden bg-[#fafafa]"
                        >
                            <div className="aspect-square w-full bg-[#f5f5f5] overflow-hidden">
                                <img
                                    src={`/configurador/presets/${preset.id}.png`}
                                    alt={preset.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                            </div>
                            <div className="p-3">
                                <div className="font-bold text-sm text-[#354763]">{preset.name}</div>
                                <div className="text-xs text-gray-500 mt-0.5 leading-snug">{preset.description}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
