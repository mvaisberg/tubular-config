"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Search, Trash2, MessageCircle, Truck, Store as StoreIcon, RefreshCw, ExternalLink, MessageSquare, Pencil, Download, Tag, Package } from "lucide-react";
import { OrderComments } from "./OrderComments";
import Link from "next/link";

interface OrderItem {
    id?: string;
    description: string;
    quantity: number;
    unit_price: number;
    quote_id?: string | null;
    quote_url?: string | null;
    // Foto del producto de catálogo, o screenshot 3D si salió del configurador.
    image_url?: string | null;
}

function quoteLink(item: OrderItem): string | null {
    if (item.quote_id) return `/configurador/?quote=${item.quote_id}`;
    if (item.quote_url) return item.quote_url;
    return null;
}

/**
 * Miniatura liviana: para las imágenes subidas a WordPress usamos el tamaño
 * -150x150 que el core ya genera (el original pesa cientos de KB). Los
 * screenshots del configurador no son adjuntos de WP y no tienen variantes,
 * así que quedan igual.
 */
function thumbUrl(src: string): string {
    return src.replace(/(\/wp-content\/uploads\/\d{4}\/\d{2}\/[^/]+)\.(jpe?g|png|webp)$/i, "$1-150x150.$2");
}

/**
 * Miniatura del ítem. Degrada en dos pasos: si no existe el -150x150 cae al
 * original, y si tampoco carga muestra un ícono genérico.
 */
function ItemThumb({ src, alt }: { src?: string | null; alt: string }) {
    const [useFull, setUseFull] = useState(false);
    const [failed, setFailed] = useState(false);

    if (!src || failed) {
        return (
            <span className="w-8 h-8 shrink-0 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300">
                <Package size={13} />
            </span>
        );
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={useFull ? src : thumbUrl(src)}
            alt={alt}
            loading="lazy"
            className="w-8 h-8 shrink-0 rounded border border-gray-200 object-cover bg-white"
            onError={() => (useFull ? setFailed(true) : setUseFull(true))}
        />
    );
}

interface Order {
    id: string;
    order_number: number | null;
    created_at: string;
    client_name: string;
    client_whatsapp: string | null;
    observations: string | null;
    shipping_type: "pickup" | "delivery" | null;
    shipping_address: string | null;
    payment_method: "transfer" | "cash" | "other" | null;
    payment_method_label: string | null;
    source: "manual" | "woocommerce" | null;
    woo_order_id: string | null;
    items: OrderItem[] | null;
    total_amount: number;
    discount_percentage: number;
    final_amount: number;
    status: string;
    paid_amount: number;
    fulfillment_status: string | null;
    priority: string | null;
    invoiced: boolean | null;
}

export function formatOrderNumber(n: number | null | undefined): string {
    if (!n) return "TUB-—";
    return `TUB-${String(n).padStart(4, "0")}`;
}

const PRIORITY_STATES: { value: string; label: string; cls: string }[] = [
    { value: "low", label: "Baja", cls: "bg-gray-100 text-gray-600 border-gray-200" },
    { value: "medium", label: "Media", cls: "bg-amber-50 text-amber-700 border-amber-300" },
    { value: "high", label: "Alta", cls: "bg-rose-50 text-rose-700 border-rose-300" },
];

// Estados de logística: Pendiente → Estructura hecha → Embalado → Entregado.
// Cualquier estado legacy distinto cae en la columna "Pendiente".
const FULFILLMENT_STATES: { value: string; label: string; cls: string }[] = [
    { value: "pending", label: "Pendiente", cls: "bg-gray-100 text-gray-700 border-gray-200" },
    { value: "structure_done", label: "Estructura hecha", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    { value: "packed", label: "Embalado", cls: "bg-purple-50 text-purple-700 border-purple-200" },
    { value: "delivered", label: "Entregado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
];

// Mapea el fulfillment_status de un pedido a su columna.
function columnFor(status: string | null | undefined): string {
    if (status === "delivered") return "delivered";
    if (status === "packed") return "packed";
    if (status === "structure_done" || status === "assembled") return "structure_done";
    return "pending"; // pending + cualquier estado legacy (in_production, shipped)
}

type Filter = "all" | "pending" | "partial" | "paid" | "pickup" | "delivery" | "manual" | "woocommerce";

const PAYMENT_LABEL: Record<string, string> = {
    transfer: "Transferencia",
    cash: "Efectivo",
    other: "Otro",
};

export default function OrdersGrid({ initialOrders, showPricing = true }: { initialOrders: Order[]; showPricing?: boolean }) {
    const router = useRouter();
    const supabase = createClient();
    const [orders, setOrders] = useState<Order[]>(initialOrders);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    const [syncing, setSyncing] = useState(false);
    const [showDelivered, setShowDelivered] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [printing, setPrinting] = useState(false);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // Imprime las etiquetas de los pedidos seleccionados: 1 por hoja de 100×150mm.
    const printLabels = async () => {
        const ids = Array.from(selectedIds);
        if (!ids.length) return;
        setPrinting(true);
        try {
            const res = await fetch("/configurador/api/orders/labels", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids }),
            });
            if (!res.ok) { alert("Error al generar las etiquetas"); return; }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
        } catch (e) {
            alert("Error de red: " + (e as Error).message);
        }
        setPrinting(false);
    };

    // Exporta todos los pedidos a CSV (se abre bien en Excel: BOM UTF-8 + separador ;).
    const exportCSV = () => {
        const statusLabel: Record<string, string> = { pending: "Pendiente", partial: "Seña", paid: "Pagado" };
        const cell = (v: unknown) => {
            const s = String(v ?? "");
            return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const priorityLabel = (p: string | null) => PRIORITY_STATES.find(s => s.value === p)?.label || "—";
        const fulfLabel = (f: string | null) => FULFILLMENT_STATES.find(s => s.value === columnFor(f))?.label || "—";
        const headers = ["Pedido", "Fecha", "Cliente", "WhatsApp", "Origen", "Estado pago", "Total", "Pagado/Seña", "Saldo", "Método pago", "Entrega", "Dirección", "Estado entrega", "Prioridad", "Facturada"];
        const rows = orders.map(o => {
            const total = Math.round(Number(o.final_amount) || 0);
            const paid = Math.round(Number(o.paid_amount) || 0);
            return [
                `TUB-${String(o.order_number || 0).padStart(4, "0")}`,
                new Date(o.created_at).toLocaleDateString("es-AR"),
                o.client_name || "",
                o.client_whatsapp || "",
                o.source === "woocommerce" ? "WooCommerce" : "Manual",
                statusLabel[o.status] || o.status,
                total,
                paid,
                total - paid,
                o.payment_method_label || PAYMENT_LABEL[o.payment_method || ""] || "",
                o.shipping_type === "delivery" ? "Envío" : "Retiro",
                o.shipping_address || "",
                fulfLabel(o.fulfillment_status),
                priorityLabel(o.priority),
                o.invoiced ? "Sí" : "No",
            ];
        });
        const csv = [headers, ...rows].map(r => r.map(cell).join(";")).join("\n");
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pedidos-tubular-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return orders.filter(o => {
            if (filter === "pending" && o.status !== "pending") return false;
            if (filter === "partial" && o.status !== "partial") return false;
            if (filter === "paid" && o.status !== "paid") return false;
            if (filter === "pickup" && o.shipping_type !== "pickup") return false;
            if (filter === "delivery" && o.shipping_type !== "delivery") return false;
            if (filter === "manual" && o.source !== "manual") return false;
            if (filter === "woocommerce" && o.source !== "woocommerce") return false;
            if (!q) return true;
            const hay = [
                o.client_name,
                o.client_whatsapp,
                o.woo_order_id,
                o.shipping_address,
            ].filter(Boolean).join(" ").toLowerCase();
            return hay.includes(q);
        });
    }, [orders, query, filter]);

    const counts = useMemo(() => ({
        all: orders.length,
        pending: orders.filter(o => o.status === "pending").length,
        partial: orders.filter(o => o.status === "partial").length,
        paid: orders.filter(o => o.status === "paid").length,
    }), [orders]);

    // Agrupa los pedidos filtrados en las 3 columnas por estado de logística.
    const columns = useMemo(() => {
        const groups: Record<string, Order[]> = { pending: [], structure_done: [], packed: [], delivered: [] };
        filtered.forEach(o => groups[columnFor(o.fulfillment_status)].push(o));
        return groups;
    }, [filtered]);

    // Cambiar el estado de logística vive en el padre para que la tarjeta
    // se mueva de columna al instante (optimista) y se persista en Supabase.
    // Regla de negocio: si se marca "Entregado", se da por cobrado (pagado total).
    const updateFulfillment = async (id: string, next: string) => {
        let prev: string | null = null;
        let prevStatus: string | null = null;
        let prevPaid: number | null = null;
        const markPaid = next === "delivered";
        setOrders(os => os.map(o => {
            if (o.id !== id) return o;
            prev = o.fulfillment_status;
            prevStatus = o.status;
            prevPaid = o.paid_amount;
            return markPaid
                ? { ...o, fulfillment_status: next, status: "paid", paid_amount: o.final_amount }
                : { ...o, fulfillment_status: next };
        }));
        const patch: Record<string, unknown> = { fulfillment_status: next };
        if (markPaid) {
            const ord = orders.find(o => o.id === id);
            patch.status = "paid";
            patch.paid_amount = ord?.final_amount ?? 0;
        }
        const { error } = await supabase
            .from("admin_orders")
            .update(patch)
            .eq("id", id);
        if (error) {
            alert("Error: " + error.message);
            setOrders(os => os.map(o => o.id === id ? { ...o, fulfillment_status: prev, status: prevStatus ?? o.status, paid_amount: prevPaid ?? o.paid_amount } : o));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar este pedido?")) return;
        const { error } = await supabase.from("admin_orders").delete().eq("id", id);
        if (error) return alert("Error: " + error.message);
        setOrders(orders.filter(o => o.id !== id));
    };

    // Marcar la orden como facturada / no facturada (para Contabilidad).
    const updateInvoiced = async (id: string, value: boolean) => {
        setOrders(os => os.map(o => o.id === id ? { ...o, invoiced: value } : o));
        const { error } = await supabase
            .from("admin_orders")
            .update({ invoiced: value, invoiced_at: value ? new Date().toISOString() : null })
            .eq("id", id);
        if (error) {
            alert("Error: " + error.message);
            setOrders(os => os.map(o => o.id === id ? { ...o, invoiced: !value } : o));
        }
    };

    // Re-consulta los pedidos y actualiza el estado local (mismo orden que el server).
    // Necesario tras el sync: router.refresh() repuebla initialOrders pero NO el
    // useState local, así que sin esto la lista no cambia hasta recargar a mano.
    const refetchOrders = async () => {
        const { data, error } = await supabase
            .from("admin_orders")
            .select("*")
            .order("created_at", { ascending: false });
        if (!error && data) setOrders(data as Order[]);
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch("/configurador/api/woocommerce/sync", { method: "POST" });
            const raw = await res.text();
            let data: { created?: number; updated?: number; removed?: number; total?: number; error?: string; errors?: string[] } = {};
            try { data = JSON.parse(raw); } catch {
                alert(`Error ${res.status}: respuesta no JSON.\n\n${raw.slice(0, 300)}`);
                setSyncing(false);
                return;
            }
            if (!res.ok) {
                alert(data.error || `Error ${res.status}`);
            } else {
                const errSuffix = data.errors?.length ? `\n\n${data.errors.length} ítem(s) con error:\n${data.errors.slice(0, 5).join("\n")}` : "";
                await refetchOrders();
                const removedTxt = data.removed ? `, ${data.removed} cancelados eliminados` : "";
                alert(`Sync OK: ${data.created ?? 0} nuevos, ${data.updated ?? 0} actualizados${removedTxt} de ${data.total ?? 0} totales.${errSuffix}`);
                router.refresh();
            }
        } catch (e) {
            alert("Error de red: " + (e as Error).message);
        }
        setSyncing(false);
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
                        placeholder="Buscar por nombre, WhatsApp o ID…"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <>
                            <button
                                onClick={printLabels}
                                disabled={printing}
                                className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                title="Imprimir etiquetas (1 por hoja 100×150mm)"
                            >
                                <Tag size={14} />
                                {printing ? "Generando…" : `Imprimir etiquetas (${selectedIds.size})`}
                            </button>
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="text-xs text-gray-500 hover:text-gray-700 px-1"
                                title="Limpiar selección"
                            >
                                Limpiar
                            </button>
                        </>
                    )}
                    {showPricing && (
                        <button
                            onClick={exportCSV}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                            title="Exportar todos los pedidos a CSV"
                        >
                            <Download size={14} />
                            Exportar CSV
                        </button>
                    )}
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        title="Sincronizar pedidos desde WooCommerce"
                    >
                        <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                        {syncing ? "Sincronizando…" : "Sincronizar Woo"}
                    </button>
                </div>
            </div>

            {/* Filter chips */}
            <div className="flex flex-wrap gap-2">
                {([
                    ["all", `Todos (${counts.all})`],
                    ["pending", `Pendientes (${counts.pending})`],
                    ["partial", `Seña (${counts.partial})`],
                    ["paid", `Pagados (${counts.paid})`],
                    ["pickup", "Retiro"],
                    ["delivery", "Envío"],
                    ["manual", "Manual"],
                    ["woocommerce", "WooCommerce"],
                ] as [Filter, string][]).map(([k, label]) => (
                    <button
                        key={k}
                        onClick={() => setFilter(k)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === k ? "bg-gray-900 text-white" : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"}`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Toggle columna Entregados (oculta por defecto, es para consultar historial) */}
            <div className="flex justify-end">
                <button
                    onClick={() => setShowDelivered(v => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                    {showDelivered ? "Ocultar entregados" : `Ver entregados (${(columns.delivered || []).length})`}
                </button>
            </div>

            {/* Tablero por estado de logística */}
            {filtered.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-16 text-center text-gray-400 text-sm">
                    {orders.length === 0 ? "No hay pedidos todavía." : "No hay resultados para tu búsqueda."}
                </div>
            ) : (
                <div className={`grid grid-cols-1 gap-4 items-start ${showDelivered ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3"}`}>
                    {(showDelivered ? FULFILLMENT_STATES : FULFILLMENT_STATES.filter(s => s.value !== "delivered")).map(col => {
                        const colOrders = columns[col.value] || [];
                        return (
                            <div key={col.value} className="bg-gray-50/70 border border-gray-200 rounded-lg flex flex-col">
                                <div className="px-3 py-2.5 border-b border-gray-200 flex items-center justify-between gap-2 sticky top-0 bg-gray-50/95 backdrop-blur rounded-t-lg z-10">
                                    <span className={`px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded border ${col.cls}`}>
                                        {col.label}
                                    </span>
                                    <span className="text-xs font-semibold text-gray-500 tabular-nums">{colOrders.length}</span>
                                </div>
                                <div className="p-3 space-y-3 min-h-[80px]">
                                    {colOrders.length === 0 ? (
                                        <div className="text-center text-xs text-gray-300 py-6">Sin pedidos</div>
                                    ) : (
                                        colOrders.map(order => (
                                            <OrderCard
                                                key={order.id}
                                                order={order}
                                                onDelete={() => handleDelete(order.id)}
                                                onFulfillmentChange={updateFulfillment}
                                                onInvoicedChange={updateInvoiced}
                                                showPricing={showPricing}
                                                selected={selectedIds.has(order.id)}
                                                onToggleSelect={() => toggleSelect(order.id)}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function OrderCard({ order, onDelete, onFulfillmentChange, onInvoicedChange, showPricing, selected, onToggleSelect }: { order: Order; onDelete: () => void; onFulfillmentChange: (id: string, next: string) => void; onInvoicedChange: (id: string, value: boolean) => void; showPricing: boolean; selected: boolean; onToggleSelect: () => void }) {
    const isPaid = order.status === "paid";
    const isWoo = order.source === "woocommerce";
    const itemsCount = order.items?.reduce((acc, i) => acc + (i.quantity || 0), 0) || 0;
    const [commentsOpen, setCommentsOpen] = useState(false);
    const fulfillment = columnFor(order.fulfillment_status);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [priority, setPriority] = useState(order.priority || "low");
    const [priorityOpen, setPriorityOpen] = useState(false);
    const [piecesOpen, setPiecesOpen] = useState(false);
    const [pieces, setPieces] = useState<{ pieces: { name: string; sku: string; quantity: number }[]; unsupported: { description: string; quantity: number }[] } | null>(null);
    const [piecesLoading, setPiecesLoading] = useState(false);
    const supabase = createClient();

    const togglePieces = async () => {
        const next = !piecesOpen;
        setPiecesOpen(next);
        if (next && !pieces) {
            setPiecesLoading(true);
            try {
                const res = await fetch(`/configurador/api/orders/${order.id}/bom`);
                const data = await res.json();
                if (res.ok) setPieces({ pieces: data.pieces || [], unsupported: data.unsupported || [] });
                else setPieces({ pieces: [], unsupported: [] });
            } catch {
                setPieces({ pieces: [], unsupported: [] });
            }
            setPiecesLoading(false);
        }
    };
    const fulfillmentMeta = FULFILLMENT_STATES.find(s => s.value === fulfillment) || FULFILLMENT_STATES[0];
    const priorityMeta = PRIORITY_STATES.find(s => s.value === priority) || PRIORITY_STATES[0];

    const updateFulfillment = (next: string) => {
        setPickerOpen(false);
        onFulfillmentChange(order.id, next);
    };

    const updatePriority = async (next: string) => {
        const prev = priority;
        setPriority(next);
        setPriorityOpen(false);
        const { error } = await supabase
            .from("admin_orders")
            .update({ priority: next })
            .eq("id", order.id);
        if (error) {
            alert("Error: " + error.message);
            setPriority(prev);
        }
    };

    const cardTint = priority === "high"
        ? "bg-rose-50 border-rose-300 hover:border-rose-400"
        : priority === "medium"
            ? "bg-amber-50 border-amber-300 hover:border-amber-400"
            : "bg-white border-gray-200 hover:border-gray-300";
    const footerTint = priority === "high"
        ? "border-rose-200 bg-rose-100/60"
        : priority === "medium"
            ? "border-amber-200 bg-amber-100/60"
            : "border-gray-100 bg-gray-50";
    const headerBorder = priority === "high"
        ? "border-rose-200"
        : priority === "medium"
            ? "border-amber-200"
            : "border-gray-100";

    return (
        <div className={`border rounded-lg hover:shadow-sm transition-all flex flex-col overflow-hidden ${cardTint} ${selected ? "ring-2 ring-indigo-500 ring-offset-1" : ""}`}>
            {/* Header */}
            <div className={`px-4 py-3 border-b flex justify-between items-center gap-2 ${headerBorder}`}>
                <label className="flex items-center shrink-0 cursor-pointer mr-1" title="Seleccionar para imprimir etiqueta">
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={onToggleSelect}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                    {showPricing && (() => {
                        const isPartial = order.status === "partial" || (Number(order.paid_amount) > 0 && Number(order.paid_amount) < Number(order.final_amount));
                        const cls = isPaid
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : isPartial
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : "bg-amber-50 text-amber-700 border-amber-200";
                        const lbl = isPaid ? "Pagado" : isPartial ? "Seña" : "Pendiente";
                        return (
                            <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded border ${cls}`}>
                                {lbl}
                            </span>
                        );
                    })()}
                    {/* Priority chip */}
                    <div className="relative">
                        <button
                            onClick={() => setPriorityOpen(o => !o)}
                            className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded border cursor-pointer hover:opacity-80 transition-opacity ${priorityMeta.cls}`}
                            title="Cambiar prioridad"
                        >
                            {priorityMeta.label} ▾
                        </button>
                        {priorityOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setPriorityOpen(false)} />
                                <ul className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[120px]">
                                    {PRIORITY_STATES.map(s => (
                                        <li key={s.value}>
                                            <button
                                                onClick={() => updatePriority(s.value)}
                                                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 active:bg-gray-100 transition-colors ${s.value === priority ? "font-semibold text-gray-900" : "text-gray-700"}`}
                                            >
                                                {s.label}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>

                    {/* Fulfillment chip — clickable to change */}
                    <div className="relative">
                        <button
                            onClick={() => setPickerOpen(o => !o)}
                            className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded border cursor-pointer hover:opacity-80 transition-opacity ${fulfillmentMeta.cls}`}
                            title="Cambiar estado de logística"
                        >
                            {fulfillmentMeta.label} ▾
                        </button>
                        {pickerOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
                                <ul className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[160px]">
                                    {FULFILLMENT_STATES.map(s => (
                                        <li key={s.value}>
                                            <button
                                                onClick={() => updateFulfillment(s.value)}
                                                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 active:bg-gray-100 transition-colors ${s.value === fulfillment ? "font-semibold text-gray-900" : "text-gray-700"}`}
                                            >
                                                {s.label}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                    {order.payment_method && (
                        <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded border ${
                            order.payment_method === "cash" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : order.payment_method === "transfer" ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-gray-50 text-gray-600 border-gray-200"
                        }`} title="Método de pago">
                            {order.payment_method_label || PAYMENT_LABEL[order.payment_method] || order.payment_method}
                        </span>
                    )}
                    {isWoo && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-purple-50 text-purple-700 border border-purple-200">
                            Woo {order.woo_order_id ? `#${order.woo_order_id}` : ""}
                        </span>
                    )}
                </div>
                <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs font-semibold text-gray-700 tabular-nums">
                        {formatOrderNumber(order.order_number)}
                    </span>
                    <span className="text-[10px] text-gray-400">
                        {format(new Date(order.created_at), "d MMM yyyy", { locale: es })}
                    </span>
                </div>
            </div>

            {/* Body */}
            <div className="px-4 py-4 space-y-3 flex-1">
                <div>
                    <h3 className="text-base font-semibold text-gray-900 truncate">{order.client_name}</h3>
                    {order.client_whatsapp && (
                        <a
                            href={`https://wa.me/${order.client_whatsapp.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-emerald-600 transition-colors mt-0.5"
                        >
                            <MessageCircle size={11} /> {order.client_whatsapp}
                        </a>
                    )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    {order.shipping_type === "delivery" ? (
                        <>
                            <Truck size={12} />
                            <span className="truncate">{order.shipping_address || "Envío"}</span>
                        </>
                    ) : (
                        <>
                            <StoreIcon size={12} /> Retiro
                        </>
                    )}
                </div>

                <div className="border-t border-gray-100 pt-3 text-xs text-gray-600 space-y-1.5">
                    {(order.items?.slice(0, 3) || []).map((it, i) => {
                        const link = quoteLink(it);
                        return (
                            <div key={i} className="flex justify-between gap-2 items-center">
                                <span className="flex items-center gap-1.5 min-w-0">
                                    <ItemThumb src={it.image_url} alt={it.description || "Producto"} />
                                    <span className="truncate">{it.quantity}× {it.description || "—"}</span>
                                    {link && (
                                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 shrink-0" title="Ver en configurador">
                                            <ExternalLink size={11} />
                                        </a>
                                    )}
                                </span>
                                {showPricing && (
                                    <span className="shrink-0 text-gray-500 tabular-nums">${(it.quantity * it.unit_price).toLocaleString("es-AR")}</span>
                                )}
                            </div>
                        );
                    })}
                    {(order.items?.length || 0) > 3 && (
                        <div className="text-xs text-gray-400 pt-0.5">
                            +{(order.items?.length || 0) - 3} más · {itemsCount} unidades
                        </div>
                    )}
                </div>

                {order.observations && (
                    <div className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2 whitespace-pre-wrap break-words">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 block mb-0.5">Comentario</span>
                        {order.observations}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className={`px-4 py-3 border-t flex items-center justify-between gap-2 ${footerTint}`}>
                <div>
                    {showPricing && (
                        <label className="flex items-center gap-1.5 cursor-pointer mb-1" title="Marcar como facturada (para Contabilidad)">
                            <input
                                type="checkbox"
                                checked={!!order.invoiced}
                                onChange={e => onInvoicedChange(order.id, e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span className={`text-[11px] font-semibold ${order.invoiced ? "text-emerald-700" : "text-gray-500"}`}>
                                {order.invoiced ? "Facturada ✓" : "Facturar"}
                            </span>
                        </label>
                    )}
                    <div className="text-xs text-gray-500">
                        {order.payment_method ? (order.payment_method_label || PAYMENT_LABEL[order.payment_method] || order.payment_method) : "—"}
                        {showPricing && order.discount_percentage > 0 && ` · -${order.discount_percentage}%`}
                    </div>
                    {showPricing ? (() => {
                        const paid = Number(order.paid_amount) || 0;
                        const finalAmt = Number(order.final_amount) || 0;
                        const isPartial = paid > 0 && paid < finalAmt;
                        return (
                            <>
                                <div className="text-lg font-semibold text-gray-900 tabular-nums leading-tight">
                                    ${Math.round(finalAmt).toLocaleString("es-AR")}
                                </div>
                                {isPartial && (
                                    <div className="text-xs text-indigo-600 tabular-nums mt-0.5">
                                        Seña ${Math.round(paid).toLocaleString("es-AR")} · Saldo <span className="font-semibold">${Math.round(finalAmt - paid).toLocaleString("es-AR")}</span>
                                    </div>
                                )}
                            </>
                        );
                    })() : (
                        <div className="text-xs text-gray-400 italic">Monto oculto</div>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={togglePieces}
                        className={`p-2 rounded-md transition-colors ${piecesOpen ? "text-indigo-600 bg-indigo-50" : "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100"}`}
                        title="Ver piezas para armar"
                    >
                        <Package size={14} />
                    </button>
                    <button
                        onClick={() => setCommentsOpen(o => !o)}
                        className={`p-2 rounded-md transition-colors ${commentsOpen ? "text-indigo-600 bg-indigo-50" : "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100"}`}
                        title="Comentarios"
                    >
                        <MessageSquare size={14} />
                    </button>
                    <a
                        href={`/configurador/api/orders/${order.id}/label`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 rounded-md transition-colors"
                        title="Imprimir etiqueta"
                    >
                        <Tag size={14} />
                    </a>
                    {showPricing && (
                        <>
                            <Link
                                href={`/admin/orders/${order.id}`}
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 rounded-md transition-colors"
                                title="Editar"
                            >
                                <Pencil size={14} />
                            </Link>
                            <a
                                href={`/configurador/api/orders/${order.id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 rounded-md transition-colors"
                                title="Descargar PDF"
                            >
                                <Download size={14} />
                            </a>
                            <button
                                onClick={onDelete}
                                className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 rounded-md transition-colors"
                                title="Eliminar"
                            >
                                <Trash2 size={14} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Panel de piezas para el armador */}
            {piecesOpen && (
                <div className="px-4 py-3 border-t border-gray-100 bg-indigo-50/40">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-2">
                        <Package size={13} /> Piezas para armar
                    </div>
                    {piecesLoading ? (
                        <div className="text-xs text-gray-400 italic py-2">Calculando piezas…</div>
                    ) : !pieces || (pieces.pieces.length === 0 && pieces.unsupported.length === 0) ? (
                        <div className="text-xs text-gray-400 italic py-2">Sin piezas para mostrar.</div>
                    ) : (
                        <>
                            {pieces.pieces.length > 0 && (
                                <ul className="space-y-1">
                                    {pieces.pieces.map(p => (
                                        <li key={p.sku} className="flex justify-between items-center gap-2 text-xs">
                                            <span className="text-gray-700 truncate">{p.name}</span>
                                            <span className="shrink-0 font-semibold text-gray-900 tabular-nums bg-white border border-gray-200 rounded px-1.5 py-0.5">
                                                ×{p.quantity}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {pieces.unsupported.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                    <div className="text-[10px] uppercase tracking-wide text-amber-600 font-semibold mb-1">
                                        Sin desglose (producto de catálogo)
                                    </div>
                                    <ul className="space-y-0.5">
                                        {pieces.unsupported.map((u, i) => (
                                            <li key={i} className="text-xs text-gray-500">
                                                {u.quantity}× {u.description}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            <OrderComments orderId={order.id} expanded={commentsOpen} />
        </div>
    );
}
