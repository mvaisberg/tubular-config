"use client";

// Cuadro de resultados por período (solo admin — vive en /admin/parts).
// Ventas reales → costos variables (materiales + carga por canal) → margen de
// contribución → costos fijos (precargados de la estructura, editables acá
// como simulación) → resultado del período.

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

interface PnL {
    orders: number;
    revenue: number; revenueLista: number; revenueEfectivo: number;
    ordersLista: number; ordersEfectivo: number;
    materials: number; feesCard: number; cashFee: number; ivaToPay: number; iibb: number;
    estimatedItems: number; resolvedItems: number;
    variableTotal: number; contribution: number;
    fixedCosts: { id: string; name: string; amount: number }[];
    detail: {
        order_number: string | null; date: string; client: string | null; source: string;
        channel: string; payment: string | null; status: string; amount: number; materials: number;
    }[];
}

const STATUS_LABELS: Record<string, string> = {
    pending: "Pendiente", partial: "Seña", paid: "Pagado", completed: "Completado",
};

interface FixedRow { id: string; name: string; amount: number; enabled: boolean }

const iso = (d: Date) => d.toISOString().slice(0, 10);

function presetRange(key: string): [string, string] {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    switch (key) {
        case "mes": return [iso(new Date(y, m, 1)), iso(now)];
        case "mes_pasado": return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
        case "3meses": return [iso(new Date(y, m - 2, 1)), iso(now)];
        case "anio": return [iso(new Date(y, 0, 1)), iso(now)];
        default: return [iso(new Date(y, m, 1)), iso(now)];
    }
}

export default function PnLReport() {
    const [preset, setPreset] = useState("mes");
    const [[from, to], setRange] = useState<[string, string]>(presetRange("mes"));
    const [data, setData] = useState<PnL | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fixedRows, setFixedRows] = useState<FixedRow[]>([]);
    const [fixedLoaded, setFixedLoaded] = useState(false);
    const [showDetail, setShowDetail] = useState(false);

    const load = async (f: string, t: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/configurador/api/reports/pnl?from=${f}&to=${t}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setData(json);
            if (!fixedLoaded) {
                setFixedRows((json.fixedCosts as PnL["fixedCosts"]).map(c => ({ ...c, amount: Number(c.amount), enabled: true })));
                setFixedLoaded(true);
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(from, to); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    const applyPreset = (key: string) => {
        setPreset(key);
        const r = presetRange(key);
        setRange(r);
        load(r[0], r[1]);
    };

    // Los fijos son mensuales: se prorratean por la duración del período.
    const months = useMemo(() => {
        const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000 + 1;
        return Math.max(days / 30.44, 0.03);
    }, [from, to]);

    const fixedMonthly = fixedRows.filter(r => r.enabled).reduce((a, r) => a + (r.amount || 0), 0);
    const fixedPeriod = fixedMonthly * months;
    const result = (data?.contribution ?? 0) - fixedPeriod;

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            {/* Período */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                {[["mes", "Este mes"], ["mes_pasado", "Mes pasado"], ["3meses", "Últimos 3 meses"], ["anio", "Este año"]].map(([k, l]) => (
                    <button
                        key={k}
                        onClick={() => applyPreset(k)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${preset === k ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    >
                        {l}
                    </button>
                ))}
                <div className="flex items-center gap-1.5 ml-2 text-xs text-gray-500">
                    <input type="date" value={from} onChange={e => { setPreset(""); setRange([e.target.value, to]); }} className="border border-gray-200 rounded-md px-2 py-1" />
                    →
                    <input type="date" value={to} onChange={e => { setPreset(""); setRange([from, e.target.value]); }} className="border border-gray-200 rounded-md px-2 py-1" />
                    <button onClick={() => load(from, to)} className="px-2.5 py-1 bg-gray-900 text-white rounded-md font-medium">Aplicar</button>
                </div>
                {loading && <Loader2 size={15} className="animate-spin text-gray-400" />}
            </div>

            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</div>}

            {data && (
                <div className="max-w-2xl">
                    <div className="flex items-center gap-2">
                        <div className="flex-1">
                            <Row label={`VENTAS TOTALES  (${data.orders} ventas: ${data.ordersLista} lista / ${data.ordersEfectivo} efectivo)`} value={fmt(data.revenue)} bold big />
                        </div>
                        <button
                            onClick={() => setShowDetail(s => !s)}
                            className="shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                        >
                            {showDetail ? "Ocultar operaciones" : `Ver operaciones (${data.detail?.length ?? 0})`}
                        </button>
                    </div>

                    {showDetail && (
                        <div className="my-2 border border-gray-200 rounded-lg overflow-x-auto">
                            <table className="w-full text-[11px]">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-500 text-left">
                                        <th className="px-2 py-1.5 font-medium">Pedido</th>
                                        <th className="px-2 py-1.5 font-medium">Fecha</th>
                                        <th className="px-2 py-1.5 font-medium">Cliente</th>
                                        <th className="px-2 py-1.5 font-medium">Origen</th>
                                        <th className="px-2 py-1.5 font-medium">Canal</th>
                                        <th className="px-2 py-1.5 font-medium">Estado</th>
                                        <th className="px-2 py-1.5 font-medium text-right">Importe</th>
                                        <th className="px-2 py-1.5 font-medium text-right">Materiales</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(data.detail || []).map((o, i) => (
                                        <tr key={i} className={o.amount <= 0 ? "bg-amber-50" : ""}>
                                            <td className="px-2 py-1 font-medium text-gray-800 whitespace-nowrap">{o.order_number || "—"}</td>
                                            <td className="px-2 py-1 text-gray-500 whitespace-nowrap">{o.date}</td>
                                            <td className="px-2 py-1 text-gray-700 max-w-[140px] truncate">{o.client || "—"}</td>
                                            <td className="px-2 py-1 text-gray-500">{o.source}</td>
                                            <td className="px-2 py-1 text-gray-500">{o.channel}{o.payment ? ` · ${o.payment}` : ""}</td>
                                            <td className="px-2 py-1 text-gray-500">{STATUS_LABELS[o.status] || o.status}</td>
                                            <td className="px-2 py-1 text-right tabular-nums font-medium">{fmt(o.amount)}</td>
                                            <td className="px-2 py-1 text-right tabular-nums text-gray-500">−{fmt(o.materials)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {(data.detail || []).some(o => o.amount <= 0) && (
                                <p className="px-2 py-1.5 text-[10px] text-amber-600 border-t border-gray-100">
                                    Los pedidos resaltados tienen importe $0 en el manager: se cuentan como operación pero no suman ventas. Cargales el importe en Pedidos para que impacten.
                                </p>
                            )}
                        </div>
                    )}
                    <div className="pl-3 border-l-2 border-gray-100 my-1">
                        <Row label="Materiales (BOM real de cada venta)" value={"−" + fmt(data.materials)} />
                        <Row label="Fees tarjeta + cuotas (ventas lista)" value={"−" + fmt(data.feesCard)} />
                        <Row label="IVA a pagar (débito − créditos)" value={"−" + fmt(data.ivaToPay)} />
                        <Row label="IIBB 3,5%" value={"−" + fmt(data.iibb)} />
                        <Row label="Comisión de cobro 3% (ventas efectivo)" value={"−" + fmt(data.cashFee)} />
                        <Row label="Total costos variables" value={"−" + fmt(data.variableTotal)} bold />
                    </div>
                    <Row
                        label={`MARGEN DE CONTRIBUCIÓN  (${data.revenue ? Math.round(data.contribution / data.revenue * 100) : 0}% de las ventas)`}
                        value={fmt(data.contribution)} bold big accent="text-indigo-700"
                    />

                    {/* Costos fijos editables */}
                    <div className="mt-4 border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Costos fijos (mensuales) — × {months.toFixed(1)} {months >= 1.95 ? "meses" : "mes"}
                            </span>
                            <button
                                onClick={() => setFixedRows(rs => [...rs, { id: "local-" + Date.now(), name: "Nuevo gasto", amount: 0, enabled: true }])}
                                className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-800"
                            >
                                <Plus size={12} /> Agregar
                            </button>
                        </div>
                        {fixedRows.map((r, i) => (
                            <div key={r.id} className="flex items-center gap-2 py-0.5">
                                <input
                                    type="checkbox" checked={r.enabled}
                                    onChange={e => setFixedRows(rs => rs.map((x, j) => j === i ? { ...x, enabled: e.target.checked } : x))}
                                />
                                <input
                                    value={r.name}
                                    onChange={e => setFixedRows(rs => rs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                                    className="flex-1 text-xs border-b border-transparent focus:border-gray-300 focus:outline-none bg-transparent"
                                />
                                <input
                                    type="number" value={r.amount}
                                    onChange={e => setFixedRows(rs => rs.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))}
                                    className="w-28 text-right text-xs border border-gray-200 rounded-md px-2 py-0.5 tabular-nums"
                                />
                                <button
                                    onClick={() => setFixedRows(rs => rs.filter((_, j) => j !== i))}
                                    className="text-gray-300 hover:text-red-500"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                        <div className="flex justify-between border-t border-gray-100 mt-2 pt-1.5 text-xs">
                            <span className="font-medium text-gray-600">Total fijos del período</span>
                            <span className="font-semibold tabular-nums">−{fmt(fixedPeriod)}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">
                            Precargados de la estructura del manager (Contabilidad). Los cambios acá son simulación: no modifican la estructura.
                        </p>
                    </div>

                    <div className="mt-3">
                        <Row
                            label={`RESULTADO DEL PERÍODO  (${data.revenue ? Math.round(result / data.revenue * 100) : 0}% de las ventas)`}
                            value={fmt(result)} bold big
                            accent={result >= 0 ? "text-emerald-700" : "text-red-600"}
                        />
                    </div>

                    {data.estimatedItems > 0 && (
                        <p className="mt-2 text-[11px] text-amber-600">
                            ⚠ {data.estimatedItems} ítem(s) sin configuración resoluble: su material se estimó como {Math.round(0.25 * 100)}% del precio
                            ({data.resolvedItems} con BOM real).
                        </p>
                    )}
                </div>
            )}

        </div>
    );
}

function Row({ label, value, bold, big, accent }: { label: string; value: string; bold?: boolean; big?: boolean; accent?: string }) {
    return (
        <div className="flex justify-between items-baseline gap-3 py-1">
            <span className={`${big ? "text-sm" : "text-xs"} ${bold ? "font-semibold text-gray-800" : "text-gray-500"}`}>{label}</span>
            <span className={`${big ? "text-base" : "text-xs"} tabular-nums whitespace-nowrap ${bold ? "font-bold" : "text-gray-700"} ${accent ?? ""}`}>{value}</span>
        </div>
    );
}
