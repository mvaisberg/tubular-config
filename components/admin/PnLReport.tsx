"use client";

// Cuadro de resultados por período (solo admin — vive en /admin/parts).
// Ventas reales → costos variables (materiales + carga por canal) → margen de
// contribución → costos fijos (precargados de la estructura, editables acá
// como simulación) → resultado del período.

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { Settings } from "@/lib/pricing";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

// Fracción del costo de materiales que viene CON factura (crédito de IVA),
// promedio ponderado del catálogo real (calculado sobre los BOM, ago-2026).
const CRED_SHARE: Record<"steel" | "acrylic", number> = { steel: 0.174, acrylic: 0.523 };
const IVA = 0.21, IIBB = 0.035, CASH_FEE = 0.03, CASH_FACTOR = 0.8;

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

// ── Simulador: facturación hipotética por material y medio de cobro ────────
interface SimQuadrant { material: "steel" | "acrylic"; channel: "lista" | "efectivo"; rev: number }

function simulateQuadrant(q: SimQuadrant, s: Settings, avgTicket: number) {
    const margin = (q.material === "acrylic"
        ? s.margin_acrylic_percent
        : s.margin_steel_percent) ?? s.target_margin_percent ?? 70;
    const feeNetPct = ((s.transaction_fee_percent ?? 2.5) + (s.installments_6_percent ?? 11)) / 100;
    const feeTotPct = feeNetPct * (1 + IVA);
    const ship = s.shipping_cost ?? 20000;

    const n = avgTicket > 0 ? q.rev / avgTicket : 0; // ventas estimadas
    const envio = n * ship;
    // Precio de lista equivalente (el efectivo ya tiene el 20% off aplicado).
    const P = q.channel === "lista" ? q.rev : q.rev / CASH_FACTOR;
    // Inversa de la fórmula de precios: C = (P·(1−fees) − n·envío)·(1−margen)
    const materials = Math.max(0, (P * (1 - feeTotPct) - envio) * (1 - margin / 100));

    let feesCard = 0, ivaPay = 0, iibb = 0, cashFee = 0;
    if (q.channel === "lista") {
        const feesNet = q.rev * feeNetPct;
        const feesIva = feesNet * IVA;
        feesCard = feesNet + feesIva;
        const ivaDebit = q.rev * IVA / (1 + IVA);
        const ivaCred = (materials * CRED_SHARE[q.material]) * IVA / (1 + IVA);
        ivaPay = Math.max(0, ivaDebit - ivaCred - feesIva);
        iibb = (q.rev / (1 + IVA)) * IIBB;
    } else {
        cashFee = q.rev * CASH_FEE;
    }
    const variable = materials + envio + feesCard + ivaPay + iibb + cashFee;
    return { materials, envio, feesCard, ivaPay, iibb, cashFee, variable, contribution: q.rev - variable, n };
}

export default function PnLReport({ settings }: { settings?: Settings }) {
    const [preset, setPreset] = useState("mes");
    const [[from, to], setRange] = useState<[string, string]>(presetRange("mes"));
    const [data, setData] = useState<PnL | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fixedRows, setFixedRows] = useState<FixedRow[]>([]);
    const [fixedLoaded, setFixedLoaded] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    // Simulador: facturación hipotética mensual por material × medio de cobro.
    const [simAcrLista, setSimAcrLista] = useState("");
    const [simAcrEfectivo, setSimAcrEfectivo] = useState("");
    const [simSteelLista, setSimSteelLista] = useState("");
    const [simSteelEfectivo, setSimSteelEfectivo] = useState("");
    const [simTicket, setSimTicket] = useState("1500000");

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
            <h2 className="text-base font-semibold text-gray-900">Cuadro de resultados</h2>
            <p className="text-xs text-gray-500 mt-0.5 mb-3">
                Ventas del período (todos los pedidos del manager, incluidos los pendientes de pago o entrega),
                costos variables reales por canal, y costos fijos de la estructura.
            </p>

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

            {/* ── Simulador de facturación ─────────────────────────────────── */}
            {settings && (() => {
                const num = (s: string) => parseFloat(s) || 0;
                // Formato es-AR con separador de miles mientras se tipea;
                // el estado guarda solo los dígitos.
                const fmtIn = (s: string) => (s ? Number(s).toLocaleString("es-AR") : "");
                const parseIn = (v: string) => v.replace(/\D/g, "");
                const ticket = num(simTicket) || 1500000;
                const quadrants: { key: string; label: string; sub: string; value: string; set: (v: string) => void; q: SimQuadrant }[] = [
                    { key: "al", label: "Acrílico · Tarjeta", sub: "facturado a lista", value: simAcrLista, set: setSimAcrLista, q: { material: "acrylic", channel: "lista", rev: num(simAcrLista) } },
                    { key: "ae", label: "Acrílico · Efectivo/Transf.", sub: "con 20% off aplicado", value: simAcrEfectivo, set: setSimAcrEfectivo, q: { material: "acrylic", channel: "efectivo", rev: num(simAcrEfectivo) } },
                    { key: "sl", label: "Acero · Tarjeta", sub: "facturado a lista", value: simSteelLista, set: setSimSteelLista, q: { material: "steel", channel: "lista", rev: num(simSteelLista) } },
                    { key: "se", label: "Acero · Efectivo/Transf.", sub: "con 20% off aplicado", value: simSteelEfectivo, set: setSimSteelEfectivo, q: { material: "steel", channel: "efectivo", rev: num(simSteelEfectivo) } },
                ];
                const results = quadrants.map(c => ({ ...c, r: simulateQuadrant(c.q, settings, ticket) }));
                const totRev = results.reduce((a, c) => a + c.q.rev, 0);
                const sum = (f: (r: ReturnType<typeof simulateQuadrant>) => number) => results.reduce((a, c) => a + f(c.r), 0);
                const materials = sum(r => r.materials), envio = sum(r => r.envio), feesCard = sum(r => r.feesCard),
                    ivaPay = sum(r => r.ivaPay), iibb = sum(r => r.iibb), cashFee = sum(r => r.cashFee);
                const variable = sum(r => r.variable);
                const contribution = totRev - variable;
                const fixedMonthlySim = fixedRows.filter(x => x.enabled).reduce((a, x) => a + (x.amount || 0), 0);
                const simResult = contribution - fixedMonthlySim;

                return (
                    <div className="mt-6 pt-5 border-t border-gray-200 max-w-2xl">
                        <h3 className="text-sm font-semibold text-gray-900">Simulador de facturación mensual</h3>
                        <p className="text-xs text-gray-500 mt-0.5 mb-3">
                            Ingresá una facturación hipotética por material y medio de cobro: calcula materiales,
                            impuestos, fees y fijos con los márgenes y costos actuales de Settings.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {results.map(c => (
                                <div key={c.key} className="border border-gray-200 rounded-lg p-3">
                                    <div className="text-xs font-semibold text-gray-800">{c.label}</div>
                                    <div className="text-[10px] text-gray-400 mb-1.5">{c.sub}</div>
                                    <div className="relative">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={fmtIn(c.value)}
                                            onChange={e => c.set(parseIn(e.target.value))}
                                            placeholder="0"
                                            className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-200 rounded-md tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                        />
                                    </div>
                                    {c.q.rev > 0 && (
                                        <div className="mt-1.5 flex justify-between text-[11px]">
                                            <span className="text-gray-400">te queda (antes de fijos)</span>
                                            <span className="font-semibold tabular-nums text-gray-700">
                                                {fmt(c.r.contribution)} ({c.q.rev ? Math.round(c.r.contribution / c.q.rev * 100) : 0}%)
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
                            Ticket promedio para estimar envíos:
                            <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={fmtIn(simTicket)}
                                    onChange={e => setSimTicket(parseIn(e.target.value))}
                                    className="w-28 pl-5 pr-1 py-0.5 border border-gray-200 rounded-md tabular-nums"
                                />
                            </div>
                            {totRev > 0 && <span>≈ {Math.round(totRev / ticket)} ventas</span>}
                        </div>

                        {totRev > 0 && (
                            <div className="mt-3">
                                <Row label="FACTURACIÓN SIMULADA" value={fmt(totRev)} bold big />
                                <div className="pl-3 border-l-2 border-gray-100 my-1">
                                    <Row label="Materiales (según margen por material)" value={"−" + fmt(materials)} />
                                    <Row label="Envíos" value={"−" + fmt(envio)} />
                                    {feesCard > 0 && <Row label="Fees tarjeta + cuotas" value={"−" + fmt(feesCard)} />}
                                    {ivaPay > 0 && <Row label="IVA a pagar (débito − créditos)" value={"−" + fmt(ivaPay)} />}
                                    {iibb > 0 && <Row label="IIBB 3,5%" value={"−" + fmt(iibb)} />}
                                    {cashFee > 0 && <Row label="Comisión de cobro 3% (efectivo)" value={"−" + fmt(cashFee)} />}
                                    <Row label="Total costos variables" value={"−" + fmt(variable)} bold />
                                </div>
                                <Row
                                    label={`MARGEN DE CONTRIBUCIÓN  (${totRev ? Math.round(contribution / totRev * 100) : 0}%)`}
                                    value={fmt(contribution)} bold accent="text-indigo-700"
                                />
                                <Row label="Costos fijos (1 mes, según lista de arriba)" value={"−" + fmt(fixedMonthlySim)} />
                                <Row
                                    label={`RESULTADO SIMULADO  (${totRev ? Math.round(simResult / totRev * 100) : 0}%)`}
                                    value={fmt(simResult)} bold big
                                    accent={simResult >= 0 ? "text-emerald-700" : "text-red-600"}
                                />
                                <p className="mt-1.5 text-[10px] text-gray-400">
                                    Materiales estimados invirtiendo la fórmula de precios (margen acero {settings.margin_steel_percent ?? settings.target_margin_percent}% ·
                                    acrílico {settings.margin_acrylic_percent ?? settings.target_margin_percent}%). Crédito de IVA: {Math.round(CRED_SHARE.steel * 100)}% del
                                    material de acero y {Math.round(CRED_SHARE.acrylic * 100)}% del acrílico tienen factura (promedio del catálogo).
                                </p>
                            </div>
                        )}
                    </div>
                );
            })()}
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
