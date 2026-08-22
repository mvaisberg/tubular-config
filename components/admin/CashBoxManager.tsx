"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { Plus, Minus, ArrowRightLeft, History, Wallet, X, Pencil, Trash2 } from "lucide-react";

interface Box {
    id: string;
    name: string;
    currency: string;
    sort_order: number;
}
interface Movement {
    id: string;
    box_id: string;
    amount: number;
    concept: string | null;
    note: string | null;
    transfer_id: string | null;
    order_id: string | null;
    author_email: string | null;
    created_at: string;
}

const CURRENCIES = ["ARS", "USD"] as const;

const fmt = (n: number, currency: string) => {
    const prefix = currency === "USD" ? "US$" : "$";
    const digits = currency === "ARS" ? 0 : 2;
    return prefix + Number(n).toLocaleString("es-AR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export default function CashBoxManager({ initialBoxes, initialMovements }: { initialBoxes: Box[]; initialMovements: Movement[] }) {
    const supabase = createClient();
    const [boxes, setBoxes] = useState<Box[]>(initialBoxes);
    const [movements, setMovements] = useState<Movement[]>(initialMovements);
    const [modal, setModal] = useState<null | { type: "in" | "out"; box: Box }>(null);
    const [transferOpen, setTransferOpen] = useState(false);
    const [historyBox, setHistoryBox] = useState<string | null>(null);
    const [boxEditor, setBoxEditor] = useState<null | { mode: "create" } | { mode: "edit"; box: Box }>(null);
    const [movEditor, setMovEditor] = useState<Movement | null>(null);
    // Listado global: filtro por caja y cantidad visible.
    const [globalFilter, setGlobalFilter] = useState<string>("all");
    const [globalLimit, setGlobalLimit] = useState(50);

    const boxById = useMemo(() => Object.fromEntries(boxes.map(b => [b.id, b])), [boxes]);

    // Saldo por caja = suma de sus movimientos.
    const balances = useMemo(() => {
        const b: Record<string, number> = {};
        boxes.forEach(box => { b[box.id] = 0; });
        movements.forEach(m => { b[m.box_id] = (b[m.box_id] || 0) + Number(m.amount); });
        return b;
    }, [boxes, movements]);

    // Totales por moneda.
    const totals = useMemo(() => {
        const t: Record<string, number> = {};
        boxes.forEach(box => { t[box.currency] = (t[box.currency] || 0) + (balances[box.id] || 0); });
        return t;
    }, [boxes, balances]);

    const addMovement = async (rows: Partial<Movement>[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        const payload = rows.map(r => ({ ...r, author_email: user?.email || null }));
        const { data, error } = await supabase.from("cash_movements").insert(payload).select();
        if (error) { alert("Error: " + error.message); return false; }
        if (data) setMovements(prev => [...data as Movement[], ...prev]);
        return true;
    };

    const updateMovement = async (id: string, updates: Partial<Movement>) => {
        const { error } = await supabase.from("cash_movements").update(updates).eq("id", id);
        if (error) { alert("Error: " + error.message); return false; }
        setMovements(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
        return true;
    };

    const deleteMovement = async (id: string) => {
        const { error } = await supabase.from("cash_movements").delete().eq("id", id);
        if (error) { alert("Error: " + error.message); return false; }
        setMovements(prev => prev.filter(m => m.id !== id));
        return true;
    };

    return (
        <div className="space-y-6">
            {/* Totales por moneda + transferir */}
            <div className="flex flex-wrap items-center gap-3">
                {Object.entries(totals).map(([cur, val]) => (
                    <div key={cur} className="bg-gray-900 text-white rounded-lg px-4 py-3">
                        <div className="text-[10px] uppercase tracking-wide text-white/50">Total {cur}</div>
                        <div className="text-xl font-semibold tabular-nums">{fmt(val, cur)}</div>
                    </div>
                ))}
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={() => setBoxEditor({ mode: "create" })}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                    >
                        <Plus size={15} /> Nueva caja
                    </button>
                    <button
                        onClick={() => setTransferOpen(true)}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
                    >
                        <ArrowRightLeft size={15} /> Transferir
                    </button>
                </div>
            </div>

            {/* Cajas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {boxes.map(box => {
                    const bal = balances[box.id] || 0;
                    const open = historyBox === box.id;
                    const boxMovs = movements.filter(m => m.box_id === box.id);
                    return (
                        <div key={box.id} className="bg-white border border-gray-200 rounded-lg flex flex-col">
                            <div className="p-4 border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-gray-700">
                                        <Wallet size={15} className="text-gray-400" />
                                        <span className="font-semibold text-sm">{box.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{box.currency}</span>
                                        <button onClick={() => setBoxEditor({ mode: "edit", box })} className="p-1 text-gray-400 hover:text-gray-700" title="Editar caja">
                                            <Pencil size={13} />
                                        </button>
                                    </div>
                                </div>
                                <div className={`text-2xl font-semibold tabular-nums mt-2 ${bal < 0 ? "text-rose-600" : "text-gray-900"}`}>
                                    {fmt(bal, box.currency)}
                                </div>
                            </div>
                            <div className="p-3 flex items-center gap-2">
                                <button onClick={() => setModal({ type: "in", box })} className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors">
                                    <Plus size={13} /> Ingreso
                                </button>
                                <button onClick={() => setModal({ type: "out", box })} className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors">
                                    <Minus size={13} /> Egreso
                                </button>
                                <button onClick={() => setHistoryBox(open ? null : box.id)} className={`p-2 rounded-md transition-colors ${open ? "text-indigo-600 bg-indigo-50" : "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"}`} title="Historial">
                                    <History size={14} />
                                </button>
                            </div>
                            {open && (
                                <div className="border-t border-gray-100 max-h-80 overflow-y-auto">
                                    {boxMovs.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic p-3">Sin movimientos.</p>
                                    ) : (
                                        <ul className="divide-y divide-gray-50">
                                            {boxMovs.map(m => (
                                                <li key={m.id} className="group flex items-start gap-2 text-xs px-3 py-1.5 hover:bg-gray-50">
                                                    <span className="text-gray-400 w-20 shrink-0 pt-0.5">{format(new Date(m.created_at), "d MMM HH:mm", { locale: es })}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-gray-700 truncate">
                                                            {m.transfer_id ? "↔ " : m.order_id ? "🧾 " : ""}{m.concept || (m.order_id ? "Pedido" : m.transfer_id ? "Transferencia" : "—")}
                                                        </div>
                                                        {m.note && <div className="text-[10px] text-gray-400 truncate">{m.note}</div>}
                                                    </div>
                                                    <span className={`tabular-nums font-medium shrink-0 pt-0.5 ${m.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                                        {m.amount >= 0 ? "+" : ""}{fmt(m.amount, box.currency)}
                                                    </span>
                                                    <button
                                                        onClick={() => setMovEditor(m)}
                                                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 shrink-0 pt-0.5"
                                                        title="Editar movimiento"
                                                    >
                                                        <Pencil size={12} />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Todos los movimientos (todas las cajas) */}
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-100">
                    <History size={15} className="text-gray-400" />
                    <h2 className="text-sm font-semibold text-gray-900">Todos los movimientos</h2>
                    <select
                        value={globalFilter}
                        onChange={e => { setGlobalFilter(e.target.value); setGlobalLimit(50); }}
                        className="ml-auto border border-gray-200 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="all">Todas las cajas</option>
                        {boxes.map(b => <option key={b.id} value={b.id}>{b.name} ({b.currency})</option>)}
                    </select>
                </div>
                {(() => {
                    const list = movements
                        .filter(m => globalFilter === "all" || m.box_id === globalFilter)
                        .slice()
                        .sort((a, b) => b.created_at.localeCompare(a.created_at));
                    const visible = list.slice(0, globalLimit);
                    return (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-left text-gray-500 border-b border-gray-100">
                                            <th className="px-4 py-2 font-medium">Fecha</th>
                                            <th className="px-4 py-2 font-medium">Caja</th>
                                            <th className="px-4 py-2 font-medium">Concepto</th>
                                            <th className="px-4 py-2 font-medium">Cargó</th>
                                            <th className="px-4 py-2 font-medium text-right">Monto</th>
                                            <th className="px-2 py-2" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {visible.map(m => {
                                            const box = boxById[m.box_id];
                                            return (
                                                <tr key={m.id} className="group hover:bg-gray-50">
                                                    <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{format(new Date(m.created_at), "d MMM yy HH:mm", { locale: es })}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap">
                                                        <span className={`inline-flex items-center gap-1 font-medium ${m.amount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                                            {m.amount >= 0 ? "→" : "←"} {box?.name || "?"}
                                                        </span>
                                                        <span className="text-gray-400 ml-1">({box?.currency})</span>
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-700 max-w-[280px]">
                                                        <div className="truncate">{m.transfer_id ? "↔ " : m.order_id ? "🧾 " : ""}{m.concept || (m.order_id ? "Pedido" : m.transfer_id ? "Transferencia" : "—")}</div>
                                                        {m.note && <div className="text-[10px] text-gray-400 truncate">{m.note}</div>}
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-400 whitespace-nowrap max-w-[140px] truncate">{m.author_email?.split("@")[0] || "—"}</td>
                                                    <td className={`px-4 py-2 text-right tabular-nums font-semibold whitespace-nowrap ${m.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                                        {m.amount >= 0 ? "+" : ""}{fmt(m.amount, box?.currency || "ARS")}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <button
                                                            onClick={() => setMovEditor(m)}
                                                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600"
                                                            title="Editar movimiento"
                                                        >
                                                            <Pencil size={13} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {visible.length === 0 && (
                                            <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 italic">Sin movimientos.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {list.length > globalLimit && (
                                <div className="p-3 border-t border-gray-100 text-center">
                                    <button
                                        onClick={() => setGlobalLimit(l => l + 100)}
                                        className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"
                                    >
                                        Ver más ({list.length - globalLimit} restantes)
                                    </button>
                                </div>
                            )}
                        </>
                    );
                })()}
            </div>

            {movEditor && (
                <MovementEditModal
                    movement={movEditor}
                    box={boxById[movEditor.box_id]}
                    onClose={() => setMovEditor(null)}
                    onSave={async (updates) => {
                        const ok = await updateMovement(movEditor.id, updates);
                        if (ok) setMovEditor(null);
                    }}
                    onDelete={async () => {
                        if (!confirm(movEditor.transfer_id
                            ? "Este movimiento es parte de una transferencia entre cajas: se borra solo esta pata (la otra caja no se toca). ¿Borrar?"
                            : "¿Borrar este movimiento? El saldo de la caja se recalcula.")) return;
                        const ok = await deleteMovement(movEditor.id);
                        if (ok) setMovEditor(null);
                    }}
                />
            )}

            {modal && (
                <MoveModal
                    box={modal.box}
                    type={modal.type}
                    onClose={() => setModal(null)}
                    onSave={async (amount, concept, note) => {
                        const signed = modal.type === "in" ? amount : -amount;
                        const ok = await addMovement([{ box_id: modal.box.id, amount: signed, concept: concept || null, note: note || null }]);
                        if (ok) setModal(null);
                    }}
                />
            )}

            {boxEditor && (
                <BoxEditorModal
                    initial={boxEditor.mode === "edit" ? boxEditor.box : null}
                    onClose={() => setBoxEditor(null)}
                    onSave={async (name, currency) => {
                        if (boxEditor.mode === "create") {
                            const nextOrder = boxes.reduce((m, b) => Math.max(m, b.sort_order || 0), 0) + 1;
                            const { data, error } = await supabase.from("cash_boxes").insert({
                                name, currency, sort_order: nextOrder,
                            }).select().single();
                            if (error) { alert("Error: " + error.message); return false; }
                            if (data) setBoxes(prev => [...prev, data as Box]);
                            return true;
                        }
                        const { error } = await supabase.from("cash_boxes").update({ name, currency }).eq("id", boxEditor.box.id);
                        if (error) { alert("Error: " + error.message); return false; }
                        setBoxes(prev => prev.map(b => b.id === boxEditor.box.id ? { ...b, name, currency } : b));
                        return true;
                    }}
                    onDelete={boxEditor.mode === "edit" ? async () => {
                        const id = boxEditor.box.id;
                        if (movements.some(m => m.box_id === id)) {
                            if (!confirm("Esta caja tiene movimientos. ¿Borrarla igual? Se eliminan los movimientos de esta caja.")) return false;
                        }
                        const { error } = await supabase.from("cash_boxes").delete().eq("id", id);
                        if (error) { alert("Error: " + error.message); return false; }
                        setBoxes(prev => prev.filter(b => b.id !== id));
                        setMovements(prev => prev.filter(m => m.box_id !== id));
                        return true;
                    } : undefined}
                />
            )}

            {transferOpen && (
                <TransferModal
                    boxes={boxes}
                    onClose={() => setTransferOpen(false)}
                    onSave={async (fromId, toId, amountFrom, amountTo, concept) => {
                        const transferId = crypto.randomUUID();
                        const from = boxes.find(b => b.id === fromId)!;
                        const to = boxes.find(b => b.id === toId)!;
                        const ok = await addMovement([
                            { box_id: fromId, amount: -amountFrom, concept: concept || `Transferencia a ${to.name}`, transfer_id: transferId },
                            { box_id: toId, amount: amountTo, concept: concept || `Transferencia desde ${from.name}`, transfer_id: transferId },
                        ]);
                        if (ok) setTransferOpen(false);
                    }}
                />
            )}
        </div>
    );
}

function MoveModal({ box, type, onClose, onSave }: { box: Box; type: "in" | "out"; onClose: () => void; onSave: (amount: number, concept: string, note: string) => void }) {
    const [amount, setAmount] = useState("");
    const [concept, setConcept] = useState("");
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);
    const isIn = type === "in";
    return (
        <Overlay onClose={onClose}>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{isIn ? "Ingreso" : "Egreso"} · {box.name}</h3>
            <p className="text-xs text-gray-500 mb-4">Moneda: {box.currency}</p>
            <label className="text-xs font-medium text-gray-700 block mb-1">Monto ({box.currency})</label>
            <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} autoFocus
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0" />
            <label className="text-xs font-medium text-gray-700 block mb-1">Concepto</label>
            <input type="text" value={concept} onChange={e => setConcept(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ej: pago proveedor, cobro…" />
            <label className="text-xs font-medium text-gray-700 block mb-1">Nota (opcional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Cancelar</button>
                <button
                    disabled={saving}
                    onClick={async () => { const n = parseFloat(amount); if (!n || n <= 0) return alert("Monto inválido"); setSaving(true); await onSave(n, concept.trim(), note.trim()); setSaving(false); }}
                    className={`px-4 py-1.5 text-sm font-medium text-white rounded-md disabled:opacity-50 ${isIn ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}`}
                >{saving ? "…" : "Confirmar"}</button>
            </div>
        </Overlay>
    );
}

function MovementEditModal({ movement, box, onClose, onSave, onDelete }: {
    movement: Movement;
    box?: Box;
    onClose: () => void;
    onSave: (updates: Partial<Movement>) => Promise<void>;
    onDelete: () => Promise<void>;
}) {
    const isIn = movement.amount >= 0;
    const [type, setType] = useState<"in" | "out">(isIn ? "in" : "out");
    const [amount, setAmount] = useState(String(Math.abs(movement.amount)));
    const [concept, setConcept] = useState(movement.concept || "");
    const [note, setNote] = useState(movement.note || "");
    const [saving, setSaving] = useState(false);
    return (
        <Overlay onClose={onClose}>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Editar movimiento · {box?.name || "?"}</h3>
            <p className="text-xs text-gray-500 mb-4">
                {format(new Date(movement.created_at), "d MMM yyyy HH:mm", { locale: es })}
                {movement.author_email ? ` · cargado por ${movement.author_email}` : ""}
            </p>
            {movement.transfer_id && (
                <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 mb-3">
                    Es una pata de transferencia entre cajas: editás solo el movimiento de esta caja.
                </p>
            )}
            <div className="flex gap-2 mb-3">
                <button type="button" onClick={() => setType("in")} className={`flex-1 py-1.5 rounded-md text-xs font-medium border ${type === "in" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200"}`}>Ingreso</button>
                <button type="button" onClick={() => setType("out")} className={`flex-1 py-1.5 rounded-md text-xs font-medium border ${type === "out" ? "bg-rose-600 text-white border-rose-600" : "bg-white text-gray-600 border-gray-200"}`}>Egreso</button>
            </div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Monto ({box?.currency || "ARS"})</label>
            <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <label className="text-xs font-medium text-gray-700 block mb-1">Concepto</label>
            <input type="text" value={concept} onChange={e => setConcept(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <label className="text-xs font-medium text-gray-700 block mb-1">Nota</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={async () => { setSaving(true); await onDelete(); setSaving(false); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 rounded-md"
                >
                    <Trash2 size={14} /> Borrar
                </button>
                <div className="flex gap-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Cancelar</button>
                    <button
                        disabled={saving}
                        onClick={async () => {
                            const n = parseFloat(amount);
                            if (!n || n <= 0) return alert("Monto inválido");
                            setSaving(true);
                            await onSave({ amount: type === "in" ? n : -n, concept: concept.trim() || null, note: note.trim() || null });
                            setSaving(false);
                        }}
                        className="px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
                    >{saving ? "…" : "Guardar"}</button>
                </div>
            </div>
        </Overlay>
    );
}

function TransferModal({ boxes, onClose, onSave }: { boxes: Box[]; onClose: () => void; onSave: (fromId: string, toId: string, amountFrom: number, amountTo: number, concept: string) => void }) {
    const [fromId, setFromId] = useState(boxes[0]?.id || "");
    const [toId, setToId] = useState(boxes[1]?.id || "");
    const [amountFrom, setAmountFrom] = useState("");
    const [amountTo, setAmountTo] = useState("");
    const [concept, setConcept] = useState("");
    const [saving, setSaving] = useState(false);
    const from = boxes.find(b => b.id === fromId);
    const to = boxes.find(b => b.id === toId);
    const diffCurrency = from && to && from.currency !== to.currency;

    return (
        <Overlay onClose={onClose}>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Transferencia entre cajas</h3>
            <label className="text-xs font-medium text-gray-700 block mb-1">Desde</label>
            <select value={fromId} onChange={e => setFromId(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mb-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {boxes.map(b => <option key={b.id} value={b.id}>{b.name} ({b.currency})</option>)}
            </select>
            <label className="text-xs font-medium text-gray-700 block mb-1">Hacia</label>
            <select value={toId} onChange={e => setToId(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mb-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {boxes.filter(b => b.id !== fromId).map(b => <option key={b.id} value={b.id}>{b.name} ({b.currency})</option>)}
            </select>
            <div className="flex gap-3">
                <div className="flex-1">
                    <label className="text-xs font-medium text-gray-700 block mb-1">Sale de {from?.name} ({from?.currency})</label>
                    <input type="number" min="0" value={amountFrom} onChange={e => { setAmountFrom(e.target.value); if (!diffCurrency) setAmountTo(e.target.value); }} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0" />
                </div>
                {diffCurrency && (
                    <div className="flex-1">
                        <label className="text-xs font-medium text-gray-700 block mb-1">Entra a {to?.name} ({to?.currency})</label>
                        <input type="number" min="0" value={amountTo} onChange={e => setAmountTo(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0" />
                    </div>
                )}
            </div>
            {diffCurrency && <p className="text-[11px] text-amber-600 mt-2">Monedas distintas: ingresá el monto en cada caja (aplicás el cambio que corresponda).</p>}
            <label className="text-xs font-medium text-gray-700 block mb-1 mt-3">Concepto (opcional)</label>
            <input type="text" value={concept} onChange={e => setConcept(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Cancelar</button>
                <button
                    disabled={saving}
                    onClick={async () => {
                        const af = parseFloat(amountFrom); const at = diffCurrency ? parseFloat(amountTo) : af;
                        if (!af || af <= 0 || !at || at <= 0) return alert("Montos inválidos");
                        if (fromId === toId) return alert("Elegí cajas distintas");
                        setSaving(true); await onSave(fromId, toId, af, at, concept.trim()); setSaving(false);
                    }}
                    className="px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >{saving ? "…" : "Transferir"}</button>
            </div>
        </Overlay>
    );
}

function BoxEditorModal({
    initial,
    onClose,
    onSave,
    onDelete,
}: {
    initial: Box | null;
    onClose: () => void;
    onSave: (name: string, currency: string) => Promise<boolean>;
    onDelete?: () => Promise<boolean>;
}) {
    const [name, setName] = useState(initial?.name || "");
    const [currency, setCurrency] = useState(initial?.currency || "ARS");
    const [saving, setSaving] = useState(false);
    const isEdit = !!initial;
    return (
        <Overlay onClose={onClose}>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{isEdit ? "Editar caja" : "Nueva caja"}</h3>
            <label className="text-xs font-medium text-gray-700 block mb-1">Nombre</label>
            <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ej: Efectivo dólares, Brubank…"
            />
            <label className="text-xs font-medium text-gray-700 block mb-1">Moneda</label>
            <div className="flex gap-2 mb-4">
                {CURRENCIES.map(c => (
                    <button
                        key={c}
                        type="button"
                        onClick={() => setCurrency(c)}
                        className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                            currency === c
                                ? "bg-gray-900 text-white border-gray-900"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                        }`}
                    >
                        {c === "USD" ? "USD (dólares)" : "ARS (pesos)"}
                    </button>
                ))}
            </div>
            <p className="text-[11px] text-gray-500 mb-4">
                Los ingresos desde pedidos se registran en esta moneda. Si la caja es USD, se convierte el total del pedido con el tipo de cambio de Ajustes.
            </p>
            <div className="flex items-center justify-between gap-2">
                {onDelete ? (
                    <button
                        type="button"
                        onClick={async () => { setSaving(true); const ok = await onDelete(); setSaving(false); if (ok) onClose(); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 rounded-md"
                    >
                        <Trash2 size={14} /> Borrar
                    </button>
                ) : <span />}
                <div className="flex gap-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Cancelar</button>
                    <button
                        disabled={saving}
                        onClick={async () => {
                            if (!name.trim()) return alert("Poné un nombre");
                            setSaving(true);
                            const ok = await onSave(name.trim(), currency);
                            setSaving(false);
                            if (ok) onClose();
                        }}
                        className="px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
                    >{saving ? "…" : isEdit ? "Guardar" : "Crear caja"}</button>
                </div>
            </div>
        </Overlay>
    );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"><X size={18} /></button>
                {children}
            </div>
        </div>
    );
}
