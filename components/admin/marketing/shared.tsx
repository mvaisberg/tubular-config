"use client";

// Piezas compartidas del módulo de marketing: tipos, paleta, CRUD y modal de edición.
// Lo usan CalendarBoard (/admin/marketing) y KanbanBoard (/admin/ideas) sobre la
// misma tabla marketing_items: una idea agendada aparece en ambos lados.

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, Trash2, ImagePlus, Loader2 } from "lucide-react";
/* eslint-disable @next/next/no-img-element */

export interface MarketingItem {
    id: string;
    title: string;
    description: string | null;
    color: string;
    image_url: string | null;
    status: "idea" | "produccion" | "listo";
    scheduled_date: string | null; // YYYY-MM-DD
    sort_order: number;
}

// Paleta tipo Trello: nombre guardado en DB → clases visuales.
export const COLORS: Record<string, { chip: string; strip: string; label: string }> = {
    green: { chip: "bg-emerald-100 text-emerald-900 border-emerald-300", strip: "bg-emerald-500", label: "Verde" },
    yellow: { chip: "bg-yellow-100 text-yellow-900 border-yellow-300", strip: "bg-yellow-400", label: "Amarillo" },
    orange: { chip: "bg-orange-100 text-orange-900 border-orange-300", strip: "bg-orange-500", label: "Naranja" },
    red: { chip: "bg-red-100 text-red-900 border-red-300", strip: "bg-red-500", label: "Rojo" },
    purple: { chip: "bg-purple-100 text-purple-900 border-purple-300", strip: "bg-purple-500", label: "Violeta" },
    blue: { chip: "bg-blue-100 text-blue-900 border-blue-300", strip: "bg-blue-500", label: "Azul" },
    sky: { chip: "bg-sky-100 text-sky-900 border-sky-300", strip: "bg-sky-400", label: "Celeste" },
    pink: { chip: "bg-pink-100 text-pink-900 border-pink-300", strip: "bg-pink-400", label: "Rosa" },
    slate: { chip: "bg-slate-100 text-slate-800 border-slate-300", strip: "bg-slate-400", label: "Gris" },
};
export const colorOf = (name: string) => COLORS[name] || COLORS.slate;

// Estado + CRUD optimista compartido por ambos tableros.
export function useMarketingItems(initialItems: MarketingItem[]) {
    const supabase = createClient();
    const [items, setItems] = useState<MarketingItem[]>(initialItems);
    const [editing, setEditing] = useState<MarketingItem | null>(null);

    const patchItem = async (id: string, patch: Partial<MarketingItem>) => {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
        setEditing((e) => (e && e.id === id ? { ...e, ...patch } : e));
        await supabase.from("marketing_items").update(patch).eq("id", id);
    };

    const createItem = async (partial: Partial<MarketingItem>) => {
        const base = {
            title: partial.title || "Nueva idea",
            description: partial.description ?? null,
            color: partial.color || "slate",
            status: partial.status || "idea",
            scheduled_date: partial.scheduled_date ?? null,
            sort_order: Date.now(),
        };
        const { data } = await supabase.from("marketing_items").insert(base).select("*").single();
        if (data) {
            setItems((prev) => [...prev, data as MarketingItem]);
            setEditing(data as MarketingItem);
        }
    };

    const deleteItem = async (id: string) => {
        setItems((prev) => prev.filter((i) => i.id !== id));
        setEditing(null);
        await supabase.from("marketing_items").delete().eq("id", id);
    };

    return { items, editing, setEditing, patchItem, createItem, deleteItem };
}

export function EditModal({ item, onClose, onPatch, onDelete }: {
    item: MarketingItem;
    onClose: () => void;
    onPatch: (patch: Partial<MarketingItem>) => void;
    onDelete: () => void;
}) {
    const supabase = createClient();
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const uploadImage = async (file: File) => {
        setUploading(true);
        try {
            const ext = file.name.split(".").pop() || "jpg";
            const path = `${item.id}-${Date.now()}.${ext}`;
            const { error } = await supabase.storage.from("marketing").upload(path, file, { upsert: true });
            if (error) throw error;
            const { data } = supabase.storage.from("marketing").getPublicUrl(path);
            onPatch({ image_url: data.publicUrl });
        } catch (e) {
            alert("No se pudo subir la imagen: " + (e as Error).message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className={`relative ${item.image_url ? "" : `h-3 ${colorOf(item.color).strip}`}`}>
                    {item.image_url && (
                        <>
                            <img src={item.image_url} alt="" className="w-full h-44 object-cover rounded-t-2xl" />
                            <button
                                onClick={() => onPatch({ image_url: null })}
                                className="absolute top-2 right-10 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"
                                title="Quitar imagen"
                            >
                                <Trash2 size={14} />
                            </button>
                            <button onClick={onClose} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70">
                                <X size={14} />
                            </button>
                        </>
                    )}
                </div>

                <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                        <input
                            value={item.title}
                            onChange={(e) => onPatch({ title: e.target.value })}
                            className="flex-1 text-lg font-semibold text-gray-900 border-0 border-b border-transparent focus:border-gray-300 focus:outline-none bg-transparent"
                            placeholder="Título"
                        />
                        {!item.image_url && (
                            <button onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100">
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <textarea
                        value={item.description || ""}
                        onChange={(e) => onPatch({ description: e.target.value })}
                        rows={3}
                        placeholder="Descripción, copy, hashtags…"
                        className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
                    />

                    <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Color</div>
                        <div className="flex gap-1.5 flex-wrap">
                            {Object.entries(COLORS).map(([name, c]) => (
                                <button
                                    key={name}
                                    onClick={() => onPatch({ color: name })}
                                    className={`w-8 h-8 rounded-lg ${c.strip} ${item.color === name ? "ring-2 ring-offset-2 ring-gray-900" : "opacity-70 hover:opacity-100"}`}
                                    title={c.label}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Estado</div>
                            <select
                                value={item.status}
                                onChange={(e) => onPatch({ status: e.target.value as MarketingItem["status"] })}
                                className="w-full text-sm border border-gray-200 rounded-lg p-2 bg-white"
                            >
                                <option value="idea">💡 Idea</option>
                                <option value="produccion">🎬 En producción</option>
                                <option value="listo">✅ Listo</option>
                            </select>
                        </div>
                        <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Fecha de publicación</div>
                            <input
                                type="date"
                                value={item.scheduled_date || ""}
                                onChange={(e) => onPatch({ scheduled_date: e.target.value || null })}
                                className="w-full text-sm border border-gray-200 rounded-lg p-2 bg-white"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        <button
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                            {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                            {item.image_url ? "Cambiar imagen" : "Subir imagen"}
                        </button>
                        <button
                            onClick={() => { if (confirm("¿Eliminar esta idea?")) onDelete(); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                        >
                            <Trash2 size={15} /> Eliminar
                        </button>
                    </div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadImage(f);
                            e.target.value = "";
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
