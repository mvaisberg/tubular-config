"use client";

import { useState } from "react";
import { X, Save, ShoppingBag, Info } from "lucide-react";

interface SaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { name: string; sku?: string; description?: string }) => void;
    title: string;
    type: "quote" | "product";
    isSaving: boolean;
}

export const SaveModal = ({ isOpen, onClose, onSave, title, type, isSaving }: SaveModalProps) => {
    const [formData, setFormData] = useState({
        name: "",
        sku: "",
        description: ""
    });

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const isProduct = type === "product";

    return (
        <div className="fixed inset-0 bg-[#354763]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
            <div className="bg-[#ebecdf] rounded-2xl w-full max-w-md shadow-2xl border border-white/20 overflow-hidden transform animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-[#354763] p-6 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-2 rounded-lg">
                            {isProduct ? <ShoppingBag size={20} /> : <Save size={20} />}
                        </div>
                        <h3 className="text-xl font-bold tracking-tight">{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-[#354763]/60 ml-1">
                            {isProduct ? "Nombre del Producto" : "Nombre del Cliente"}
                        </label>
                        <input
                            autoFocus
                            required
                            className="w-full bg-white border-2 border-transparent focus:border-[#aab799] outline-none p-3.5 rounded-xl shadow-sm transition-all text-[#354763] font-medium"
                            placeholder={isProduct ? "Ej: Estante Tubular V1" : "Ej: Juan Pérez"}
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    {isProduct && (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-[#354763]/60 ml-1">
                                    SKU (Opcional)
                                </label>
                                <input
                                    className="w-full bg-white border-2 border-transparent focus:border-[#aab799] outline-none p-3.5 rounded-xl shadow-sm transition-all text-[#354763] font-mono text-sm"
                                    placeholder="TUB-350-B"
                                    value={formData.sku}
                                    onChange={e => setFormData({ ...formData, sku: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-[#354763]/60 ml-1">
                                    Descripción Corta
                                </label>
                                <textarea
                                    className="w-full bg-white border-2 border-transparent focus:border-[#aab799] outline-none p-3.5 rounded-xl shadow-sm transition-all text-[#354763] min-h-[80px] resize-none"
                                    placeholder="Características especiales..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                        </>
                    )}

                    <div className="bg-[#aab799]/10 p-4 rounded-xl flex gap-3 items-start border border-[#aab799]/20">
                        <Info size={16} className="text-[#aab799] shrink-0 mt-0.5" />
                        <p className="text-[11px] text-[#354763]/70 leading-relaxed italic">
                            {isProduct
                                ? "Este producto se guardará con la configuración actual de módulos. El precio se actualizará automáticamente si cambian los costos."
                                : "La cotización guardará el desglose de partes y precios vigentes en este momento."}
                        </p>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3.5 rounded-xl font-bold text-[#354763] hover:bg-black/5 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-[2] bg-[#354763] hover:bg-[#2a394f] text-white py-3.5 rounded-xl font-bold shadow-lg shadow-[#354763]/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSaving ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Save size={18} />
                                    {isProduct ? "Guardar Producto" : "Guardar Cotización"}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
