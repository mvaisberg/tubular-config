"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { MarketingItem, colorOf, useMarketingItems, EditModal } from "./shared";
/* eslint-disable @next/next/no-img-element */

const KANBAN_COLUMNS: { key: MarketingItem["status"]; title: string }[] = [
    { key: "idea", title: "💡 Ideas" },
    { key: "produccion", title: "🎬 En producción" },
    { key: "listo", title: "✅ Listo para subir" },
];

export default function KanbanBoard({ initialItems }: { initialItems: MarketingItem[] }) {
    const { items, editing, setEditing, patchItem, createItem, deleteItem } = useMarketingItems(initialItems);
    const [dragId, setDragId] = useState<string | null>(null);

    const onDragStart = (e: React.DragEvent, id: string) => {
        setDragId(id);
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "move";
    };
    const allowDrop = (e: React.DragEvent) => e.preventDefault();

    // Soltar sobre una card = insertar antes; sobre la columna = al final.
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

    const byStatus = useMemo(() => {
        const m: Record<string, MarketingItem[]> = { idea: [], produccion: [], listo: [] };
        for (const i of [...items].sort((a, b) => a.sort_order - b.sort_order)) m[i.status]?.push(i);
        return m;
    }, [items]);

    return (
        <div>
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

            {editing && (
                <EditModal
                    item={editing}
                    onClose={() => setEditing(null)}
                    onPatch={(patch) => patchItem(editing.id, patch)}
                    onDelete={() => deleteItem(editing.id)}
                />
            )}
        </div>
    );
}
