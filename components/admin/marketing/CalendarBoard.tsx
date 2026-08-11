"use client";

import { useMemo, useState } from "react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { MarketingItem, colorOf, useMarketingItems, EditModal } from "./shared";
/* eslint-disable @next/next/no-img-element */

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const toISODate = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function CalendarBoard({ initialItems }: { initialItems: MarketingItem[] }) {
    const { items, editing, setEditing, patchItem, createItem, deleteItem } = useMarketingItems(initialItems);
    const [dragId, setDragId] = useState<string | null>(null);

    const today = new Date();
    const [month, setMonth] = useState(today.getMonth());
    const [year, setYear] = useState(today.getFullYear());
    const todayISO = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

    const onDragStart = (e: React.DragEvent, id: string) => {
        setDragId(id);
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "move";
    };
    const allowDrop = (e: React.DragEvent) => e.preventDefault();
    const dropOnDay = (e: React.DragEvent, date: string | null) => {
        e.preventDefault();
        const id = dragId || e.dataTransfer.getData("text/plain");
        if (id) patchItem(id, { scheduled_date: date });
        setDragId(null);
    };

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

    return (
        <div className="space-y-4">
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
                                            className="p-0.5 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100"
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
