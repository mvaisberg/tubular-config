"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { Plus, Minus, ArrowRightLeft, History, Wallet, X } from "lucide-react";

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

const fmt = (n: number, currency: string) =>
    (currency === "USD" ? "US$" : "$") + Math.round(n).toLocaleString("es-AR");

export default function CashBoxManager({ initialBoxes, initialMovements }: { initialBoxes: Box[]; initialMovements: Movement[] }) {
    const supabase = createClient();
    const [boxes] = useState<Box[]>(initialBoxes);
    const [movements, setMovements] = useState<Movement[]>(initialMovements);
    const [modal, setModal] = useState<null | { type: "in" | "out"; box: Box }>(null);
    const [transferOpen, setTransferOpen] = useState(false);
    const [historyBox, setHistoryBox] = useState<string | null>(null);

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
                <button
                    onClick={() => setTransferOpen(true)}
                    className="ml-auto inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
                >
                    <ArrowRightLeft size={15} /> Transferir
                </button>
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
                                    <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{box.currency}</span>
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
                                <div className="border-t border-gray-100 p-3 max-h-64 overflow-y-auto">
                                    {boxMovs.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic">Sin movimientos.</p>
                                    ) : (
                                        <ul className="space-y-1.5">
                                            {boxMovs.slice(0, 50).map(m => (
                                                <li key={m.id} className="flex items-center gap-2 text-xs">
                                                    <span className="text-gray-400 w-24 shrink-0">{format(new Date(m.created_at), "d MMM HH:mm", { locale: es })}</span>
                                                    <span className={`tabular-nums font-medium w-24 text-right ${m.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                                        {m.amount >= 0 ? "+" : ""}{fmt(m.amount, box.currency)}
                                                    </span>
                                                    <span className="text-gray-600 truncate flex-1">
                                                        {m.transfer_id ? "↔ Transferencia" : m.order_id ? "🧾 Pedido" : ""}{m.concept ? ` ${m.concept}` : ""}
                                                    </span>
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
