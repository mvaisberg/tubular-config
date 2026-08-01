"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, X } from "lucide-react";

interface Order {
    id: string;
    order_number: number | null;
    created_at: string;
    invoiced_at: string | null;
    client_name: string;
    final_amount: number;
}
interface Purchase {
    id: string;
    supplier: string;
    invoice_number: string | null;
    invoice_date: string;
    total: number;
    iva_amount: number;
    concept: string | null;
    author_email: string | null;
}

type PresetKey = "this_month" | "last_month" | "this_year" | "all" | "custom";
type Tab = "ventas" | "compras";

const IVA_RATE = 0.21;
const IIBB_RATE = 0.035;
const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const iso = (d: Date) => d.toISOString().slice(0, 10);

function presetRange(key: PresetKey): { from: string; to: string } {
    const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
    switch (key) {
        case "this_month": return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
        case "last_month": return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
        case "this_year": return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
        default: return { from: "", to: "" };
    }
}
// Venta: total incluye IVA; IIBB sobre neto.
function saleBreakdown(total: number) {
    const neto = total / (1 + IVA_RATE);
    return { total, neto, iva: total - neto, iibb: neto * IIBB_RATE };
}

export default function ContabilidadView({ orders, purchases: initialPurchases }: { orders: Order[]; purchases: Purchase[] }) {
    const supabase = createClient();
    const [preset, setPreset] = useState<PresetKey>("this_month");
    const initial = presetRange("this_month");
    const [from, setFrom] = useState(initial.from);
    const [to, setTo] = useState(initial.to);
    const [tab, setTab] = useState<Tab>("ventas");
    const [purchases, setPurchases] = useState<Purchase[]>(initialPurchases);
    const [modalOpen, setModalOpen] = useState(false);

    const applyPreset = (key: PresetKey) => {
        setPreset(key);
        if (key === "all") { setFrom(""); setTo(""); }
        else if (key !== "custom") { const r = presetRange(key); setFrom(r.from); setTo(r.to); }
    };

    const inRange = (dateStr: string) => {
        const d = dateStr.slice(0, 10);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
    };

    const salesF = useMemo(() => orders.filter(o => inRange(o.invoiced_at || o.created_at)), [orders, from, to]);
    const purchF = useMemo(() => purchases.filter(p => inRange(p.invoice_date)), [purchases, from, to]);

    const sums = useMemo(() => {
        let sTotal = 0, sNeto = 0, sIva = 0, sIibb = 0;
        salesF.forEach(o => { const b = saleBreakdown(Number(o.final_amount) || 0); sTotal += b.total; sNeto += b.neto; sIva += b.iva; sIibb += b.iibb; });
        let pTotal = 0, pIva = 0;
        purchF.forEach(p => { pTotal += Number(p.total) || 0; pIva += Number(p.iva_amount) || 0; });
        const pNeto = pTotal - pIva;
        return { sTotal, sNeto, sIva, sIibb, pTotal, pNeto, pIva, ivaSaldo: sIva - pIva };
    }, [salesF, purchF]);

    const deletePurchase = async (id: string) => {
        if (!confirm("¿Eliminar esta factura de compra?")) return;
        setPurchases(prev => prev.filter(p => p.id !== id));
        await supabase.from("purchase_invoices").delete().eq("id", id);
    };

    const addPurchase = async (p: Omit<Purchase, "id" | "author_email">) => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.from("purchase_invoices")
            .insert({ ...p, author_email: user?.email || null }).select().single();
        if (error) { alert("Error: " + error.message); return; }
        if (data) setPurchases(prev => [data as Purchase, ...prev]);
        setModalOpen(false);
    };

    const presets: [PresetKey, string][] = [["this_month", "Este mes"], ["last_month", "Mes pasado"], ["this_year", "Este año"], ["all", "Todo"]];

    return (
        <div className="space-y-6">
            {/* Filtro de período */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                    {presets.map(([k, label]) => (
                        <button key={k} onClick={() => applyPreset(k)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${preset === k ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"}`}>{label}</button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-xs text-gray-500">Desde</span>
                    <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPreset("custom"); }} className="border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <span className="text-xs text-gray-500">hasta</span>
                    <input type="date" value={to} onChange={e => { setTo(e.target.value); setPreset("custom"); }} className="border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
            </div>

            {/* Resumen fiscal */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="IVA Débito (ventas)" value={fmt(sums.sIva)} hint={`${salesF.length} facturas`} accent="amber" />
                <Kpi label="IVA Crédito (compras)" value={fmt(sums.pIva)} hint={`${purchF.length} compras`} accent="emerald" />
                <Kpi label="Saldo IVA" value={fmt(sums.ivaSaldo)} hint={sums.ivaSaldo >= 0 ? "A pagar" : "A favor"} accent={sums.ivaSaldo >= 0 ? "rose" : "emerald"} />
                <Kpi label="IIBB 3,5%" value={fmt(sums.sIibb)} hint="Sobre neto ventas" accent="gray" />
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-200">
                {(["ventas", "compras"] as Tab[]).map(t => (
                    <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                        {t === "ventas" ? `Ventas (${salesF.length})` : `Compras (${purchF.length})`}
                    </button>
                ))}
                {tab === "compras" && (
                    <button onClick={() => setModalOpen(true)} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 mb-1 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                        <Plus size={14} /> Cargar factura de compra
                    </button>
                )}
            </div>

            {tab === "ventas" ? (
                <TableWrap>
                    <thead className="bg-gray-50"><tr className="text-left text-xs font-medium text-gray-500">
                        <th className="px-4 py-2.5">Pedido</th><th className="px-4 py-2.5">Fecha</th><th className="px-4 py-2.5">Cliente</th>
                        <th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5 text-right">Neto</th><th className="px-4 py-2.5 text-right">IVA 21%</th><th className="px-4 py-2.5 text-right">IIBB 3,5%</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                        {salesF.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 italic">Sin ventas facturadas en el período.</td></tr>
                            : salesF.map(o => { const b = saleBreakdown(Number(o.final_amount) || 0); return (
                                <tr key={o.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2.5 font-medium text-gray-700 tabular-nums">TUB-{String(o.order_number || 0).padStart(4, "0")}</td>
                                    <td className="px-4 py-2.5 text-gray-500">{format(new Date(o.invoiced_at || o.created_at), "d MMM yyyy", { locale: es })}</td>
                                    <td className="px-4 py-2.5 text-gray-700 truncate max-w-[160px]">{o.client_name}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">{fmt(b.total)}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{fmt(b.neto)}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-amber-700">{fmt(b.iva)}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-rose-700">{fmt(b.iibb)}</td>
                                </tr>
                            ); })}
                    </tbody>
                    {salesF.length > 0 && <tfoot className="bg-gray-50 border-t-2 border-gray-200"><tr className="font-semibold text-gray-900">
                        <td className="px-4 py-3" colSpan={3}>Totales</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(sums.sTotal)}</td><td className="px-4 py-3 text-right tabular-nums">{fmt(sums.sNeto)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-700">{fmt(sums.sIva)}</td><td className="px-4 py-3 text-right tabular-nums text-rose-700">{fmt(sums.sIibb)}</td>
                    </tr></tfoot>}
                </TableWrap>
            ) : (
                <TableWrap>
                    <thead className="bg-gray-50"><tr className="text-left text-xs font-medium text-gray-500">
                        <th className="px-4 py-2.5">Proveedor</th><th className="px-4 py-2.5">Nº</th><th className="px-4 py-2.5">Fecha</th>
                        <th className="px-4 py-2.5 text-right">Neto</th><th className="px-4 py-2.5 text-right">IVA</th><th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5 w-8"></th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                        {purchF.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 italic">Sin compras cargadas en el período.</td></tr>
                            : purchF.map(p => { const neto = (Number(p.total) || 0) - (Number(p.iva_amount) || 0); return (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2.5 text-gray-800">{p.supplier}{p.concept && <span className="block text-[11px] text-gray-400">{p.concept}</span>}</td>
                                    <td className="px-4 py-2.5 text-gray-500 text-xs">{p.invoice_number || "—"}</td>
                                    <td className="px-4 py-2.5 text-gray-500">{format(new Date(p.invoice_date + "T00:00:00"), "d MMM yyyy", { locale: es })}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{fmt(neto)}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{fmt(Number(p.iva_amount) || 0)}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">{fmt(Number(p.total) || 0)}</td>
                                    <td className="px-4 py-2.5"><button onClick={() => deletePurchase(p.id)} className="p-1 text-gray-300 hover:text-rose-600"><Trash2 size={13} /></button></td>
                                </tr>
                            ); })}
                    </tbody>
                    {purchF.length > 0 && <tfoot className="bg-gray-50 border-t-2 border-gray-200"><tr className="font-semibold text-gray-900">
                        <td className="px-4 py-3" colSpan={3}>Totales</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(sums.pNeto)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{fmt(sums.pIva)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(sums.pTotal)}</td><td></td>
                    </tr></tfoot>}
                </TableWrap>
            )}

            {modalOpen && <PurchaseModal onClose={() => setModalOpen(false)} onSave={addPurchase} />}
        </div>
    );
}

function TableWrap({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-100 text-sm">{children}</table></div>
        </div>
    );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint: string; accent: "indigo" | "amber" | "rose" | "gray" | "emerald" }) {
    const ring: Record<string, string> = { indigo: "border-l-indigo-500", amber: "border-l-amber-500", rose: "border-l-rose-500", gray: "border-l-gray-400", emerald: "border-l-emerald-500" };
    return (
        <div className={`bg-white border border-gray-200 border-l-4 ${ring[accent]} rounded-lg p-4`}>
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-xl font-semibold text-gray-900 tabular-nums mt-1">{value}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>
        </div>
    );
}

function PurchaseModal({ onClose, onSave }: { onClose: () => void; onSave: (p: Omit<Purchase, "id" | "author_email">) => void }) {
    const [supplier, setSupplier] = useState("");
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(iso(new Date()));
    const [total, setTotal] = useState("");
    const [iva, setIva] = useState("");
    const [concept, setConcept] = useState("");
    const [saving, setSaving] = useState(false);

    // Al escribir el total, sugerir el IVA al 21% (editable).
    const onTotalChange = (v: string) => {
        setTotal(v);
        const t = parseFloat(v) || 0;
        if (t > 0) setIva(String(Math.round((t - t / 1.21) * 100) / 100));
    };
    const netoPreview = (parseFloat(total) || 0) - (parseFloat(iva) || 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"><X size={18} /></button>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Cargar factura de compra</h3>
                <label className="text-xs font-medium text-gray-700 block mb-1">Proveedor *</label>
                <input value={supplier} onChange={e => setSupplier(e.target.value)} autoFocus className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ej: Aceros SA" />
                <div className="flex gap-3 mb-3">
                    <div className="flex-1">
                        <label className="text-xs font-medium text-gray-700 block mb-1">Nº factura</label>
                        <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="A-0001-00001234" />
                    </div>
                    <div className="w-40">
                        <label className="text-xs font-medium text-gray-700 block mb-1">Fecha *</label>
                        <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                </div>
                <div className="flex gap-3 mb-1">
                    <div className="flex-1">
                        <label className="text-xs font-medium text-gray-700 block mb-1">Total (c/IVA) *</label>
                        <input type="number" value={total} onChange={e => onTotalChange(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0" />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-medium text-gray-700 block mb-1">IVA (crédito) *</label>
                        <input type="number" value={iva} onChange={e => setIva(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0" />
                    </div>
                </div>
                <p className="text-[11px] text-gray-400 mb-3">Neto: {fmt(netoPreview)} · El IVA se sugiere al 21% pero podés ajustarlo (ej. 10,5%).</p>
                <label className="text-xs font-medium text-gray-700 block mb-1">Concepto (opcional)</label>
                <input value={concept} onChange={e => setConcept(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ej: chapa, insumos…" />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Cancelar</button>
                    <button disabled={saving} onClick={async () => {
                        if (!supplier.trim()) return alert("Proveedor obligatorio");
                        const t = parseFloat(total) || 0; if (t <= 0) return alert("Total inválido");
                        setSaving(true);
                        await onSave({ supplier: supplier.trim(), invoice_number: invoiceNumber.trim() || null, invoice_date: invoiceDate, total: t, iva_amount: parseFloat(iva) || 0, concept: concept.trim() || null });
                        setSaving(false);
                    }} className="px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">{saving ? "…" : "Guardar"}</button>
                </div>
            </div>
        </div>
    );
}
