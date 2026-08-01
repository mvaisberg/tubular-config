"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Minus, Search, AlertTriangle, ChevronDown, ChevronUp, History } from "lucide-react";

interface StockItem {
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
    unit: string;
    current_quantity: number;
    min_quantity: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

interface StockMovement {
    id: string;
    stock_item_id: string;
    quantity: number;
    reason: string;
    order_id: string | null;
    author_email: string | null;
    note: string | null;
    created_at: string;
}

const REASON_LABEL: Record<string, string> = {
    entrada: "Entrada",
    consumo_pedido: "Consumo pedido",
    ajuste: "Ajuste",
    devolucion: "Devolución",
    manual: "Manual",
};

export function StockManager({ initialItems }: { initialItems: StockItem[] }) {
    const router = useRouter();
    const supabase = createClient();
    const [items, setItems] = useState<StockItem[]>(initialItems);
    const [query, setQuery] = useState("");
    const [creating, setCreating] = useState(false);
    const [openHistoryFor, setOpenHistoryFor] = useState<string | null>(null);
    const [movements, setMovements] = useState<Record<string, StockMovement[]>>({});

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter(i =>
            [i.name, i.sku, i.category].filter(Boolean).join(" ").toLowerCase().includes(q)
        );
    }, [items, query]);

    const lowStockCount = useMemo(() =>
        items.filter(i => i.min_quantity > 0 && i.current_quantity <= i.min_quantity).length,
    [items]);

    const refresh = async () => {
        const { data } = await supabase
            .from("stock_items")
            .select("*")
            .order("category", { ascending: true })
            .order("name", { ascending: true });
        if (data) setItems(data);
    };

    const loadHistory = async (itemId: string) => {
        if (movements[itemId]) {
            setOpenHistoryFor(openHistoryFor === itemId ? null : itemId);
            return;
        }
        const { data } = await supabase
            .from("stock_movements")
            .select("*")
            .eq("stock_item_id", itemId)
            .order("created_at", { ascending: false })
            .limit(50);
        if (data) {
            setMovements(prev => ({ ...prev, [itemId]: data }));
            setOpenHistoryFor(itemId);
        }
    };

    const deleteItem = async (id: string) => {
        if (!confirm("¿Eliminar este item? Borra también su historial de movimientos.")) return;
        const { error } = await supabase.from("stock_items").delete().eq("id", id);
        if (error) return alert("Error: " + error.message);
        setItems(items.filter(i => i.id !== id));
    };

    return (
        <div className="space-y-5">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <div className="relative flex-1 max-w-md">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar por nombre, SKU o categoría…"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    {lowStockCount > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium rounded-md">
                            <AlertTriangle size={13} /> {lowStockCount} con stock bajo
                        </span>
                    )}
                    <button
                        onClick={() => setCreating(true)}
                        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
                    >
                        <Plus size={15} />
                        Nuevo item
                    </button>
                </div>
            </div>

            {creating && (
                <NewItemForm
                    onCancel={() => setCreating(false)}
                    onCreated={async () => {
                        setCreating(false);
                        await refresh();
                        router.refresh();
                    }}
                />
            )}

            {/* Items table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50">
                        <tr className="text-left text-xs font-medium text-gray-500">
                            <th className="px-4 py-3 w-2">{/* expand */}</th>
                            <th className="px-4 py-3">Item</th>
                            <th className="px-4 py-3">SKU</th>
                            <th className="px-4 py-3">Categoría</th>
                            <th className="px-4 py-3 text-right">Stock</th>
                            <th className="px-4 py-3 text-right">Mínimo</th>
                            <th className="px-4 py-3 text-right w-44">Movimientos</th>
                            <th className="px-4 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filtered.length === 0 && (
                            <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400 italic">
                                {items.length === 0 ? "No hay items cargados todavía." : "No hay resultados."}
                            </td></tr>
                        )}
                        {filtered.map(item => {
                            const isLow = item.min_quantity > 0 && item.current_quantity <= item.min_quantity;
                            const isOpen = openHistoryFor === item.id;
                            const itemMovements = movements[item.id] || [];
                            return (
                                <>
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-2 py-3 align-top">
                                            <button
                                                onClick={() => loadHistory(item.id)}
                                                className="p-1 text-gray-400 hover:text-gray-700"
                                                title="Ver historial"
                                            >
                                                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <div className="font-medium text-gray-900">{item.name}</div>
                                            {item.notes && <div className="text-xs text-gray-500 mt-0.5">{item.notes}</div>}
                                        </td>
                                        <td className="px-4 py-3 align-top text-xs text-gray-500">{item.sku || "—"}</td>
                                        <td className="px-4 py-3 align-top">
                                            {item.category ? (
                                                <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-gray-100 text-gray-700 rounded">
                                                    {item.category}
                                                </span>
                                            ) : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className={`px-4 py-3 align-top text-right tabular-nums font-semibold ${isLow ? "text-rose-600" : "text-gray-900"}`}>
                                            {item.current_quantity.toLocaleString("es-AR")}
                                            <span className="text-xs text-gray-400 ml-1 font-normal">{item.unit}</span>
                                        </td>
                                        <td className="px-4 py-3 align-top text-right text-xs text-gray-500 tabular-nums">
                                            {item.min_quantity || "—"}
                                        </td>
                                        <td className="px-4 py-3 align-top text-right">
                                            <div className="flex justify-end gap-1">
                                                <QuickMoveButton item={item} sign={1} onDone={refresh} />
                                                <QuickMoveButton item={item} sign={-1} onDone={refresh} />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <button onClick={() => deleteItem(item.id)} className="p-1.5 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Eliminar">
                                                <Trash2 size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                    {isOpen && (
                                        <tr className="bg-gray-50">
                                            <td colSpan={8} className="px-6 py-3">
                                                <div className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-2">
                                                    <History size={13} /> Historial (últimos 50)
                                                </div>
                                                {itemMovements.length === 0 ? (
                                                    <p className="text-xs text-gray-400 italic">Sin movimientos.</p>
                                                ) : (
                                                    <ul className="space-y-1">
                                                        {itemMovements.map(m => (
                                                            <li key={m.id} className="flex items-center gap-3 text-xs">
                                                                <span className="text-gray-400 w-32 shrink-0">
                                                                    {format(new Date(m.created_at), "d MMM yyyy HH:mm", { locale: es })}
                                                                </span>
                                                                <span className={`tabular-nums font-medium w-16 text-right ${m.quantity >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                                                    {m.quantity >= 0 ? "+" : ""}{m.quantity}
                                                                </span>
                                                                <span className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[10px] uppercase font-medium text-gray-600 shrink-0">
                                                                    {REASON_LABEL[m.reason] || m.reason}
                                                                </span>
                                                                <span className="text-gray-600 truncate flex-1">
                                                                    {m.note || (m.order_id ? `Pedido #${m.order_id.slice(0, 8)}` : "—")}
                                                                </span>
                                                                <span className="text-gray-400 shrink-0">{m.author_email || ""}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function QuickMoveButton({ item, sign, onDone }: { item: StockItem; sign: 1 | -1; onDone: () => void | Promise<void> }) {
    const supabase = createClient();
    const [open, setOpen] = useState(false);
    const [qty, setQty] = useState<string>("1");
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);
    const reason = sign === 1 ? "entrada" : "ajuste";
    const label = sign === 1 ? "Entrada" : "Salida";
    const Icon = sign === 1 ? Plus : Minus;
    const cls = sign === 1
        ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
        : "text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200";

    const submit = async () => {
        const n = parseFloat(qty);
        if (!n || n <= 0) return alert("Cantidad inválida");
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("stock_movements").insert({
            stock_item_id: item.id,
            quantity: sign * n,
            reason,
            user_id: user?.id,
            author_email: user?.email,
            note: note.trim() || null,
        });
        setSaving(false);
        if (error) return alert("Error: " + error.message);
        setOpen(false);
        setQty("1");
        setNote("");
        await onDone();
    };

    return (
        <div className="relative inline-block">
            <button
                onClick={() => setOpen(o => !o)}
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded-md transition-colors ${cls}`}
                title={label}
            >
                <Icon size={11} /> {label}
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-md shadow-lg p-3 w-64">
                        <div className="text-xs font-medium text-gray-700 mb-2">{label} de {item.name}</div>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={qty}
                            onChange={e => setQty(e.target.value)}
                            className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder={`Cantidad (${item.unit})`}
                            autoFocus
                        />
                        <input
                            type="text"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Nota (opcional)"
                            className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setOpen(false)} className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                            <button onClick={submit} disabled={saving} className="px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
                                {saving ? "…" : "Confirmar"}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function NewItemForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void | Promise<void> }) {
    const supabase = createClient();
    const [name, setName] = useState("");
    const [sku, setSku] = useState("");
    const [category, setCategory] = useState("");
    const [unit, setUnit] = useState("u");
    const [initialQty, setInitialQty] = useState<string>("0");
    const [minQty, setMinQty] = useState<string>("");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!name.trim()) return alert("Nombre obligatorio");
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { data: item, error } = await supabase
            .from("stock_items")
            .insert({
                name: name.trim(),
                sku: sku.trim() || null,
                category: category.trim() || null,
                unit: unit.trim() || "u",
                min_quantity: parseFloat(minQty) || 0,
                notes: notes.trim() || null,
            })
            .select()
            .single();

        if (error) {
            alert("Error: " + error.message);
            setSaving(false);
            return;
        }

        const qty = parseFloat(initialQty);
        if (qty > 0 && item) {
            await supabase.from("stock_movements").insert({
                stock_item_id: item.id,
                quantity: qty,
                reason: "entrada",
                user_id: user?.id,
                author_email: user?.email,
                note: "Stock inicial",
            });
        }

        setSaving(false);
        await onCreated();
    };

    const inputCls = "w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";
    const labelCls = "text-xs font-medium text-gray-700 mb-1.5 block";

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Nuevo item de stock</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                    <label className={labelCls}>Nombre *</label>
                    <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Chapa galvanizada 1.5mm" />
                </div>
                <div>
                    <label className={labelCls}>SKU (opcional)</label>
                    <input value={sku} onChange={e => setSku(e.target.value)} className={inputCls} placeholder="Para match con configurador" />
                </div>
                <div>
                    <label className={labelCls}>Categoría</label>
                    <input value={category} onChange={e => setCategory(e.target.value)} className={inputCls} placeholder="chapa, caño, panel…" />
                </div>
                <div>
                    <label className={labelCls}>Unidad</label>
                    <select value={unit} onChange={e => setUnit(e.target.value)} className={inputCls}>
                        <option value="u">unidades</option>
                        <option value="m">metros</option>
                        <option value="m²">m²</option>
                        <option value="kg">kg</option>
                        <option value="l">litros</option>
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Stock inicial</label>
                    <input type="number" step="0.01" value={initialQty} onChange={e => setInitialQty(e.target.value)} className={inputCls} />
                </div>
                <div>
                    <label className={labelCls}>Stock mínimo (alerta)</label>
                    <input type="number" step="0.01" value={minQty} onChange={e => setMinQty(e.target.value)} className={inputCls} placeholder="Opcional" />
                </div>
                <div className="md:col-span-2">
                    <label className={labelCls}>Notas</label>
                    <input value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} placeholder="Proveedor, formato, etc." />
                </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Cancelar</button>
                <button onClick={submit} disabled={saving} className="px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
                    {saving ? "Guardando…" : "Crear item"}
                </button>
            </div>
        </div>
    );
}
