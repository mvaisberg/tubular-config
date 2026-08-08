"use client";

import { useEffect, useState } from 'react';
import { useConfigStore } from '@/lib/store';
import { ModuleConfig } from '@/lib/types';
import { Plus, Trash2, RotateCcw, Target, Save, ShoppingBag, Layout, Ruler, Loader2, Undo2, Redo2, Camera, LayoutGrid } from 'lucide-react';
import { PresetsModal } from './PresetsModal';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { SaveModal } from './SaveModal';
import { Share2 } from 'lucide-react';
import { useProgress } from '@react-three/drei';

export const Toolbar = () => {
    const selectedModuleId = useConfigStore((state) => state.selectedModuleId);
    const modules = useConfigStore((state) => state.modules);
    const totalPrice = useConfigStore((state) => state.totalPrice);
    const addModule = useConfigStore((state) => state.actions.addModule);
    const removeModule = useConfigStore((state) => state.actions.removeModule);
    const reset = useConfigStore((state) => state.actions.reset);
    const triggerCameraReset = useConfigStore((state) => state.actions.triggerCameraReset);
    const undo = useConfigStore((state) => state.actions.undo);
    const redo = useConfigStore((state) => state.actions.redo);
    const canUndo = useConfigStore((state) => state.history.length > 0);
    const canRedo = useConfigStore((state) => state.future.length > 0);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const tag = target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

            const isMod = e.ctrlKey || e.metaKey;
            if (!isMod) return;
            const k = e.key.toLowerCase();

            if (k === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            } else if ((k === 'z' && e.shiftKey) || k === 'y') {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [undo, redo]);
    const environment = useConfigStore((state) => state.environment);
    const setEnvironment = useConfigStore((state) => state.actions.setEnvironment);
    const showDimensions = useConfigStore((state) => state.showDimensions);
    const toggleDimensions = useConfigStore((state) => state.actions.toggleDimensions);
    const showAddButtons = useConfigStore((state) => state.showAddButtons);
    const toggleAddButtons = useConfigStore((state) => state.actions.toggleAddButtons);
    const { active, progress } = useProgress();

    const toggleEnvironment = () => {
        setEnvironment(environment === 'none' ? 'room' : 'none');
    };

    // Captura el canvas 3D (preserveDrawingBuffer ya está activo) y lo descarga como PNG.
    const downloadImage = () => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const a = document.createElement('a');
        a.href = (canvas as HTMLCanvasElement).toDataURL('image/png');
        a.download = 'mi-mueble-tubular.png';
        a.click();
    };

    const [isPresetsOpen, setIsPresetsOpen] = useState(false);
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
            total_price_ars: Math.round(totalPrice),
            total_price_usd: Math.round(totalPrice / (useConfigStore.getState().settings?.usd_exchange_rate || 1000))
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
            <div className="toolbar-mobile-override absolute bottom-3 md:bottom-8 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md p-2 md:p-3 rounded-full md:rounded-3xl shadow-2xl border border-[#354763]/10 flex gap-1.5 md:gap-1 items-center w-[95%] sm:w-auto overflow-x-auto no-scrollbar z-30 justify-start sm:justify-center">
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
                ) : null}

                {/* Modelos de catálogo — desktop por ahora */}
                <button
                    onClick={() => setIsPresetsOpen(true)}
                    className="hidden md:flex flex-col items-center gap-1 p-2 md:px-3 md:py-1.5 rounded-2xl transition-colors text-[#354763] hover:bg-gray-100"
                    title="Empezar desde un modelo"
                >
                    <LayoutGrid size={20} />
                    <span className="hidden md:block text-[10px] font-semibold leading-none">Modelos</span>
                </button>

                <button
                    onClick={toggleEnvironment}
                    disabled={active}
                    className={`flex flex-col items-center gap-1 p-2 md:px-3 md:py-1.5 rounded-2xl transition-all ${environment !== 'none' ? 'bg-[#354763] text-white shadow-md' : 'text-[#354763] hover:bg-gray-100'} ${active ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Cambiar Ambiente"
                >
                    <Layout size={20} />
                    <span className="hidden md:block text-[10px] font-semibold leading-none">Ambientar</span>
                </button>

                <button
                    onClick={toggleDimensions}
                    className={`flex flex-col items-center gap-1 p-2 md:px-3 md:py-1.5 rounded-2xl transition-colors ${showDimensions ? 'bg-[#354763] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                    title="Mostrar Medidas"
                >
                    <Ruler size={20} />
                    <span className="hidden md:block text-[10px] font-semibold leading-none">Medidas</span>
                </button>

                <button
                    onClick={toggleAddButtons}
                    className={`block md:hidden p-2 rounded-full transition-colors ${showAddButtons ? 'bg-[#354763] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                    title="Agregar Módulos"
                >
                    <Plus size={20} />
                </button>

                {isAdmin && (
                    <button
                        onClick={() => setIsProductModalOpen(true)}
                        className="flex flex-col items-center gap-1 p-2 md:px-3 md:py-1.5 text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-colors"
                        title="Guardar como Producto"
                    >
                        <Save size={20} />
                        <span className="hidden md:block text-[10px] font-semibold leading-none">Guardar</span>
                    </button>
                )}

                <div className="h-6 w-px bg-gray-200 mx-2" />

                <button
                    onClick={undo}
                    disabled={!canUndo}
                    className="flex flex-col items-center gap-1 p-2 md:px-3 md:py-1.5 text-gray-600 hover:bg-gray-100 rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Deshacer (Ctrl+Z)"
                >
                    <Undo2 size={20} />
                    <span className="hidden md:block text-[10px] font-semibold leading-none">Deshacer</span>
                </button>

                <button
                    onClick={redo}
                    disabled={!canRedo}
                    className="flex flex-col items-center gap-1 p-2 md:px-3 md:py-1.5 text-gray-600 hover:bg-gray-100 rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Rehacer (Ctrl+Shift+Z)"
                >
                    <Redo2 size={20} />
                    <span className="hidden md:block text-[10px] font-semibold leading-none">Rehacer</span>
                </button>

                <button
                    onClick={reset}
                    className="flex flex-col items-center gap-1 p-2 md:px-3 md:py-1.5 text-red-500 hover:bg-red-50 rounded-2xl"
                    title="Reiniciar diseño"
                >
                    <RotateCcw size={20} />
                    <span className="hidden md:block text-[10px] font-semibold leading-none">Reiniciar</span>
                </button>

                <button
                    onClick={triggerCameraReset}
                    className="flex flex-col items-center gap-1 p-2 md:px-3 md:py-1.5 text-gray-500 hover:bg-gray-100 rounded-2xl"
                    title="Centrar cámara"
                >
                    <Target size={20} />
                    <span className="hidden md:block text-[10px] font-semibold leading-none">Centrar</span>
                </button>

                <button
                    onClick={downloadImage}
                    className="flex flex-col items-center gap-1 p-2 md:px-3 md:py-1.5 text-gray-500 hover:bg-gray-100 rounded-2xl"
                    title="Descargar imagen"
                >
                    <Camera size={20} />
                    <span className="hidden md:block text-[10px] font-semibold leading-none">Imagen</span>
                </button>

            </div>

            <PresetsModal open={isPresetsOpen} onClose={() => setIsPresetsOpen(false)} />

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
