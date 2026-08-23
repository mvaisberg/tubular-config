"use client";

// Informe de tráfico y uso real del configurador (solo admin).
// Responde: ¿la gente que llega (sobre todo de campañas) realmente lo usa?

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface Agg {
    sessions: number; engaged: number; engagedPct: number; junk: number; junkPct: number;
    avgInteractions: number; avgDuration: number; shared: number; addedToCart: number; mobile: number;
}
interface Data {
    total: Agg; legacySessions: number; paid: Agg; organic: Agg;
    campaigns: ({ name: string } & Agg)[];
    referrers: ({ name: string } & Agg)[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const dur = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;

function presetRange(key: string): [string, string] {
    const now = new Date();
    const past = (days: number) => { const d = new Date(now); d.setDate(d.getDate() - days); return d; };
    switch (key) {
        case "7d": return [iso(past(6)), iso(now)];
        case "14d": return [iso(past(13)), iso(now)];
        case "30d": return [iso(past(29)), iso(now)];
        default: return [iso(past(6)), iso(now)];
    }
}

export default function TrafficReport() {
    const [preset, setPreset] = useState("7d");
    const [[from, to], setRange] = useState<[string, string]>(presetRange("7d"));
    const [data, setData] = useState<Data | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async (f: string, t: string) => {
        setLoading(true); setError(null);
        try {
            const res = await fetch(`/configurador/api/reports/traffic?from=${f}&to=${t}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setData(json);
        } catch (e) { setError((e as Error).message); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(from, to); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    const applyPreset = (k: string) => { setPreset(k); const r = presetRange(k); setRange(r); load(r[0], r[1]); };

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
                {[["7d", "Últimos 7 días"], ["14d", "14 días"], ["30d", "30 días"]].map(([k, l]) => (
                    <button key={k} onClick={() => applyPreset(k)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${preset === k ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
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

            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

            {data && (
                <>
                    {/* KPIs generales */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <Kpi label="Sesiones" value={String(data.total.sessions)} sub={`${data.total.mobile} mobile`} />
                        <Kpi label="Usaron el configurador" value={`${data.total.engagedPct}%`} sub={`${data.total.engaged} sesiones`} accent="text-emerald-600" />
                        <Kpi label="Tráfico basura" value={`${data.total.junkPct}%`} sub={`${data.total.junk} sin tocar nada (<10s)`} accent="text-rose-600" />
                        <Kpi label="Interacciones prom." value={String(data.total.avgInteractions)} sub="entre quienes usaron" />
                        <Kpi label="Duración prom." value={dur(data.total.avgDuration)} sub="por visita" />
                        <Kpi label="Carrito / Compartir" value={`${data.total.addedToCart} / ${data.total.shared}`} sub="acciones fuertes" />
                    </div>

                    {/* Publicidad vs orgánico */}
                    <div className="grid md:grid-cols-2 gap-3">
                        <SegmentCard title="📣 Publicidad (con UTM)" a={data.paid} />
                        <SegmentCard title="🌱 Orgánico / directo" a={data.organic} />
                    </div>

                    {/* Por campaña */}
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-gray-100 text-sm font-semibold text-gray-900">Por campaña (UTM)</div>
                        <SourceTable rows={data.campaigns} empty="Sin tráfico con UTM en el período. Usá los links con utm_source en los anuncios." />
                    </div>

                    {/* Por origen orgánico */}
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-gray-100 text-sm font-semibold text-gray-900">Orgánico por origen</div>
                        <SourceTable rows={data.referrers} empty="Sin sesiones orgánicas en el período." />
                    </div>

                    {data.legacySessions > 0 && (
                        <p className="text-[11px] text-gray-400">
                            {data.legacySessions} sesiones del período son anteriores al tracking de uso (solo cuentan como apertura, sin datos de interacción) y no entran en los porcentajes.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-[11px] text-gray-500">{label}</div>
            <div className={`text-xl font-semibold tabular-nums ${accent || "text-gray-900"}`}>{value}</div>
            {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
        </div>
    );
}

function SegmentCard({ title, a }: { title: string; a: Agg }) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">{title}</div>
            <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-lg font-semibold tabular-nums">{a.sessions}</div><div className="text-[10px] text-gray-400">sesiones</div></div>
                <div><div className={`text-lg font-semibold tabular-nums ${a.engagedPct >= 40 ? "text-emerald-600" : "text-amber-600"}`}>{a.engagedPct}%</div><div className="text-[10px] text-gray-400">usaron</div></div>
                <div><div className="text-lg font-semibold tabular-nums">{a.addedToCart}</div><div className="text-[10px] text-gray-400">al carrito</div></div>
            </div>
            <div className="mt-2 text-[11px] text-gray-500 text-center">
                {a.avgInteractions} interacciones prom. · {dur(a.avgDuration)} prom. · {a.junkPct}% basura
            </div>
        </div>
    );
}

function SourceTable({ rows, empty }: { rows: ({ name: string } & Agg)[]; empty: string }) {
    if (!rows.length) return <p className="px-4 py-5 text-xs text-gray-400 italic">{empty}</p>;
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="px-4 py-2 font-medium">Origen</th>
                        <th className="px-3 py-2 font-medium text-right">Sesiones</th>
                        <th className="px-3 py-2 font-medium text-right">Usaron</th>
                        <th className="px-3 py-2 font-medium text-right">Basura</th>
                        <th className="px-3 py-2 font-medium text-right">Interac. prom.</th>
                        <th className="px-3 py-2 font-medium text-right">Duración</th>
                        <th className="px-4 py-2 font-medium text-right">Carrito</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {rows.map(r => (
                        <tr key={r.name} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-800">{r.name}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{r.sessions}</td>
                            <td className={`px-3 py-2 text-right tabular-nums font-semibold ${r.engagedPct >= 40 ? "text-emerald-600" : "text-amber-600"}`}>{r.engagedPct}%</td>
                            <td className="px-3 py-2 text-right tabular-nums text-rose-600">{r.junkPct}%</td>
                            <td className="px-3 py-2 text-right tabular-nums">{r.avgInteractions}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{dur(r.avgDuration)}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{r.addedToCart}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
