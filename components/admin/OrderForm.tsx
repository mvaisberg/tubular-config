"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2 } from "lucide-react";

export interface OrderItem {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    quote_id?: string | null;
    quote_url?: string | null;
    woo_product_id?: number | null;
    image_url?: string | null;
    color?: string | null;
    colorSel?: Record<string, string> | null;
}

interface VariationAttr { name: string; options: string[] }
interface WooProductOption { id: number; name: string; sku: string; category: string; price: number; image: string; variationAttributes: VariationAttr[]; }

export type ShippingType = "pickup" | "delivery";
export type PaymentMethod = "transfer" | "cash" | "other";
export type Status = "pending" | "partial" | "paid";

export interface OrderFormInitial {
    id?: string;
    client_name?: string;
    client_whatsapp?: string | null;
    observations?: string | null;
    shipping_type?: ShippingType | null;
    shipping_address?: string | null;
    items?: OrderItem[] | null;
    payment_method?: PaymentMethod | null;
    discount_percentage?: number;
    status?: Status;
    paid_amount?: number | null;
}

const PAYMENT_DISCOUNT: Record<PaymentMethod, number> = {
    transfer: 20,
    cash: 20,
    other: 0,
};

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
    transfer: "Transferencia (−20%)",
    cash: "Efectivo (−20%)",
    other: "Otro (sin descuento)",
};

function parseQuoteId(input: string): string | null {
    const s = input.trim();
    if (!s) return null;
    const m = s.match(/[?&]quote=([a-zA-Z0-9-]+)/);
    if (m) return m[1];
    if (/^[a-zA-Z0-9-]{8,}$/.test(s)) return s;
    return null;
}

export function OrderForm({ mode, initial }: { mode: "create" | "edit"; initial?: OrderFormInitial }) {
    const router = useRouter();
    const supabase = createClient();
    const [loading, setLoading] = useState(false);

    const initialItems: OrderItem[] = (initial?.items || []).map(i => ({
        id: i.id || crypto.randomUUID(),
        description: i.description || "",
        quantity: i.quantity || 1,
        unit_price: Number(i.unit_price) || 0,
        quote_id: i.quote_id ?? null,
        quote_url: i.quote_url ?? null,
        woo_product_id: i.woo_product_id ?? null,
        image_url: i.image_url ?? null,
        color: i.color ?? (i.description?.includes(" · ") ? i.description.split(" · ").slice(1).join(" · ") : null),
        colorSel: i.colorSel ?? null,
    }));

    // The stored discount_percentage = paymentMethod discount + extra. Split it back.
    const initialPaymentMethod: PaymentMethod = (initial?.payment_method as PaymentMethod) || "other";
    const paymentBase = PAYMENT_DISCOUNT[initialPaymentMethod];
    const totalDiscountInitial = Number(initial?.discount_percentage) || 0;
    const initialExtraDiscount = Math.max(0, totalDiscountInitial - paymentBase);

    const [clientName, setClientName] = useState(initial?.client_name || "");
    const [clientWhatsapp, setClientWhatsapp] = useState(initial?.client_whatsapp || "");
    const [observations, setObservations] = useState(initial?.observations || "");
    const [shippingType, setShippingType] = useState<ShippingType>((initial?.shipping_type as ShippingType) || "pickup");
    const [shippingAddress, setShippingAddress] = useState(initial?.shipping_address || "");
    const [items, setItems] = useState<OrderItem[]>(initialItems);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialPaymentMethod);
    const [extraDiscount, setExtraDiscount] = useState<number>(initialExtraDiscount);

    // Derivar status inicial. Acepta legacy "paid"/"pending"; si paid_amount > 0 y < final, es "partial".
    const initialPaid = Number(initial?.paid_amount) || 0;
    const initialStatusFromData: Status = initial?.status === "paid"
        ? "paid"
        : (initialPaid > 0 ? "partial" : "pending");
    const [status, setStatus] = useState<Status>(initialStatusFromData);
    const [senaAmount, setSenaAmount] = useState<number>(status === "partial" ? initialPaid : 0);

    const [wooProducts, setWooProducts] = useState<WooProductOption[]>([]);
    useEffect(() => {
        fetch("/configurador/api/woocommerce/products")
            .then(r => r.json())
            .then(d => { if (Array.isArray(d.products)) setWooProducts(d.products); })
            .catch(() => {});
    }, []);

    // Cajas para elegir dónde entra la seña/cobro.
    const [cashBoxes, setCashBoxes] = useState<{ id: string; name: string; currency: string }[]>([]);
    const [cashBoxId, setCashBoxId] = useState<string>("");
    const [usdRate, setUsdRate] = useState<number>(1000);
    const [boxAmountOverride, setBoxAmountOverride] = useState<string>("");
    useEffect(() => {
        supabase.from("cash_boxes").select("id,name,currency").order("sort_order")
            .then(({ data }) => { if (data) setCashBoxes(data); });
        supabase.from("settings").select("usd_exchange_rate").eq("id", 1).single()
            .then(({ data }) => {
                const r = Number(data?.usd_exchange_rate);
                if (r > 0) setUsdRate(r);
            });
        // Al editar, precargar la caja del movimiento existente de este pedido.
        if (initial?.id) {
            supabase.from("cash_movements").select("box_id,amount").eq("order_id", initial.id).limit(1)
                .then(({ data }) => {
                    if (data && data[0]) {
                        setCashBoxId(data[0].box_id);
                        setBoxAmountOverride(String(data[0].amount));
                    }
                });
        }
    }, [initial?.id, supabase]);

    // Elegir un producto de catálogo: autocompleta descripción y precio del ítem.
    const pickWooProduct = (itemId: string, wooId: number | null) => {
        const w = wooProducts.find(p => p.id === wooId);
        setItems(prev => prev.map(i => {
            if (i.id !== itemId) return i;
            if (!w) return { ...i, woo_product_id: null, image_url: null };
            return {
                ...i,
                woo_product_id: w.id,
                description: w.name,
                unit_price: w.price || i.unit_price,
                image_url: w.image || null,
                color: null,
                colorSel: null,
                // Un producto de catálogo no lleva link de configurador.
                quote_id: null,
                quote_url: null,
            };
        }));
    };

    // Elegir el color de una posición de estante (atributo de variación real del producto).
    // Combina todas las posiciones y lo refleja en la descripción ("Producto · c1 / c2 / c3")
    // para que el informe de piezas lo desglose por color.
    const setItemColorAttr = (itemId: string, attrName: string, value: string) => {
        setItems(prev => prev.map(i => {
            if (i.id !== itemId) return i;
            const w = wooProducts.find(p => p.id === i.woo_product_id);
            const base = (w ? w.name : i.description.split(" · ")[0]).trim();
            const sel = { ...(i.colorSel || {}), [attrName]: value };
            const order = w ? w.variationAttributes.map(a => a.name) : Object.keys(sel);
            const combined = order.map(n => sel[n]).filter(Boolean).join(" / ");
            return {
                ...i,
                colorSel: sel,
                color: combined || null,
                description: combined ? `${base} · ${combined}` : base,
            };
        }));
    };

    const addItem = () => {
        setItems([...items, { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0, quote_id: null, quote_url: null, woo_product_id: null }]);
    };

    const updateItem = (id: string, field: keyof OrderItem, value: string | number | null) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

    const subtotal = items.reduce((acc, i) => acc + i.quantity * i.unit_price, 0);
    const paymentDiscountPercent = PAYMENT_DISCOUNT[paymentMethod];
    const paymentDiscountAmount = subtotal * (paymentDiscountPercent / 100);
    const extraDiscountAmount = subtotal * (extraDiscount / 100);
    const totalDiscountPercent = paymentDiscountPercent + extraDiscount;
    const finalAmount = Math.max(0, subtotal - paymentDiscountAmount - extraDiscountAmount);

    const computedPaidAmount = status === "paid"
        ? finalAmount
        : status === "partial"
            ? Math.min(senaAmount, finalAmount)
            : 0;
    const remaining = Math.max(0, finalAmount - computedPaidAmount);

    const selectedBox = cashBoxes.find(b => b.id === cashBoxId);
    const convertedBoxAmount = (() => {
        if (!selectedBox || computedPaidAmount <= 0) return 0;
        if (selectedBox.currency === "USD") {
            return Math.round((computedPaidAmount / usdRate) * 100) / 100;
        }
        return Math.round(computedPaidAmount);
    })();
    const boxAmountToPost = (() => {
        const raw = boxAmountOverride.trim();
        if (raw !== "") {
            const n = parseFloat(raw);
            if (!Number.isNaN(n) && n > 0) return n;
        }
        return convertedBoxAmount;
    })();
    const fmtBox = (n: number, currency: string) => {
        const prefix = currency === "USD" ? "US$" : "$";
        const digits = currency === "ARS" ? 0 : 2;
        return prefix + n.toLocaleString("es-AR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    };

    const handleSave = async () => {
        if (!clientName.trim()) return alert("El nombre del cliente es obligatorio");
        if (items.length === 0) return alert("Debe agregar al menos un ítem");
        if (shippingType === "delivery" && !shippingAddress.trim()) {
            return alert("Para envío, la dirección es obligatoria");
        }
        if (status === "partial" && (!senaAmount || senaAmount <= 0)) {
            return alert("Ingresá el monto de la seña");
        }
        if (status === "partial" && senaAmount >= finalAmount) {
            return alert("La seña no puede ser mayor o igual al total. Si está totalmente pagado, marcalo como Pagado.");
        }
        if (computedPaidAmount > 0 && !cashBoxId) {
            return alert("Elegí la caja donde entra el pago (seña o cobro).");
        }

        setLoading(true);
        const payload = {
            client_name: clientName.trim(),
            client_whatsapp: clientWhatsapp.trim() || null,
            observations: observations.trim() || null,
            shipping_type: shippingType,
            shipping_address: shippingType === "delivery" ? shippingAddress.trim() : null,
            payment_method: paymentMethod,
            items,
            total_amount: subtotal,
            discount_percentage: totalDiscountPercent,
            final_amount: finalAmount,
            status,
            paid_amount: computedPaidAmount,
        };

        let error;
        let orderId: string | null = null;
        if (mode === "create") {
            const res = await supabase.from("admin_orders").insert([{
                ...payload,
                channel: "manual",
                source: "manual",
            }]).select("id").single();
            error = res.error;
            orderId = res.data?.id || null;
        } else if (initial?.id) {
            const res = await supabase.from("admin_orders").update(payload).eq("id", initial.id);
            error = res.error;
            orderId = initial.id;
        }

        if (error) {
            alert("Error al guardar: " + error.message);
            setLoading(false);
            return;
        }

        // Registrar el ingreso de plata en la caja elegida (idempotente por pedido).
        if (orderId) {
            // Borrar el movimiento previo de este pedido (por si se editó monto/caja/estado).
            await supabase.from("cash_movements").delete().eq("order_id", orderId);
            if (computedPaidAmount > 0 && cashBoxId && cashBoxId !== "none") {
                const { data: { user } } = await supabase.auth.getUser();
                const label = status === "paid" ? "Cobro total" : "Seña";
                const boxCur = cashBoxes.find(b => b.id === cashBoxId)?.currency || "ARS";
                const note = boxCur === "USD"
                    ? `Pedido ARS $${Math.round(computedPaidAmount).toLocaleString("es-AR")} · TC ${usdRate}`
                    : null;
                await supabase.from("cash_movements").insert({
                    box_id: cashBoxId,
                    amount: boxAmountToPost,
                    concept: `${label} pedido ${clientName || ""}`.trim(),
                    note,
                    order_id: orderId,
                    author_email: user?.email || null,
                });
            }
        }

        // Sincronizar stock (idempotente: descuenta si está pago, restaura si no).
        if (orderId) {
            try {
                await fetch("/configurador/api/stock/sync-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ order_id: orderId }),
                });
            } catch {
                // No bloqueamos el guardado si el sync falla.
            }
        }

        router.push("/admin/orders");
        router.refresh();
    };

    const inputCls = "w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors";
    const labelCls = "text-xs font-medium text-gray-700 mb-1.5 block";

    return (
        <>
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                {/* Cliente */}
                <section className="p-6">
                    <h2 className="text-sm font-semibold text-gray-900 mb-4">Datos del cliente</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Nombre completo *</label>
                            <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} className={inputCls} placeholder="Juan Pérez" />
                        </div>
                        <div>
                            <label className={labelCls}>WhatsApp</label>
                            <input type="text" value={clientWhatsapp} onChange={e => setClientWhatsapp(e.target.value)} className={inputCls} placeholder="+54 9 11 1234…" />
                        </div>
                        <div className="md:col-span-2">
                            <label className={labelCls}>Observaciones</label>
                            <textarea value={observations} onChange={e => setObservations(e.target.value)} className={`${inputCls} min-h-[80px] resize-y`} placeholder="Notas internas del pedido…" />
                        </div>
                    </div>
                </section>

                {/* Envío */}
                <section className="p-6">
                    <h2 className="text-sm font-semibold text-gray-900 mb-4">Entrega</h2>
                    <div className="flex gap-2 mb-4">
                        {(["pickup", "delivery"] as const).map(opt => (
                            <button key={opt} type="button" onClick={() => setShippingType(opt)}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${shippingType === opt ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"}`}>
                                {opt === "pickup" ? "Retiro en showroom" : "Envío a domicilio"}
                            </button>
                        ))}
                    </div>
                    {shippingType === "delivery" && (
                        <div>
                            <label className={labelCls}>Dirección de envío *</label>
                            <input type="text" value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} className={inputCls} placeholder="Calle, número, piso, depto, ciudad…" />
                        </div>
                    )}
                </section>

                {/* Ítems */}
                <section className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-sm font-semibold text-gray-900">Ítems</h2>
                        <button type="button" onClick={addItem} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                            <Plus size={13} /> Agregar ítem
                        </button>
                    </div>
                    <div className="space-y-2">
                        {items.length === 0 && <p className="text-sm text-gray-400 italic">Sin ítems.</p>}
                        {items.map(item => {
                            const onQuoteInput = async (raw: string) => {
                                updateItem(item.id, "quote_url", raw);
                                const id = parseQuoteId(raw);
                                updateItem(item.id, "quote_id", id);
                                if (id) {
                                    updateItem(item.id, "woo_product_id", null);
                                    updateItem(item.id, "image_url", null);
                                }
                                if (!id) return;
                                const { data, error } = await supabase
                                    .from("quotes")
                                    .select("total_price_ars, configuration")
                                    .eq("id", id)
                                    .maybeSingle();
                                if (error || !data) return;
                                const price = Number(data.total_price_ars) || 0;
                                if (price > 0) updateItem(item.id, "unit_price", price);
                                // Screenshot 3D de la cotización. Solo existe en las quotes
                                // creadas desde que el configurador captura el canvas.
                                const snapshot = (data.configuration as { image_url?: string } | null)?.image_url;
                                if (snapshot) updateItem(item.id, "image_url", snapshot);
                                setItems(prev => prev.map(p =>
                                    p.id === item.id && !p.description.trim()
                                        ? { ...p, description: `Configuración Tubular ${id.slice(0, 6)}` }
                                        : p
                                ));
                            };
                            return (
                                <div key={item.id} className="flex gap-3 items-start bg-gray-50 p-3 rounded-md border border-gray-100">
                                    <div className="flex-1 space-y-2">
                                        {/* Elegir del catálogo de WooCommerce (alternativa al link de configurador) */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 shrink-0">Catálogo:</span>
                                            <select
                                                value={item.woo_product_id ?? ""}
                                                onChange={e => pickWooProduct(item.id, e.target.value ? Number(e.target.value) : null)}
                                                disabled={!!item.quote_id}
                                                className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                                                title={item.quote_id ? "Este ítem ya usa link de configurador" : "Elegir un producto del catálogo"}
                                            >
                                                <option value="">{wooProducts.length ? "— Elegir del catálogo… —" : "Cargando catálogo…"}</option>
                                                {wooProducts.map(w => (
                                                    <option key={w.id} value={w.id}>
                                                        {w.name}{w.category ? ` (${w.category})` : ""}{w.price ? ` · $${Math.round(w.price).toLocaleString("es-AR")}` : ""}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {/* Colores de estante/panel — variantes REALES del producto en WooCommerce
                                            (acero: 1 color; acrílico: superior/medio/inferior). Clave para el informe de piezas. */}
                                        {(() => {
                                            const prod = wooProducts.find(p => p.id === item.woo_product_id);
                                            const attrs = prod?.variationAttributes || [];
                                            if (!item.woo_product_id || attrs.length === 0) return null;
                                            return (
                                                <div className="space-y-1.5">
                                                    {attrs.map(attr => (
                                                        <div key={attr.name} className="flex items-center gap-2">
                                                            <span className="text-xs text-gray-500 shrink-0 w-24 truncate" title={attr.name}>{attr.name}:</span>
                                                            <select
                                                                value={item.colorSel?.[attr.name] ?? ""}
                                                                onChange={e => setItemColorAttr(item.id, attr.name, e.target.value)}
                                                                className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                            >
                                                                <option value="">— Elegir… —</option>
                                                                {attr.options.map(c => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                        <input type="text" value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)} placeholder="Nombre del producto…" className="w-full border-b border-gray-200 focus:border-indigo-500 py-1.5 outline-none text-sm bg-transparent" />
                                        <div className="flex gap-4 flex-wrap">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500">Cant:</span>
                                                <input type="number" min="1" value={item.quantity} onChange={e => updateItem(item.id, "quantity", parseInt(e.target.value) || 0)} className="w-16 border border-gray-200 rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500">P. unit:</span>
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                                                    <input type="number" min="0" value={item.unit_price} onChange={e => updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)} className="w-28 border border-gray-200 rounded-md pl-5 pr-2 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 pt-1">
                                            <span className="text-xs text-gray-500 shrink-0">Link configurador:</span>
                                            <input
                                                type="text"
                                                value={item.quote_url || (item.quote_id ? `/configurador/?quote=${item.quote_id}` : "")}
                                                onChange={e => onQuoteInput(e.target.value)}
                                                placeholder="Pegá el link de la cotización (opcional)"
                                                className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                            />
                                            {item.quote_id && (
                                                <span className="text-[10px] font-medium text-emerald-600 shrink-0" title={`Cotización ${item.quote_id}`}>✓ vinculada</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end justify-between h-full gap-2">
                                        <button type="button" onClick={() => removeItem(item.id)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors" title="Eliminar">
                                            <Trash2 size={14} />
                                        </button>
                                        <div className="text-sm font-semibold text-gray-900 tabular-nums">${(item.quantity * item.unit_price).toLocaleString("es-AR")}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Pago + totales */}
                <section className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-5">
                        <h2 className="text-sm font-semibold text-gray-900">Pago</h2>

                        <div>
                            <label className={labelCls}>Medio de pago</label>
                            <div className="space-y-1.5">
                                {(Object.keys(PAYMENT_DISCOUNT) as PaymentMethod[]).map(opt => (
                                    <button key={opt} type="button" onClick={() => setPaymentMethod(opt)}
                                        className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${paymentMethod === opt ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"}`}>
                                        {PAYMENT_LABEL[opt]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>Descuento adicional (%)</label>
                            <input type="number" min="0" max="100" step="0.5" value={extraDiscount} onChange={e => setExtraDiscount(parseFloat(e.target.value) || 0)} className={inputCls} />
                        </div>

                        <div>
                            <label className={labelCls}>Estado de pago</label>
                            <div className="flex gap-2">
                                {(["pending", "partial", "paid"] as const).map(opt => {
                                    const labels = { pending: "Pendiente", partial: "Seña", paid: "Pagado" } as const;
                                    const activeCls = opt === "paid"
                                        ? "bg-emerald-600 text-white"
                                        : opt === "partial"
                                            ? "bg-indigo-600 text-white"
                                            : "bg-amber-500 text-white";
                                    return (
                                        <button key={opt} type="button" onClick={() => setStatus(opt)}
                                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${status === opt ? activeCls : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"}`}>
                                            {labels[opt]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {status === "partial" && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                                <label className={labelCls}>Monto de seña</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={senaAmount}
                                        onChange={e => setSenaAmount(parseFloat(e.target.value) || 0)}
                                        className={inputCls + " pl-7 tabular-nums"}
                                        placeholder="Ej: 50000"
                                    />
                                </div>
                                {senaAmount > 0 && finalAmount > 0 && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        Saldo restante: <span className="font-semibold text-gray-900 tabular-nums">${remaining.toLocaleString("es-AR")}</span>
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Caja donde entra el pago (obligatoria si hay seña o cobro) */}
                        {status !== "pending" && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                                <label className={labelCls}>Caja donde entra el pago *</label>
                                <select
                                    value={cashBoxId}
                                    onChange={e => { setCashBoxId(e.target.value); setBoxAmountOverride(""); }}
                                    className={inputCls}
                                >
                                    <option value="">— Elegir caja… —</option>
                                    {cashBoxes.map(b => (
                                        <option key={b.id} value={b.id}>{b.name} ({b.currency})</option>
                                    ))}
                                    <option value="none">No ingresar a ninguna caja (lo cargo después)</option>
                                </select>
                                {computedPaidAmount > 0 && cashBoxId === "none" && (
                                    <p className="text-xs text-amber-600 mt-2">
                                        No se registra en ninguna caja — lo cargás manual después.
                                    </p>
                                )}
                                {computedPaidAmount > 0 && selectedBox && (
                                    <div className="mt-3 space-y-2">
                                        {selectedBox.currency !== "ARS" && (
                                            <>
                                                <label className={labelCls}>
                                                    Monto en {selectedBox.currency} que entra a {selectedBox.name}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={boxAmountOverride === "" ? String(convertedBoxAmount) : boxAmountOverride}
                                                    onChange={e => setBoxAmountOverride(e.target.value)}
                                                    className={inputCls + " tabular-nums"}
                                                />
                                                <p className="text-xs text-gray-500">
                                                    Pedido en ARS ${Math.round(computedPaidAmount).toLocaleString("es-AR")}
                                                    {" · "}TC {usdRate.toLocaleString("es-AR")}
                                                    {" → "}sugerido {fmtBox(convertedBoxAmount, selectedBox.currency)}. Podés ajustar si cobraste otro dólar.
                                                </p>
                                            </>
                                        )}
                                        {selectedBox.currency === "ARS" && (
                                            <p className="text-xs text-gray-500">
                                                Entra <span className="font-semibold text-emerald-700 tabular-nums">{fmtBox(boxAmountToPost, "ARS")}</span> a {selectedBox.name}.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-5 space-y-3 self-start">
                        <div className="flex justify-between text-sm text-gray-700">
                            <span className="text-gray-500">Subtotal</span>
                            <span className="tabular-nums">${subtotal.toLocaleString("es-AR")}</span>
                        </div>
                        {paymentDiscountPercent > 0 && (
                            <div className="flex justify-between text-sm text-gray-700">
                                <span className="text-gray-500">{PAYMENT_LABEL[paymentMethod]}</span>
                                <span className="text-indigo-600 tabular-nums">−${paymentDiscountAmount.toLocaleString("es-AR")}</span>
                            </div>
                        )}
                        {extraDiscount > 0 && (
                            <div className="flex justify-between text-sm text-gray-700">
                                <span className="text-gray-500">Descuento adicional ({extraDiscount}%)</span>
                                <span className="text-indigo-600 tabular-nums">−${extraDiscountAmount.toLocaleString("es-AR")}</span>
                            </div>
                        )}
                        <div className="pt-3 border-t border-gray-200 flex justify-between items-end">
                            <span className="text-sm font-medium text-gray-900">Total final</span>
                            <span className="text-2xl font-semibold text-gray-900 tabular-nums leading-none">${finalAmount.toLocaleString("es-AR")}</span>
                        </div>
                        {status === "partial" && senaAmount > 0 && (
                            <div className="pt-2 mt-2 border-t border-gray-200 space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-indigo-600">Seña pagada</span>
                                    <span className="text-indigo-600 tabular-nums">${computedPaidAmount.toLocaleString("es-AR")}</span>
                                </div>
                                <div className="flex justify-between text-sm font-semibold">
                                    <span className="text-gray-900">Saldo</span>
                                    <span className="text-gray-900 tabular-nums">${remaining.toLocaleString("es-AR")}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <div className="flex justify-end pt-6">
                <button onClick={handleSave} disabled={loading} className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    {loading ? "Guardando…" : mode === "create" ? "Guardar pedido" : "Guardar cambios"}
                </button>
            </div>
        </>
    );
}
