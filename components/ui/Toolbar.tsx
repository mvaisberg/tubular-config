"use client";

import { useState } from 'react';
import { useConfigStore } from '@/lib/store';
import { ModuleConfig } from '@/lib/types';
import { Plus, Trash2, RotateCcw, Target, Save, ShoppingBag, Layout, Ruler } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { SaveModal } from './SaveModal';
import { Share2 } from 'lucide-react';

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
    const showDimensions = useConfigStore((state) => state.showDimensions);
    const toggleDimensions = useConfigStore((state) => state.actions.toggleDimensions);

    const toggleEnvironment = () => {
        if (environment === 'none') setEnvironment('modern');
        else if (environment === 'modern') setEnvironment('industrial');
        else setEnvironment('none');
    };

    const [isSaving, setIsSaving] = useState(false);
    const [isSavingProduct, setIsSavingProduct] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [shareLink, setShareLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

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

    const saveConfiguration = async () => {
        if (modules.length === 0) return;
        setIsSaving(true);
        const bomSummary = useConfigStore.getState().bomSummary;
        const finalConfiguration = { modules, bom: bomSummary };
        const { data, error } = await supabase.from('quotes').insert([{
            client_name: 'Configuración Guardada',
            configuration: finalConfiguration,
            total_price_ars: totalPrice,
            total_price_usd: totalPrice / (useConfigStore.getState().settings?.usd_exchange_rate || 1000)
        }]).select('id').single();

        setIsSaving(false);
        if (error) {
            alert("Error al guardar la configuración.");
        } else if (data) {
            setShareLink(`${window.location.origin}/?quote=${data.id}`);
            setCopied(false);
        }
    };

    const onSaveProduct = async (formData: { name: string; sku?: string; description?: string }) => {
        if (modules.length === 0) return;
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
            setIsProductModalOpen(false);
        }
        setIsSavingProduct(false);
    };

    return (
        <>
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
                            onClick={saveConfiguration}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-[#354763] text-white rounded-full hover:bg-[#354763]/90 font-medium transition-colors disabled:opacity-50"
                            title="Haz click para obtener un enlace único a este diseño"
                        >
                            {isSaving ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Share2 size={18} />
                            )}
                            Guardar configuración
                        </button>

                        {isAdmin && (
                            <button
                                onClick={() => setIsProductModalOpen(true)}
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

                {selectedModuleId && modules.length > 1 && (() => {
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

                <button
                    onClick={toggleDimensions}
                    className={`p-2 rounded-full transition-colors ${showDimensions ? 'bg-[#354763] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                    title="Mostrar Medidas"
                >
                    <Ruler size={20} />
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

            </div>

            <SaveModal
                isOpen={isProductModalOpen}
                type="product"
                title="Guardar Nuevo Producto"
                isSaving={isSavingProduct}
                onClose={() => setIsProductModalOpen(false)}
                onSave={onSaveProduct}
            />

            {shareLink && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#354763]/40 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95">
                        <div className="flex items-center gap-3 text-[#354763]">
                            <Share2 size={24} />
                            <h3 className="text-xl font-black tracking-tight">¡Configuración Guardada!</h3>
                        </div>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">
                            Copiá este enlace único para guardar o compartir tu diseño en cualquier momento.
                        </p>

                        <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner">
                            <input
                                readOnly
                                value={shareLink}
                                className="bg-transparent flex-1 text-[11px] font-mono text-slate-600 outline-none"
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(shareLink);
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 2000);
                                }}
                                className="px-4 py-2 bg-[#354763] text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-[#2a3850] transition-colors whitespace-nowrap shadow-lg shadow-[#354763]/20"
                            >
                                {copied ? 'Copiado!' : 'Copiar'}
                            </button>
                        </div>

                        <button
                            onClick={() => setShareLink(null)}
                            className="w-full pt-4 pb-1 text-xs font-bold text-slate-400 hover:text-[#354763] transition-colors"
                        >
                            Cerrar ventana
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
