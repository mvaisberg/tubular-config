import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ExternalLink, Eye, Monitor, Smartphone, Tablet, TrendingUp, TrendingDown } from "lucide-react";

type TipoKey = 'share' | 'wa' | 'cliente';
type DeviceKind = 'desktop' | 'mobile' | 'tablet';

const getTipo = (q: any): TipoKey => {
    const name = q?.client_name || '';
    if (name === 'Share Link') return 'share';
    if (name === 'Cotización WhatsApp') return 'wa';
    return 'cliente';
};

const getViews = (q: any): number => {
    if (typeof q.views === 'number') return q.views;
    const c = q.configuration;
    if (c && typeof c === 'object' && !Array.isArray(c) && typeof c.views === 'number') return c.views;
    return 0;
};

const getDevice = (q: any): DeviceKind | null => {
    const v = q.device;
    if (v === 'desktop' || v === 'mobile' || v === 'tablet') return v;
    return null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

function DeviceGlyph({ kind, size = 14 }: { kind: DeviceKind; size?: number }) {
    if (kind === 'mobile') return <Smartphone size={size} strokeWidth={2} />;
    if (kind === 'tablet') return <Tablet size={size} strokeWidth={2} />;
    return <Monitor size={size} strokeWidth={2} />;
}

export default async function AdminDashboard({
    searchParams,
}: {
    searchParams: Promise<{ from?: string; to?: string }>;
}) {
    const sp = await searchParams;
    const today = startOfDay(new Date());
    const defaultFrom = toYMD(new Date(today.getTime() - 30 * DAY_MS));
    const defaultTo = toYMD(today);

    const fromStr = (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) ? sp.from : defaultFrom;
    const toStr = (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) ? sp.to : defaultTo;

    const fromDate = new Date(fromStr + 'T00:00:00');
    const toDate = new Date(toStr + 'T23:59:59.999');
    const rangeDays = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS));
    const prevFrom = new Date(fromDate.getTime() - rangeDays * DAY_MS);

    const supabase = await createClient();
    const { data: quotesRaw } = await supabase
        .from('quotes')
        .select('id, client_name, created_at, total_price_ars, configuration, views, device, last_opened_at, device_last_opened')
        .gte('created_at', prevFrom.toISOString())
        .lte('created_at', toDate.toISOString())
        .order('created_at', { ascending: false });

    const quotes = quotesRaw || [];

    const now = Date.now();
    const todayMs = today.getTime();
    const fromMs = fromDate.getTime();
    const toMs = toDate.getTime();
    const prevFromMs = prevFrom.getTime();

    let countToday = 0;
    let countInRange = 0, countPrevRange = 0;
    let sumInRange = 0;
    let totalViewsInRange = 0;
    const byTipo = { share: 0, wa: 0, cliente: 0 } as Record<TipoKey, number>;
    const byDevice = { desktop: 0, mobile: 0, tablet: 0, unknown: 0 };
    const byDay = new Map<string, number>();

    for (let t = fromMs; t <= toMs; t += DAY_MS) {
        byDay.set(toYMD(new Date(t)), 0);
    }

    quotes.forEach((q) => {
        const ts = new Date(q.created_at).getTime();
        if (ts >= todayMs && ts <= now) countToday++;
        if (ts >= fromMs && ts <= toMs) {
            countInRange++;
            sumInRange += Number(q.total_price_ars || 0);
            byTipo[getTipo(q)]++;
            totalViewsInRange += getViews(q);
            const d = getDevice(q);
            if (d) byDevice[d]++; else byDevice.unknown++;
            const key = toYMD(new Date(ts));
            if (byDay.has(key)) byDay.set(key, (byDay.get(key) || 0) + 1);
        }
        if (ts >= prevFromMs && ts < fromMs) countPrevRange++;
    });

    const deltaPct = countPrevRange > 0
        ? Math.round(((countInRange - countPrevRange) / countPrevRange) * 100)
        : (countInRange > 0 ? 100 : 0);

    // Aperturas reales del configurador (tracking propio) en el rango.
    const { count: opensCount } = await supabase
        .from('configurator_sessions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString());
    const opens = opensCount || 0;
    // Conversión: cotizaciones guardadas / aperturas.
    const conversionPct = opens > 0 ? Math.round((countInRange / opens) * 1000) / 10 : 0;

    const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
    const maxDay = Math.max(1, ...days.map(([, v]) => v));

    const recent = quotes
        .filter((q) => {
            const ts = new Date(q.created_at).getTime();
            return ts >= fromMs && ts <= toMs;
        })
        .slice(0, 6);

    const presets = [
        { days: 7, label: '7 días' },
        { days: 30, label: '30 días' },
        { days: 90, label: '90 días' },
    ];

    return (
        <div className="space-y-6 pb-32">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Mediciones del configurador · {format(fromDate, "d MMM", { locale: es })} – {format(toDate, "d MMM yyyy", { locale: es })}
                </p>
            </header>

            {/* Date range picker */}
            <form method="get" className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium text-gray-500">Rango</span>
                {presets.map((p) => {
                    const f = toYMD(new Date(today.getTime() - p.days * DAY_MS));
                    const t = defaultTo;
                    const active = fromStr === f && toStr === t;
                    return (
                        <Link
                            key={p.days}
                            href={`/admin?from=${f}&to=${t}`}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${active ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                        >
                            {p.label}
                        </Link>
                    );
                })}

                <div className="flex items-center gap-2 ml-auto">
                    <label className="text-xs font-medium text-gray-500">Desde</label>
                    <input type="date" name="from" defaultValue={fromStr} className="text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    <label className="text-xs font-medium text-gray-500">Hasta</label>
                    <input type="date" name="to" defaultValue={toStr} className="text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    <button type="submit" className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
                        Aplicar
                    </button>
                </div>
            </form>

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Kpi label="Hoy" value={countToday.toString()} sub="configuraciones" />
                <Kpi label="En el rango" value={countInRange.toString()} sub={`${rangeDays} día${rangeDays === 1 ? '' : 's'}`} />
                <Kpi
                    label="vs. período previo"
                    value={`${deltaPct >= 0 ? '+' : ''}${deltaPct}%`}
                    sub={`${countPrevRange} prev`}
                    accent={deltaPct >= 0 ? 'positive' : 'negative'}
                />
                <Kpi label="Total cotizado" value={`$${Math.round(sumInRange).toLocaleString('es-AR')}`} sub="ARS" />
            </div>

            {/* Uso real del configurador (tracking propio de aperturas) */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Kpi label="Aperturas del configurador" value={opens.toLocaleString('es-AR')} sub={`${rangeDays} día${rangeDays === 1 ? '' : 's'} · uso real`} />
                <Kpi label="Cotizaciones guardadas" value={countInRange.toLocaleString('es-AR')} sub="del configurador" />
                <Kpi label="Conversión" value={`${conversionPct}%`} sub="guardan / abren" accent={conversionPct > 0 ? 'positive' : undefined} />
            </div>

            {/* Bar chart configs/day */}
            <section className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Configuraciones por día</h3>
                <div className="flex items-end gap-[3px] h-32 mt-2">
                    {days.map(([key, count]) => {
                        const heightPct = (count / maxDay) * 100;
                        const dateLabel = format(new Date(key + 'T00:00:00'), 'd MMM', { locale: es });
                        return (
                            <div key={key} className="flex-1 group relative" style={{ minWidth: 0 }}>
                                <div
                                    className="w-full bg-gray-300 group-hover:bg-indigo-600 transition-colors rounded-sm"
                                    style={{ height: `${Math.max(heightPct, count > 0 ? 4 : 1)}%` }}
                                    title={`${dateLabel}: ${count}`}
                                />
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-medium px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                    {dateLabel}: {count}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>{days[0] ? format(new Date(days[0][0] + 'T00:00:00'), 'd MMM', { locale: es }) : ''}</span>
                    <span>{days.length > 0 ? format(new Date(days[days.length - 1][0] + 'T00:00:00'), 'd MMM', { locale: es }) : ''}</span>
                </div>
            </section>

            {/* Two-column breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <section className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Origen <span className="text-gray-400 font-normal">· {totalViewsInRange} aperturas</span></h3>
                    <Bars
                        rows={[
                            { label: 'Share Links', value: byTipo.share, cls: 'bg-indigo-500' },
                            { label: 'Cotización WhatsApp', value: byTipo.wa, cls: 'bg-emerald-500' },
                            { label: 'Cliente (manual)', value: byTipo.cliente, cls: 'bg-amber-500' },
                        ]}
                        total={countInRange}
                    />
                </section>

                <section className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Dispositivo de creación</h3>
                    <Bars
                        rows={[
                            { label: 'Desktop', value: byDevice.desktop, cls: 'bg-slate-700', icon: <Monitor size={14} strokeWidth={2} /> },
                            { label: 'Mobile', value: byDevice.mobile, cls: 'bg-orange-500', icon: <Smartphone size={14} strokeWidth={2} /> },
                            { label: 'Tablet', value: byDevice.tablet, cls: 'bg-purple-500', icon: <Tablet size={14} strokeWidth={2} /> },
                            { label: 'Desconocido', value: byDevice.unknown, cls: 'bg-gray-300' },
                        ]}
                        total={countInRange}
                    />
                </section>
            </div>

            {/* Recent activity */}
            <section className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">Actividad reciente</h3>
                    <Link href="/admin/quotes" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                        Ver todas →
                    </Link>
                </div>
                {recent.length === 0 ? (
                    <p className="text-sm text-gray-400 mt-4">No hay actividad en este rango.</p>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {recent.map((q) => {
                            const tipo = getTipo(q);
                            const views = getViews(q);
                            const device = getDevice(q);
                            const tipoStyle = tipo === 'share'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : tipo === 'wa'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200';
                            return (
                                <li key={q.id} className="flex items-center gap-4 py-3">
                                    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border rounded ${tipoStyle}`}>
                                        {tipo === 'share' ? 'SHARE' : tipo === 'wa' ? 'WHATSAPP' : 'CLIENTE'}
                                    </span>
                                    <span className="text-xs text-gray-500 flex-1">
                                        {format(new Date(q.created_at), "d MMM yyyy · HH:mm", { locale: es })}
                                    </span>
                                    <span className="text-gray-400" title={device || 'Desconocido'}>
                                        {device ? <DeviceGlyph kind={device} /> : <span className="text-gray-300">—</span>}
                                    </span>
                                    <span className="text-sm font-semibold text-gray-900 tabular-nums">
                                        ${Number(q.total_price_ars || 0).toLocaleString('es-AR')}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 tabular-nums w-12 justify-end">
                                        <Eye size={11} strokeWidth={2} /> {views}
                                    </span>
                                    <Link
                                        href={`/?quote=${q.id}&admin=1`}
                                        target="_blank"
                                        className="text-gray-400 hover:text-indigo-600 p-1.5 rounded-md hover:bg-gray-50 transition-colors"
                                        title="Abrir en Configurador"
                                    >
                                        <ExternalLink size={14} strokeWidth={2} />
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'positive' | 'negative' }) {
    const accentColor = accent === 'positive' ? 'text-emerald-600' : accent === 'negative' ? 'text-rose-600' : 'text-gray-500';
    const Icon = accent === 'positive' ? TrendingUp : accent === 'negative' ? TrendingDown : null;
    return (
        <div className="bg-white p-5 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
            <h3 className="text-xs font-medium text-gray-500">{label}</h3>
            <p className="text-3xl font-semibold mt-2 text-gray-900 tabular-nums">{value}</p>
            {sub && (
                <p className={`text-xs mt-2 flex items-center gap-1 ${accentColor}`}>
                    {Icon && <Icon size={12} />}
                    {sub}
                </p>
            )}
        </div>
    );
}

function Bars({ rows, total }: { rows: { label: string; value: number; cls: string; icon?: React.ReactNode }[]; total: number }) {
    return (
        <div className="space-y-3">
            {rows.map((r, idx) => {
                const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
                return (
                    <div key={idx} className="flex items-center gap-3">
                        <span className="text-xs text-gray-700 w-40 flex items-center gap-2">
                            <span className="text-gray-400">{r.icon}</span> {r.label}
                        </span>
                        <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div className={`h-full ${r.cls} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-700 tabular-nums w-20 text-right">{r.value} · {pct}%</span>
                    </div>
                );
            })}
        </div>
    );
}
