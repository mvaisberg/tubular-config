"use client";

// Analizador de rentabilidad por canal (solo admins — vive en /admin/parts).
// Pegás un link del configurador (?config= o ?quote=) o un SKU de producto y
// muestra, para lista facturada y efectivo: costos, fees, impuestos y ganancia.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculatePricing, type Settings } from "@/lib/pricing";
import { analyzeChannels, creditableFraction, type ProfitComparison } from "@/lib/channel-profit";
import type { ModuleConfig } from "@/lib/types";
import { Search, Loader2, Wallet, CreditCard } from "lucide-react";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const pct = (n: number) => (n * 100).toFixed(1) + "%";

interface PartRow { sku: string; name: string; qty: number; total: number; creditable: number }

export default function ProfitAnalyzer({ partsData, settings }: { partsData: unknown[]; settings: Settings }) {
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ProfitComparison | null>(null);
    const [bomRows, setBomRows] = useState<PartRow[]>([]);
    const [label, setLabel] = useState("");
    const [showBom, setShowBom] = useState(false);
    const supabase = createClient();

    const resolve = async (raw: string): Promise<{ modules: ModuleConfig[]; hasWheels: boolean; label: string }> => {
        const arg = raw.trim();
        // Link con ?config=
        try {
            const u = new URL(arg);
            const c = u.searchParams.get("config");
            if (c) {
                const json = JSON.parse(atob(c));
                const modules = Array.isArray(json) ? json : json.modules;
                return { modules, hasWheels: Boolean(json.hasWheels), label: "Configuración del link" };
            }
            const q = u.searchParams.get("quote");
            if (q) {
                let { data } = await supabase.from("quotes").select("configuration").eq("id", q).maybeSingle();
                if (!data) ({ data } = await supabase.from("preconfigured_products").select("configuration").eq("id", q).maybeSingle());
                const cfg = (data as { configuration?: unknown })?.configuration as { modules?: ModuleConfig[]; hasWheels?: boolean } | ModuleConfig[] | undefined;
                if (!cfg) throw new Error("No encontré esa cotización");
                const modules = Array.isArray(cfg) ? cfg : cfg.modules ?? [];
                return { modules, hasWheels: !Array.isArray(cfg) && Boolean(cfg.hasWheels), label: `Cotización ${q.slice(0, 8)}` };
            }
        } catch (e) {
            if ((e as Error).message.includes("cotización")) throw e;
            /* no era URL: probar SKU */
        }
        const { data } = await supabase.from("preconfigured_products").select("name, configuration").eq("sku", arg.toUpperCase()).maybeSingle();
        if (data) {
            const cfg = data.configuration as { modules?: ModuleConfig[]; hasWheels?: boolean } | ModuleConfig[];
            const modules = Array.isArray(cfg) ? cfg : cfg.modules ?? [];
            return { modules, hasWheels: !Array.isArray(cfg) && Boolean(cfg.hasWheels), label: data.name as string };
        }
        throw new Error("Pegá un link del configurador (?config= o ?quote=) o un SKU (ej. ST-201)");
    };

    const analyze = async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const { modules, hasWheels, label: lbl } = await resolve(input);
            if (!modules?.length) throw new Error("La configuración no tiene módulos");
            const pricing = calculatePricing(modules, partsData as never[], settings, hasWheels);
            setResult(analyzeChannels(pricing, settings));
            setBomRows(Object.entries(pricing.bomSummary).map(([sku, it]) => ({
                sku, name: it.name, qty: it.quantity, total: it.totalCostARS, creditable: creditableFraction(sku),
            })).sort((a, b) => b.total - a.total));
            setLabel(lbl);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-900">Análisis de rentabilidad por canal</h2>
            <p className="text-xs text-gray-500 mt-0.5 mb-3">
                Pegá un link del configurador (compartir o cotización) o un SKU. Muestra el neto real de una venta
                facturada a lista vs efectivo/transferencia.
            </p>
            <div className="flex gap-2">
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && analyze()}
                    placeholder="https://tubular.com.ar/configurador?config=…  ·  o un SKU: ST-201"
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
                <button
                    onClick={analyze}
                    disabled={loading || !input.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                    Analizar
                </button>
            </div>
            {error && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

            {result && (
                <div className="mt-4">
                    <div className="text-sm font-medium text-gray-700 mb-3">{label}</div>
                    <div className="grid md:grid-cols-2 gap-4">
                        {/* LISTA */}
                        <div className="border border-gray-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <CreditCard size={16} className="text-indigo-600" />
                                <span className="text-sm font-semibold text-gray-900">Lista facturada (6 cuotas)</span>
                            </div>
                            <Row label="Precio de venta" value={fmt(result.lista.price)} bold />
                            <Row label={`Fees tarjeta + cuotas (neto ${fmt(result.lista.feesNet)} + IVA ${fmt(result.lista.feesIva)})`} value={"−" + fmt(result.lista.fees)} />
                            <Row label={`IVA débito ${fmt(result.lista.ivaDebit)} − créd. compras ${fmt(result.lista.ivaCreditPurchases)} − créd. fees ${fmt(result.lista.ivaCreditFees)}`} value={"−" + fmt(result.lista.ivaToPay)} />
                            <Row label="IIBB 3,5% sobre neto" value={"−" + fmt(result.lista.iibb)} />
                            <Row label="Materiales" value={"−" + fmt(result.lista.materials)} />
                            <Row label="Envío" value={"−" + fmt(result.lista.shipping)} />
                            <div className="border-t border-gray-200 mt-2 pt-2">
                                <Row label="TE QUEDA" value={`${fmt(result.lista.profit)}  (${pct(result.lista.profitPct)} de la venta)`} bold accent="text-indigo-700" />
                            </div>
                        </div>
                        {/* EFECTIVO */}
                        <div className="border border-gray-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Wallet size={16} className="text-emerald-600" />
                                <span className="text-sm font-semibold text-gray-900">Efectivo / transferencia (20% off)</span>
                            </div>
                            <Row label="Precio de venta" value={fmt(result.efectivo.price)} bold />
                            <Row label="Fees" value="—" />
                            <Row label="IVA" value="—" />
                            <Row label="IIBB" value="—" />
                            <Row label="Materiales" value={"−" + fmt(result.efectivo.materials)} />
                            <Row label="Envío" value={"−" + fmt(result.efectivo.shipping)} />
                            <div className="border-t border-gray-200 mt-2 pt-2">
                                <Row label="TE QUEDA" value={`${fmt(result.efectivo.profit)}  (${pct(result.efectivo.profitPct)} de la venta)`} bold accent="text-emerald-700" />
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        Diferencia de ganancia entre canales:{" "}
                        <span className={`font-semibold ${result.lista.profit >= result.efectivo.profit ? "text-indigo-700" : "text-red-600"}`}>
                            {fmt(result.lista.profit - result.efectivo.profit)}
                        </span>{" "}
                        {result.lista.profit < result.efectivo.profit ? "(la venta facturada deja menos)" : "(la venta facturada deja más)"}
                    </div>

                    <button onClick={() => setShowBom(!showBom)} className="mt-3 text-xs font-medium text-gray-500 hover:text-gray-800">
                        {showBom ? "▾ Ocultar despiece" : "▸ Ver despiece y crédito fiscal por pieza"}
                    </button>
                    {showBom && (
                        <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="text-left px-3 py-1.5">Pieza</th>
                                        <th className="text-right px-3 py-1.5">Cant.</th>
                                        <th className="text-right px-3 py-1.5">Costo</th>
                                        <th className="text-right px-3 py-1.5">Con factura</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bomRows.map(r => (
                                        <tr key={r.sku} className="border-t border-gray-100">
                                            <td className="px-3 py-1">{r.name}</td>
                                            <td className="px-3 py-1 text-right">{r.qty}</td>
                                            <td className="px-3 py-1 text-right">{fmt(r.total)}</td>
                                            <td className="px-3 py-1 text-right text-gray-500">{r.creditable ? (r.creditable * 100) + "%" : "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <p className="mt-2 text-[11px] text-gray-400">
                        Supuestos: RI · IVA de los fees tomado como crédito · IIBB 3,5% sobre el neto sin IVA · con factura:
                        acrílicos 100%, caños 25%, bolas/soportes/conectores 50%.
                    </p>
                </div>
            )}
        </div>
    );
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: string }) {
    return (
        <div className="flex justify-between gap-3 py-0.5">
            <span className={`text-xs ${bold ? "font-semibold text-gray-800" : "text-gray-500"}`}>{label}</span>
            <span className={`text-xs tabular-nums whitespace-nowrap ${bold ? "font-bold" : "text-gray-700"} ${accent ?? ""}`}>{value}</span>
        </div>
    );
}
