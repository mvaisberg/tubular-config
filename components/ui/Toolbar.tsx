"use client";

import { useState } from 'react';
import { useConfigStore } from '@/lib/store';
import { ModuleConfig } from '@/lib/types';
import { Plus, Trash2, RotateCcw, Target, Save, ShoppingBag, Layout } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { SaveModal } from './SaveModal';

export const Toolbar = () => {
    const selectedModuleId = useConfigStore((state) => state.selectedModuleId);
    const modules = useConfigStore((state) => state.modules);
    const totalPrice = useConfigStore((state) => state.totalPrice);
    const addModule = useConfigStore((state) => state.actions.addModule);
    const removeModule = useConfigStore((state) => state.actions.removeModule);
    const reset = useConfigStore((state) => state.actions.reset);
    const triggerCameraReset = useConfigStore((state) => state.actions.triggerCameraReset);
    const environment = useConfigStore((state) => state.environment);
    const setEnvironment = useConfigStore((state) => state.actions.setEnvironment);

    const toggleEnvironment = () => {
        if (environment === 'none') setEnvironment('modern');
        else if (environment === 'modern') setEnvironment('industrial');
        else setEnvironment('none');
    };

    const [isSaving, setIsSaving] = useState(false);
    const [isSavingProduct, setIsSavingProduct] = useState(false);
    const [modalData, setModalData] = useState<{ isOpen: boolean; type: "quote" | "product" }>({
        isOpen: false,
        type: "quote"
    });

    const supabase = createClient();
    const searchParams = useSearchParams();
    const isAdmin = searchParams.get('admin') === 'true';

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

    const onSave = async (formData: { name: string; sku?: string; description?: string }) => {
        if (modules.length === 0) return;

        if (modalData.type === "quote") {
            setIsSaving(true);
            const bomSummary = useConfigStore.getState().bomSummary;
            const finalConfiguration = { modules, bom: bomSummary };
            const { error } = await supabase.from('quotes').insert([{
                client_name: formData.name,
                configuration: finalConfiguration,
                total_price_ars: totalPrice,
                total_price_usd: totalPrice / (useConfigStore.getState().settings?.usd_exchange_rate || 1000)
            }]);
            if (error) alert("Error al guardar cotización");
            else {
                alert("Cotización guardada exitosamente");
                setModalData(prev => ({ ...prev, isOpen: false }));
            }
            setIsSaving(false);
        } else {
            setIsSavingProduct(true);
            const { error } = await supabase.from('preconfigured_products').insert([{
                name: formData.name,
                sku: formData.sku || `PROD-${Date.now()}`,
                description: formData.description,
                configuration: modules,
            }]);

            if (error) {
                alert("Error al guardar producto");
            } else {
                alert("Producto guardado exitosamente");
                setModalData(prev => ({ ...prev, isOpen: false }));
            }
            setIsSavingProduct(false);
        }
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
                })} className="px-4 py-2 bg-black text-white rounded-full hover:bg-black/90 font-medium">
                    Comenzar Configuración
                </button>
            ) : (
                <>
                    <button
                        onClick={() => setModalData({ isOpen: true, type: "quote" })}
                        className="flex items-center gap-2 px-4 py-2 bg-[#354763] text-white rounded-full hover:bg-[#354763]/90 font-medium transition-colors"
                        title="Guardar Cotización"
                    >
                        <Save size={18} />
                        Cotizar
                    </button>

                    {isAdmin && (
                        <button
                            onClick={() => setModalData({ isOpen: true, type: "product" })}
                            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full hover:bg-black/90 font-medium transition-colors"
                            title="Guardar como Producto"
                        >
                            <ShoppingBag size={18} />
                            Guardar Producto
                        </button>
                    )}

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

            <button
                onClick={toggleEnvironment}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${environment !== 'none' ? 'bg-[#354763] text-white shadow-md' : 'text-[#354763] hover:bg-gray-100'}`}
                title="Cambiar Ambiente"
            >
                <Layout size={18} />
                <span>Ambientar</span>
            </button>

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

            <SaveModal
                isOpen={modalData.isOpen}
                type={modalData.type}
                title={modalData.type === "product" ? "Guardar Nuevo Producto" : "Nueva Cotización"}
                isSaving={modalData.type === "product" ? isSavingProduct : isSaving}
                onClose={() => setModalData(prev => ({ ...prev, isOpen: false }))}
                onSave={onSave}
            />
        </div>
    );
};
