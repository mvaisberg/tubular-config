"use client";

import { useState } from 'react';
import { useConfigStore } from '@/lib/store';
import { ModuleConfig } from '@/lib/types';
import { Plus, Trash2, RotateCcw, Target, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export const Toolbar = () => {
    const selectedModuleId = useConfigStore((state) => state.selectedModuleId);
    const modules = useConfigStore((state) => state.modules);
    const totalPrice = useConfigStore((state) => state.totalPrice);
    const addModule = useConfigStore((state) => state.actions.addModule);
    const removeModule = useConfigStore((state) => state.actions.removeModule);
    const reset = useConfigStore((state) => state.actions.reset);
    const triggerCameraReset = useConfigStore((state) => state.actions.triggerCameraReset);

    const [isSaving, setIsSaving] = useState(false);
    const supabase = createClient();

    const handleAdd = (direction: 'right' | 'left' | 'top' | 'bottom' | 'front' | 'back') => {
        // ... (existing handleAdd code) ...
        const selected = modules.find(m => m.id === selectedModuleId);
        if (!selected) {
            // If nothing selected, maybe add at 0,0,0 if empty?
            if (modules.length === 0) {
                addModule({
                    id: crypto.randomUUID(),
                    position: { x: 0, y: 0, z: 0 },
                    size: { w: 750, h: 350, d: 350 },
                    color: 'white',
                    material: 'steel',
                    hasPanel: { top: true, bottom: true, left: true, right: true, front: false, back: true }
                });
            }
            return;
        }
        // ...
    };

    const handleSaveQuote = async () => {
        if (modules.length === 0) return;
        setIsSaving(true);

        const name = prompt("Ingrese nombre del cliente para la cotización:");

        // Calculate USD total based on settings
        const { data: settings } = await supabase.from('settings').select('usd_exchange_rate').eq('id', 1).single();
        const usdRate = settings?.usd_exchange_rate || 1000; // fallback
        const totalUsd = totalPrice / usdRate;

        const { error } = await supabase.from('quotes').insert([{
            client_name: name || 'Sin Nombre',
            configuration: modules,
            total_price_ars: totalPrice,
            total_price_usd: totalUsd
        }]);

        if (error) {
            alert("Error al guardar cotización");
            console.error(error);
        } else {
            alert("Cotización guardada exitosamente");
        }
        setIsSaving(false);
    };

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm p-4 rounded-full shadow-lg border border-gray-100 flex gap-4 items-center">
            {modules.length === 0 ? (
                <button onClick={() => addModule({
                    id: crypto.randomUUID(),
                    position: { x: 0, y: 0, z: 0 },
                    size: { w: 750, h: 350, d: 350 },
                    color: 'white',
                    material: 'steel',
                    hasPanel: { top: true, bottom: true, left: true, right: true, front: false, back: true }
                })} className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 font-medium">
                    Start Configuration
                </button>
            ) : (
                <>
                    <button
                        onClick={handleSaveQuote}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 font-medium disabled:opacity-50 transition-colors"
                        title="Guardar Cotización"
                    >
                        <Save size={18} />
                        {isSaving ? "Guardando..." : "Guardar Cotización"}
                    </button>

                    <div className="h-6 w-px bg-gray-200 mx-2" />
                </>
            )}

            {selectedModuleId && (() => {
                const selectedModule = modules.find(m => m.id === selectedModuleId);
                const hasModuleAbove = selectedModule ? modules.some(m =>
                    Math.abs(m.position.x - selectedModule.position.x) < 1 &&
                    Math.abs(m.position.y - (selectedModule.position.y + selectedModule.size.h)) < 1 &&
                    Math.abs(m.position.z - selectedModule.position.z) < 1
                ) : false;

                return (
                    <button
                        onClick={() => !hasModuleAbove && removeModule(selectedModuleId)}
                        disabled={hasModuleAbove}
                        className={`p-2 rounded-full transition-colors ${hasModuleAbove
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-red-500 hover:bg-red-50'
                            }`}
                        title={hasModuleAbove ? "No se puede eliminar porque sostiene otro módulo" : "Eliminar módulo"}
                    >
                        <Trash2 size={20} />
                    </button>
                );
            })()}

            <div className="h-6 w-px bg-gray-200 mx-2" />

            <button
                onClick={reset}
                className="p-2 text-red-500 hover:bg-red-50 rounded-full"
                title="Reset All"
            >
                <RotateCcw size={20} />
            </button>

            <button
                onClick={triggerCameraReset}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
                title="Center Camera"
            >
                <Target size={20} />
            </button>
        </div>
    );
};
