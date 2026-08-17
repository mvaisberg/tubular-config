"use client";

import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink, Package, Tag, Trash2, Link2, Save } from "lucide-react";
import { calculatePricing, Settings } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/client";

interface WooProductOption { id: number; name: string; sku: string; type: string; category: string; }

interface ProductsTableProps {
    initialProducts: any[];
    partsData: any[];
    settings: Settings;
}

export default function ProductsTable({ initialProducts, partsData, settings }: ProductsTableProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [products, setProducts] = useState<any[]>(initialProducts);
    const [wooProducts, setWooProducts] = useState<WooProductOption[]>([]);
    const [wooLoading, setWooLoading] = useState(false);
    const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
    const [savingLink, setSavingLink] = useState<string | null>(null);
    const supabase = createClient();

    // Actualiza la configuración de un producto desde un link del configurador.
    // Acepta un link con ?config=<base64> (link compartible/exportado) o
    // ?quote=<uuid> (link que genera "Guardar" en el configurador), o el UUID/base64 pelado.
    const updateConfigFromLink = async (productId: string, raw: string) => {
        const link = raw.trim();
        if (!link) return;
        setSavingLink(productId);
        try {
            let modules: any[] | null = null;
            let hasWheels = false;

            const configMatch = link.match(/[?&]config=([^&\s]+)/);
            const quoteMatch = link.match(/[?&]quote=([0-9a-fA-F-]{8,})/);

            if (configMatch) {
                const json = JSON.parse(atob(decodeURIComponent(configMatch[1])));
                modules = Array.isArray(json) ? json : (json.modules || json.configuration);
                hasWheels = !!(json.hasWheels ?? json.has_wheels);
            } else if (quoteMatch || /^[0-9a-fA-F-]{8,}$/.test(link)) {
                // Buscar por id en quotes y, si no está, en preconfigured_products.
                const id = quoteMatch ? quoteMatch[1] : link;
                let cfg: any = null;
                const q = await supabase.from("quotes").select("configuration").eq("id", id).maybeSingle();
                cfg = q.data?.configuration;
                if (!cfg) {
                    const pp = await supabase.from("preconfigured_products").select("configuration").eq("id", id).maybeSingle();
                    cfg = pp.data?.configuration;
                }
                if (cfg) {
                    modules = Array.isArray(cfg) ? cfg : (cfg.modules || cfg.configuration);
                    hasWheels = !!(cfg.hasWheels ?? cfg.has_wheels);
                }
            } else {
                // Último intento: base64 pelado.
                try {
                    const json = JSON.parse(atob(decodeURIComponent(link)));
                    modules = Array.isArray(json) ? json : (json.modules || json.configuration);
                    hasWheels = !!(json.hasWheels ?? json.has_wheels);
                } catch { /* ignore */ }
            }

            if (!Array.isArray(modules) || modules.length === 0) {
                alert("No pude extraer una configuración válida de ese link. Pegá un link del configurador (?quote=… o ?config=…).");
                return;
            }

            const configuration = { modules, hasWheels };
            const { error } = await supabase
                .from("preconfigured_products")
                .update({ configuration })
                .eq("id", productId);
            if (error) { alert("Error al actualizar: " + error.message); return; }

            setProducts(ps => ps.map(p => p.id === productId ? { ...p, configuration } : p));
            setLinkDrafts(d => ({ ...d, [productId]: "" }));
        } finally {
            setSavingLink(null);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    // Cargar la lista de productos de Woo una vez (para el selector de vínculo).
    useEffect(() => {
        setWooLoading(true);
        fetch("/configurador/api/woocommerce/products")
            .then(r => r.json())
            .then(d => { if (Array.isArray(d.products)) setWooProducts(d.products); })
            .catch(() => {})
            .finally(() => setWooLoading(false));
    }, []);

    const assignWoo = async (productId: string, wooId: number | null) => {
        setProducts(ps => ps.map(p => p.id === productId ? { ...p, woo_product_id: wooId } : p));
        const { error } = await supabase
            .from("preconfigured_products")
            .update({ woo_product_id: wooId })
            .eq("id", productId);
        if (error) alert("Error al vincular: " + error.message);
    };

    const productDetails = useMemo(() => {
        return products.map(product => {
            const config = product.configuration || [];
            // Assuming configuration is the array of modules
            const modules = Array.isArray(config) ? config : (config.modules || []);
            const pricing = calculatePricing(modules, partsData, settings);
            return {
                ...product,
                pricing,
                modules
            };
        });
    }, [products, partsData, settings]);

    return (
        <div className="overflow-x-auto bg-white border border-gray-200 shadow-sm">
            <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-black">
                    <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-semibold text-white tracking-normal">Nombre / SKU</th>
                        <th className="px-6 py-4 text-left text-[10px] font-semibold text-white tracking-normal">Módulos</th>
                        <th className="px-6 py-4 text-right text-[10px] font-semibold text-white tracking-normal">Costo Act.</th>
                        <th className="px-6 py-4 text-right text-[10px] font-semibold text-white tracking-normal opacity-80">PVP Lista</th>
                        <th className="px-6 py-4 text-right text-[10px] font-semibold text-blue-200 tracking-normal bg-white/10">Efectivo/Transf. (-20%)</th>
                        <th className="px-6 py-4 text-right text-[10px] font-semibold text-white tracking-normal w-32">Acciones</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                    {productDetails.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-xs font-bold tracking-normal">
                                NO HAY PRODUCTOS PRECONFIGURADOS AÚN.
                            </td>
                        </tr>
                    )}
                    {productDetails.map((product) => {
                        const isExpanded = expandedId === product.id;
                        const { pricing } = product;
                        const bomItems = Object.values(pricing.bomSummary);

                        return (
                            <div key={product.id} className="contents group">
                                <tr className={`hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-gray-50' : ''}`}>
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <div className="text-sm font-semibold text-gray-900">{product.name}</div>
                                        <div className="text-[10px] font-bold text-gray-500 tracking-normal mt-1">
                                            {product.sku || product.id.split('-')[0]}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <span className="bg-gray-900 text-white px-2 py-1 text-[10px] font-semibold tracking-normal border border-gray-200 shadow-sm">
                                            {product.modules.length} MÓDULOS
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-xs text-right font-bold text-gray-500">
                                        ${Math.round(pricing.totalCost).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-xs text-right font-bold text-gray-400 line-through">
                                        ${Math.round(pricing.totalPrice).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-sm text-right font-semibold text-white bg-indigo-600 border-l border-r border-gray-200">
                                        ${Math.round(pricing.totalPrice * 0.8).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-right align-middle">
                                        <div className="flex justify-end gap-2 items-center">
                                            <button
                                                onClick={() => toggleExpand(product.id)}
                                                className={`p-2 border transition-colors ${isExpanded ? 'bg-gray-900 text-white border-gray-200' : 'text-gray-900 border-transparent hover:border-gray-300'}`}
                                            >
                                                {isExpanded ? <ChevronUp size={16} strokeWidth={2.5} /> : <ChevronDown size={16} strokeWidth={2.5} />}
                                            </button>
                                            <Link
                                                href={`/?quote=${product.id}&admin=true`}
                                                target="_blank"
                                                className="p-2 text-gray-900 border border-transparent hover:border-gray-300 hover:text-indigo-600 transition-colors"
                                            >
                                                <ExternalLink size={16} strokeWidth={2.5} />
                                            </Link>
                                            <button
                                                className="p-2 text-gray-300 border border-transparent hover:border-red-600 hover:text-red-600 transition-colors"
                                                onClick={() => {/* TODO: Delete logic */ }}
                                            >
                                                <Trash2 size={16} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr>
                                        <td colSpan={6} className="p-0 border-b border-gray-200">
                                            <div className="bg-white p-8 lg:p-12 shadow-inner border-t border-gray-200">
                                                {/* Vínculo con producto de catálogo (WooCommerce) */}
                                                <div className="mb-10 p-4 border border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center gap-3">
                                                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 shrink-0">
                                                        <Link2 size={16} strokeWidth={2.5} /> Producto de catálogo vinculado
                                                    </div>
                                                    <select
                                                        value={product.woo_product_id ?? ""}
                                                        onChange={e => assignWoo(product.id, e.target.value ? Number(e.target.value) : null)}
                                                        disabled={wooLoading}
                                                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                                                    >
                                                        <option value="">{wooLoading ? "Cargando productos…" : "— Sin vincular —"}</option>
                                                        {wooProducts.map(w => (
                                                            <option key={w.id} value={w.id}>
                                                                {w.name}{w.sku ? ` · ${w.sku}` : ""}{w.category ? ` (${w.category})` : ""}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {product.woo_product_id && (
                                                        <span className="text-[11px] text-emerald-600 font-semibold shrink-0">Vinculado ✓</span>
                                                    )}
                                                </div>

                                                {/* Corregir la configuración pegando un link del configurador */}
                                                <div className="mb-10 p-4 border border-gray-200 bg-gray-50">
                                                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                                                        <ExternalLink size={16} strokeWidth={2.5} /> Corregir configuración
                                                    </div>
                                                    <p className="text-[11px] text-gray-500 mb-3">
                                                        1) Abrí la config actual con el botón <ExternalLink size={11} className="inline" /> de arriba, corregila en el configurador y tocá <b>Guardar</b>.
                                                        2) Copiá el link que te da y pegalo acá para reemplazar la configuración de este producto.
                                                    </p>
                                                    <div className="flex flex-col sm:flex-row gap-2">
                                                        <input
                                                            type="text"
                                                            value={linkDrafts[product.id] ?? ""}
                                                            onChange={e => setLinkDrafts(d => ({ ...d, [product.id]: e.target.value }))}
                                                            placeholder="Pegá el link del configurador (?quote=… o ?config=…)"
                                                            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        />
                                                        <button
                                                            onClick={() => updateConfigFromLink(product.id, linkDrafts[product.id] ?? "")}
                                                            disabled={savingLink === product.id || !(linkDrafts[product.id] ?? "").trim()}
                                                            className="flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2 text-sm font-semibold hover:bg-indigo-600 transition-colors disabled:opacity-40 shrink-0"
                                                        >
                                                            <Save size={15} strokeWidth={2.5} />
                                                            {savingLink === product.id ? "Actualizando…" : "Actualizar config"}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                                                    <div className="bg-gray-900 text-white p-6 border border-gray-200 shadow-sm">
                                                        <span className="text-[10px] font-semibold text-white/50 tracking-normal block mb-2 border-b border-white/20 pb-2">ROAS Break-Even</span>
                                                        <span className="text-3xl font-semibold">{pricing.metrics.roasBreakEven.toFixed(2)}</span>
                                                    </div>
                                                    <div className="bg-indigo-600 text-white p-6 border border-gray-200 shadow-sm">
                                                        <span className="text-[10px] font-semibold text-white/50 tracking-normal block mb-2 border-b border-white/20 pb-2">ROAS Target (70%)</span>
                                                        <span className="text-3xl font-semibold">{pricing.metrics.roasTarget.toFixed(2)}</span>
                                                    </div>
                                                    <div className="bg-white p-6 border border-gray-200 shadow-sm">
                                                        <span className="text-[10px] font-semibold text-gray-500 tracking-normal block mb-2 border-b border-gray-200/20 pb-2">Utilidad Bruta</span>
                                                        <span className="text-2xl font-semibold">${Math.round(pricing.metrics.grossProfit).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                                    </div>
                                                    <div className="bg-white p-6 border border-gray-200 shadow-sm">
                                                        <span className="text-[10px] font-semibold text-gray-500 tracking-normal block mb-2 border-b border-gray-200/20 pb-2">Recaudación Real</span>
                                                        <span className="text-2xl font-semibold text-indigo-600">${Math.round(pricing.metrics.realRevenue).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                                    </div>
                                                </div>

                                                {/* Cómo se calcula el precio: costo → margen → envío → fees → PVP */}
                                                {(() => {
                                                    const b = pricing.breakdown;
                                                    const money = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
                                                    const rows = [
                                                        { label: "Costo de materiales (BOM)", detail: "Suma de todas las piezas", value: money(b.productCost), strong: false },
                                                        { label: `Margen aplicado (${b.marginPercent}%)`, detail: `Costo ÷ (1 − ${b.marginPercent}%)`, value: money(b.basePrice - b.productCost), strong: false, op: "+" },
                                                        { label: "Precio base", detail: "Con margen, sin fees", value: money(b.basePrice), strong: true, sub: true },
                                                        ...(b.shippingCost > 0 ? [{ label: "Envío", detail: "Costo fijo sumado", value: money(b.shippingCost), strong: false, op: "+" }] : []),
                                                        { label: `Fees financieros (${b.feePercent.toFixed(1)}%)`, detail: `Transacción ${b.transactionFeePercent.toFixed(1)}% + cuotas ${b.installmentFeePercent.toFixed(1)}% (c/IVA)`, value: money(b.finalPrice - b.pricePlusShipping), strong: false, op: "+" },
                                                    ];
                                                    return (
                                                        <div className="mb-12">
                                                            <div className="flex items-center gap-3 mb-6 border-b border-gray-200 pb-2">
                                                                <h4 className="text-lg font-semibold text-gray-900 tracking-tight">CÓMO SE CALCULA EL PRECIO</h4>
                                                            </div>
                                                            <div className="max-w-xl space-y-0 border border-gray-200">
                                                                {rows.map((r, i) => (
                                                                    <div key={i} className={`flex justify-between items-center px-4 py-3 border-b border-gray-100 ${r.sub ? "bg-gray-50" : "bg-white"}`}>
                                                                        <div className="flex flex-col">
                                                                            <span className={`text-sm ${r.strong ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                                                                                {r.op && <span className="text-gray-400 mr-1">{r.op}</span>}{r.label}
                                                                            </span>
                                                                            <span className="text-[10px] text-gray-400">{r.detail}</span>
                                                                        </div>
                                                                        <span className={`text-sm tabular-nums ${r.strong ? "font-bold text-gray-900" : "font-semibold text-gray-600"}`}>{r.value}</span>
                                                                    </div>
                                                                ))}
                                                                <div className="flex justify-between items-center px-4 py-4 bg-indigo-600 text-white">
                                                                    <span className="text-sm font-bold">PRECIO FINAL (PVP Lista)</span>
                                                                    <span className="text-lg font-bold tabular-nums">{money(b.finalPrice)}</span>
                                                                </div>
                                                            </div>
                                                            <p className="text-[11px] text-gray-400 mt-2 max-w-xl">
                                                                El margen y los fees se aplican como divisores (precio = base ÷ (1 − %)), no como suma directa, para que el % quede sobre el precio final. Editá los porcentajes en Settings.
                                                            </p>
                                                        </div>
                                                    );
                                                })()}

                                                <div className="flex justify-between items-end mb-6 border-b border-gray-200 pb-2">
                                                    <h4 className="text-lg font-semibold text-gray-900 tracking-tight flex items-center gap-3">
                                                        <Tag size={20} strokeWidth={2.5} /> DESGLOSE DE PARTES
                                                    </h4>
                                                    <div className="text-[10px] text-gray-500 font-bold tracking-normal hidden sm:block">
                                                        SINCRONIZADO CON COSTOS ACTUALES
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                    {bomItems.map((item: any, idx) => (
                                                        <div key={idx} className="flex justify-between items-center p-4 bg-white border border-gray-200 hover:bg-gray-50 transition-colors group/item">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-semibold text-gray-900 group-hover/item:text-indigo-600 transition-colors">{item.name}</span>
                                                                <span className="text-[10px] font-bold text-gray-500">${Math.round(item.unitCostARS).toLocaleString('es-AR', { maximumFractionDigits: 0 })} C/U</span>
                                                            </div>
                                                            <div className="text-right flex flex-col items-end">
                                                                <div className="text-[10px] font-semibold bg-gray-900 text-white px-2 py-0.5 mb-1">x{item.quantity}</div>
                                                                <div className="text-sm font-semibold text-gray-900">${Math.round(item.totalCostARS).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </div>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
