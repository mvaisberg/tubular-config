"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Order {
    id: string;
    order_number: number | null;
    created_at: string;
    client_name: string;
    final_amount: number;
    paid_amount: number;
    status: string;
    payment_method: string | null;
    source: string | null;
    discount_percentage: number;
}

type PresetKey = "this_month" | "last_month" | "last_30" | "this_year" | "all" | "custom";

const PAYMENT_LABEL: Record<string, string> = {
    transfer: "Transferencia",
    cash: "Efectivo",
    other: "Otro",
};
const STATUS_LABEL: Record<string, string> = {
    paid: "Pagado",
    partial: "Seña / parcial",
    pending: "Pendiente",
};
const SOURCE_LABEL: Record<string, string> = {
    manual: "Manual",
    woocommerce: "WooCommerce",
};

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const iso = (d: Date) => d.toISOString().slice(0, 10);

function presetRange(key: PresetKey): { from: string; to: string } {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    switch (key) {
        case "this_month":
            return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
        case "last_month":
            return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
        case "last_30": {
            const f = new Date(now); f.setDate(f.getDate() - 29);
            return { from: iso(f), to: iso(now) };
        }
        case "this_year":
            return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
        default:
            return { from: "", to: "" };
    }
}

export default function ReportsView({ orders }: { orders: Order[] }) {
    const [preset, setPreset] = useState<PresetKey>("this_month");
    const initial = presetRange("this_month");
    const [from, setFrom] = useState(initial.from);
    const [to, setTo] = useState(initial.to);

    const applyPreset = (key: PresetKey) => {
        setPreset(key);
        if (key !== "custom" && key !== "all") {
            const r = presetRange(key);
            setFrom(r.from); setTo(r.to);
        } else if (key === "all") {
            setFrom(""); setTo("");
        }
    };

    const filtered = useMemo(() => {
        return orders.filter(o => {
            const d = o.created_at.slice(0, 10);
            if (from && d < from) return false;
            if (to && d > to) return false;
            return true;
        });
    }, [orders, from, to]);

    const stats = useMemo(() => {
        const billed = filtered.reduce((s, o) => s + (Number(o.final_amount) || 0), 0);
        const collected = filtered.reduce((s, o) => s + (Number(o.paid_amount) || 0), 0);
        const count = filtered.length;
        const groupBy = (key: (o: Order) => string, labels: Record<string, string>) => {
            const g: Record<string, { label: string; amount: number; count: number }> = {};
            filtered.forEach(o => {
                const k = key(o) || "—";
                if (!g[k]) g[k] = { label: labels[k] || k, amount: 0, count: 0 };
                g[k].amount += Number(o.final_amount) || 0;
                g[k].count += 1;
            });
            return Object.values(g).sort((a, b) => b.amount - a.amount);
        };
        return {
            billed,
            collected,
            pending: billed - collected,
            count,
            avg: count ? billed / count : 0,
            byStatus: groupBy(o => o.status, STATUS_LABEL),
            byPayment: groupBy(o => o.payment_method || "—", PAYMENT_LABEL),
            bySource: groupBy(o => o.source || "—", SOURCE_LABEL),
        };
    }, [filtered]);

    const presets: [PresetKey, string][] = [
        ["this_month", "Este mes"],
        ["last_month", "Mes pasado"],
        ["last_30", "Últimos 30 días"],
        ["this_year", "Este año"],
        ["all", "Todo"],
    ];

    return (
        <div className="space-y-6">
            {/* Filtro de período */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                    {presets.map(([k, label]) => (
                        <button
                            key={k}
                            onClick={() => applyPreset(k)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${preset === k ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-xs text-gray-500">Desde</span>
                    <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPreset("custom"); }}
                        className="border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <span className="text-xs text-gray-500">hasta</span>
                    <input type="date" value={to} onChange={e => { setTo(e.target.value); setPreset("custom"); }}
                        className="border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <span className="ml-auto text-xs text-gray-400">{stats.count} pedido{stats.count === 1 ? "" : "s"} en el período</span>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="Facturado" value={fmt(stats.billed)} hint="Total de pedidos del período" accent="indigo" />
                <Kpi label="Cobrado" value={fmt(stats.collected)} hint="Pagos recibidos" accent="emerald" />
                <Kpi label="Pendiente de cobro" value={fmt(stats.pending)} hint="Facturado − cobrado" accent="amber" />
                <Kpi label="Ticket promedio" value={fmt(stats.avg)} hint={`${stats.count} pedidos`} accent="gray" />
            </div>

            {/* Desgloses */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Breakdown title="Por estado de pago" rows={stats.byStatus} total={stats.billed} />
                <Breakdown title="Por medio de pago" rows={stats.byPayment} total={stats.billed} />
                <Breakdown title="Por origen" rows={stats.bySource} total={stats.billed} />
            </div>

            {/* Detalle */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700">Detalle del período</div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                        <thead className="bg-gray-50">
                            <tr className="text-left text-xs font-medium text-gray-500">
                                <th className="px-4 py-2.5">Pedido</th>
                                <th className="px-4 py-2.5">Fecha</th>
                                <th className="px-4 py-2.5">Cliente</th>
                                <th className="px-4 py-2.5">Estado</th>
                                <th className="px-4 py-2.5">Pago</th>
                                <th className="px-4 py-2.5 text-right">Facturado</th>
                                <th className="px-4 py-2.5 text-right">Cobrado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 italic">Sin pedidos en el período.</td></tr>
                            ) : filtered.map(o => (
                                <tr key={o.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2.5 font-medium text-gray-700 tabular-nums">TUB-{String(o.order_number || 0).padStart(4, "0")}</td>
                                    <td className="px-4 py-2.5 text-gray-500">{format(new Date(o.created_at), "d MMM yyyy", { locale: es })}</td>
                                    <td className="px-4 py-2.5 text-gray-700 truncate max-w-[160px]">{o.client_name}</td>
                                    <td className="px-4 py-2.5 text-gray-600">{STATUS_LABEL[o.status] || o.status}</td>
                                    <td className="px-4 py-2.5 text-gray-600">{o.payment_method ? PAYMENT_LABEL[o.payment_method] || o.payment_method : "—"}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">{fmt(Number(o.final_amount) || 0)}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{fmt(Number(o.paid_amount) || 0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint: string; accent: "indigo" | "emerald" | "amber" | "gray" }) {
    const ring: Record<string, string> = {
        indigo: "border-l-indigo-500",
        emerald: "border-l-emerald-500",
        amber: "border-l-amber-500",
        gray: "border-l-gray-400",
    };
    return (
        <div className={`bg-white border border-gray-200 border-l-4 ${ring[accent]} rounded-lg p-4`}>
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-xl font-semibold text-gray-900 tabular-nums mt-1">{value}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>
        </div>
    );
}

function Breakdown({ title, rows, total }: { title: string; rows: { label: string; amount: number; count: number }[]; total: number }) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">{title}</div>
            {rows.length === 0 ? (
                <div className="text-xs text-gray-400 italic">Sin datos.</div>
            ) : (
                <ul className="space-y-2.5">
                    {rows.map(r => {
                        const pct = total > 0 ? Math.round((r.amount / total) * 100) : 0;
                        return (
                            <li key={r.label}>
                                <div className="flex justify-between items-baseline text-xs mb-1">
                                    <span className="text-gray-600">{r.label} <span className="text-gray-400">· {r.count}</span></span>
                                    <span className="font-semibold text-gray-900 tabular-nums">{fmt(r.amount)}</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
