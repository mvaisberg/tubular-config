"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CalendarDays, KanbanSquare, Plus, X, Trash2, ImagePlus, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
const COLORS: Record<string, { chip: string; strip: string; dot: string; label: string }> = {
    green: { chip: "bg-emerald-100 text-emerald-900 border-emerald-300", strip: "bg-emerald-500", dot: "bg-emerald-500", label: "Verde" },
    yellow: { chip: "bg-yellow-100 text-yellow-900 border-yellow-300", strip: "bg-yellow-400", dot: "bg-yellow-400", label: "Amarillo" },
    orange: { chip: "bg-orange-100 text-orange-900 border-orange-300", strip: "bg-orange-500", dot: "bg-orange-500", label: "Naranja" },
    red: { chip: "bg-red-100 text-red-900 border-red-300", strip: "bg-red-500", dot: "bg-red-500", label: "Rojo" },
    purple: { chip: "bg-purple-100 text-purple-900 border-purple-300", strip: "bg-purple-500", dot: "bg-purple-500", label: "Violeta" },
    blue: { chip: "bg-blue-100 text-blue-900 border-blue-300", strip: "bg-blue-500", dot: "bg-blue-500", label: "Azul" },
    sky: { chip: "bg-sky-100 text-sky-900 border-sky-300", strip: "bg-sky-400", dot: "bg-sky-400", label: "Celeste" },
    pink: { chip: "bg-pink-100 text-pink-900 border-pink-300", strip: "bg-pink-400", dot: "bg-pink-400", label: "Rosa" },
    slate: { chip: "bg-slate-100 text-slate-800 border-slate-300", strip: "bg-slate-400", dot: "bg-slate-400", label: "Gris" },
};
const colorOf = (name: string) => COLORS[name] || COLORS.slate;

const KANBAN_COLUMNS: { key: MarketingItem["status"]; title: string }[] = [
    { key: "idea", title: "💡 Ideas" },
    { key: "produccion", title: "🎬 En producción" },
    { key: "listo", title: "✅ Listo para subir" },
];

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const toISODate = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function MarketingModule({ initialItems }: { initialItems: MarketingItem[] }) {
    const supabase = createClient();
    const [items, setItems] = useState<MarketingItem[]>(initialItems);
    const [tab, setTab] = useState<"calendario" | "ideas">("calendario");
    const [editing, setEditing] = useState<MarketingItem | null>(null);
    const [dragId, setDragId] = useState<string | null>(null);

    const today = new Date();
    const [month, setMonth] = useState(today.getMonth());
    const [year, setYear] = useState(today.getFullYear());

    // ---------- persistencia ----------
    const patchItem = async (id: string, patch: Partial<MarketingItem>) => {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
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

    // ---------- drag & drop ----------
    const onDragStart = (e: React.DragEvent, id: string) => {
        setDragId(id);
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "move";
    };
    const allowDrop = (e: React.DragEvent) => e.preventDefault();

    // Kanban: soltar sobre una card = insertar antes; sobre la columna = al final.
    const dropOnColumn = (e: React.DragEvent, status: MarketingItem["status"], beforeId?: string) => {
        e.preventDefault();
        e.stopPropagation();
        const id = dragId || e.dataTransfer.getData("text/plain");
        if (!id) return;
        const colItems = items
            .filter((i) => i.status === status && i.id !== id)
            .sort((a, b) => a.sort_order - b.sort_order);
        let sort_order: number;
        if (!beforeId) {
            sort_order = colItems.length ? colItems[colItems.length - 1].sort_order + 1000 : Date.now();
        } else {
            const idx = colItems.findIndex((i) => i.id === beforeId);
            const prev = colItems[idx - 1];
            const next = colItems[idx];
            sort_order = prev && next ? (prev.sort_order + next.sort_order) / 2 : next ? next.sort_order - 1000 : Date.now();
        }
        patchItem(id, { status, sort_order });
        setDragId(null);
    };

    // Calendario: soltar en un día = agendar; en "sin fecha" = desagendar.
    const dropOnDay = (e: React.DragEvent, date: string | null) => {
        e.preventDefault();
        const id = dragId || e.dataTransfer.getData("text/plain");
        if (!id) return;
        patchItem(id, { scheduled_date: date });
        setDragId(null);
    };

    // ---------- derivados ----------
    const byStatus = useMemo(() => {
        const m: Record<string, MarketingItem[]> = { idea: [], produccion: [], listo: [] };
        for (const i of [...items].sort((a, b) => a.sort_order - b.sort_order)) m[i.status]?.push(i);
        return m;
    }, [items]);

    const byDate = useMemo(() => {
        const m: Record<string, MarketingItem[]> = {};
        for (const i of items) {
            if (!i.scheduled_date) continue;
            (m[i.scheduled_date] ||= []).push(i);
        }
        return m;
    }, [items]);

    const unscheduled = useMemo(
        () => [...items.filter((i) => !i.scheduled_date)].sort((a, b) => a.sort_order - b.sort_order),
        [items]
    );

    // Celdas del mes (arranca lunes)
    const cells = useMemo(() => {
        const first = new Date(year, month, 1);
        const startOffset = (first.getDay() + 6) % 7; // 0 = lunes
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const out: (number | null)[] = Array(startOffset).fill(null);
        for (let d = 1; d <= daysInMonth; d++) out.push(d);
        while (out.length % 7 !== 0) out.push(null);
        return out;
    }, [month, year]);

    const prevMonth = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); };
    const nextMonth = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); };

    const todayISO = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

    return (
        <div>
            {/* Tabs */}
            <div className="flex gap-2 mb-5">
                <button
                    onClick={() => setTab("calendario")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "calendario" ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
                >
                    <CalendarDays size={16} /> Calendario
                </button>
                <button
                    onClick={() => setTab("ideas")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "ideas" ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
                >
                    <KanbanSquare size={16} /> Ideas
                </button>
            </div>

            {tab === "calendario" && (
                <div className="space-y-4">
                    {/* Header de mes */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"><ChevronLeft size={18} /></button>
                            <span className="text-base font-semibold text-gray-900 w-44 text-center">{MONTHS[month]} {year}</span>
                            <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"><ChevronRight size={18} /></button>
                        </div>
                        <button
                            onClick={() => createItem({ scheduled_date: todayISO, status: "produccion" })}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                        >
                            <Plus size={15} /> Nuevo post
                        </button>
                    </div>

                    {/* Grilla del mes */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="grid grid-cols-7 border-b border-gray-100">
                            {WEEKDAYS.map((d) => (
                                <div key={d} className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 text-center">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7">
                            {cells.map((day, idx) => {
                                const iso = day ? toISODate(year, month, day) : null;
                                const dayItems = iso ? byDate[iso] || [] : [];
                                return (
                                    <div
                                        key={idx}
                                        onDragOver={allowDrop}
                                        onDrop={iso ? (e) => dropOnDay(e, iso) : undefined}
                                        className={`min-h-[92px] md:min-h-[110px] border-b border-r border-gray-100 p-1.5 flex flex-col gap-1 ${day ? "bg-white" : "bg-gray-50/60"} ${iso === todayISO ? "bg-indigo-50/50" : ""}`}
                                    >
                                        {day && (
                                            <div className="flex items-center justify-between">
                                                <span className={`text-[11px] font-semibold ${iso === todayISO ? "text-indigo-600" : "text-gray-400"}`}>{day}</span>
                                                <button
                                                    onClick={() => createItem({ scheduled_date: iso!, status: "produccion" })}
                                                    className="opacity-0 hover:opacity-100 focus:opacity-100 md:opacity-0 md:[div:hover>&]:opacity-100 p-0.5 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100"
                                                    title="Agregar post este día"
                                                >
                                                    <Plus size={12} />
                                                </button>
                                            </div>
                                        )}
                                        {dayItems.map((item) => (
                                            <div
                                                key={item.id}
                                                draggable
                                                onDragStart={(e) => onDragStart(e, item.id)}
                                                onClick={() => setEditing(item)}
                                                className={`cursor-grab active:cursor-grabbing rounded-md border px-1.5 py-1 text-[11px] font-medium leading-tight truncate ${colorOf(item.color).chip}`}
                                                title={item.title}
                                            >
                                                {item.image_url && (
                                                    <img src={item.image_url} alt="" className="w-full h-10 object-cover rounded mb-1" />
                                                )}
                                                {item.title}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Bandeja sin fecha: arrastrá al calendario (o de vuelta acá para desagendar) */}
                    <div
                        onDragOver={allowDrop}
                        onDrop={(e) => dropOnDay(e, null)}
                        className="bg-white rounded-xl border border-dashed border-gray-300 p-3"
                    >
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                            Sin fecha — arrastrá una idea al calendario para agendarla
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {unscheduled.length === 0 && (
                                <span className="text-sm text-gray-400">No hay ideas sin fecha.</span>
                            )}
                            {unscheduled.map((item) => (
                                <div
                                    key={item.id}
                                    draggable
                                    onDragStart={(e) => onDragStart(e, item.id)}
                                    onClick={() => setEditing(item)}
                                    className={`cursor-grab active:cursor-grabbing rounded-md border px-2 py-1 text-xs font-medium ${colorOf(item.color).chip}`}
                                >
                                    {item.title}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {tab === "ideas" && (
                <div className="flex gap-4 overflow-x-auto pb-4 items-start">
                    {KANBAN_COLUMNS.map((col) => (
                        <div
                            key={col.key}
                            onDragOver={allowDrop}
                            onDrop={(e) => dropOnColumn(e, col.key)}
                            className="w-72 shrink-0 bg-gray-100 rounded-xl p-3"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-semibold text-gray-700">{col.title}</span>
                                <span className="text-xs text-gray-400 font-medium">{byStatus[col.key].length}</span>
                            </div>
                            <div className="space-y-2">
                                {byStatus[col.key].map((item) => (
                                    <div
                                        key={item.id}
                                        draggable
                                        onDragStart={(e) => onDragStart(e, item.id)}
                                        onDragOver={allowDrop}
                                        onDrop={(e) => dropOnColumn(e, col.key, item.id)}
                                        onClick={() => setEditing(item)}
                                        className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                                    >
                                        <div className={`h-1.5 ${colorOf(item.color).strip}`} />
                                        {item.image_url && (
                                            <img src={item.image_url} alt="" className="w-full h-28 object-cover" />
                                        )}
                                        <div className="p-2.5">
                                            <div className="text-sm font-medium text-gray-800 leading-snug">{item.title}</div>
                                            {item.scheduled_date && (
                                                <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                                                    <CalendarDays size={11} />
                                                    {item.scheduled_date.split("-").reverse().slice(0, 2).join("/")}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => createItem({ status: col.key })}
                                className="mt-2 w-full flex items-center gap-1.5 px-2 py-1.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-lg"
                            >
                                <Plus size={15} /> Agregar
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {editing && (
                <EditModal
                    item={editing}
                    onClose={() => setEditing(null)}
                    onPatch={(patch) => {
                        patchItem(editing.id, patch);
                        setEditing({ ...editing, ...patch });
                    }}
                    onDelete={() => deleteItem(editing.id)}
                />
            )}
        </div>
    );
}

function EditModal({ item, onClose, onPatch, onDelete }: {
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
                {/* Imagen / header */}
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
                        </>
                    )}
                    <button
                        onClick={onClose}
                        className={`absolute top-2 right-2 p-1.5 rounded-full ${item.image_url ? "bg-black/50 text-white hover:bg-black/70" : "text-white/0"}`}
                    >
                        <X size={14} />
                    </button>
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

                    {/* Color */}
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

                    {/* Estado + fecha */}
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

                    {/* Acciones */}
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
