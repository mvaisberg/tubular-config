"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink, Eye, Monitor, Package, Smartphone, Tablet, Trash2, CheckSquare, Square } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface QuotesTableProps {
    quotes: any[];
}

type TipoKey = 'share' | 'wa' | 'cliente';
type DeviceKind = 'desktop' | 'mobile' | 'tablet';

const getTipo = (q: any): TipoKey => {
    const name = q.client_name || '';
    if (name === 'Share Link') return 'share';
    if (name === 'Cotización WhatsApp') return 'wa';
    return 'cliente';
};

const TIPO_META: Record<TipoKey, { label: string; cls: string }> = {
    share: { label: 'SHARE', cls: 'bg-blue-100 text-blue-900 border-blue-900' },
    wa: { label: 'WHATSAPP', cls: 'bg-green-100 text-green-900 border-green-900' },
    cliente: { label: 'CLIENTE', cls: 'bg-yellow-100 text-yellow-900 border-yellow-900' },
};

const getModules = (config: any): any[] => {
    if (!config) return [];
    if (Array.isArray(config)) return config;
    if (Array.isArray(config.modules)) return config.modules;
    return [];
};

const getMaterials = (modules: any[]): string => {
    const mats = new Set<string>();
    modules.forEach((m) => { if (m?.material) mats.add(m.material); });
    if (mats.size === 0) return '—';
    if (mats.size === 1) {
        const v = [...mats][0];
        return v === 'steel' ? 'ACERO' : v === 'acrylic' ? 'ACRÍLICO' : v.toUpperCase();
    }
    return 'MIXTO';
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

const DeviceIcon = ({ kind, size = 14 }: { kind: DeviceKind | null; size?: number }) => {
    if (kind === 'mobile') return <Smartphone size={size} strokeWidth={2.5} />;
    if (kind === 'tablet') return <Tablet size={size} strokeWidth={2.5} />;
    if (kind === 'desktop') return <Monitor size={size} strokeWidth={2.5} />;
    return <span className="text-gray-300">—</span>;
};

const toYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const todayYMD = () => toYMD(new Date());
const daysAgoYMD = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toYMD(d);
};

export default function QuotesTable({ quotes: initialQuotes }: QuotesTableProps) {
    const [quotes, setQuotes] = useState(initialQuotes);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [filterTipo, setFilterTipo] = useState<TipoKey | 'all'>('all');
    const [filterDevice, setFilterDevice] = useState<DeviceKind | 'all'>('all');
    const [fromDate, setFromDate] = useState<string>(daysAgoYMD(30));
    const [toDate, setToDate] = useState<string>(todayYMD());
    const supabase = createClient();

    const setPreset = (days: number | null) => {
        if (days == null) {
            setFromDate('');
            setToDate('');
            return;
        }
        setFromDate(daysAgoYMD(days));
        setToDate(todayYMD());
    };

    const filteredQuotes = useMemo(() => {
        const fromTs = fromDate ? new Date(fromDate + 'T00:00:00').getTime() : null;
        const toTs = toDate ? new Date(toDate + 'T23:59:59.999').getTime() : null;
        return quotes.filter((q) => {
            const ts = new Date(q.created_at).getTime();
            if (fromTs != null && ts < fromTs) return false;
            if (toTs != null && ts > toTs) return false;
            if (filterTipo !== 'all' && getTipo(q) !== filterTipo) return false;
            if (filterDevice !== 'all' && getDevice(q) !== filterDevice) return false;
            return true;
        });
    }, [quotes, filterTipo, filterDevice, fromDate, toDate]);

    const counts = useMemo(() => {
        const c: Record<TipoKey | 'all', number> = { all: quotes.length, share: 0, wa: 0, cliente: 0 };
        quotes.forEach((q) => { c[getTipo(q)]++; });
        return c;
    }, [quotes]);

    const deviceCounts = useMemo(() => {
        const c: Record<DeviceKind | 'all' | 'unknown', number> = { all: quotes.length, desktop: 0, mobile: 0, tablet: 0, unknown: 0 };
        quotes.forEach((q) => {
            const d = getDevice(q);
            if (d) c[d]++; else c.unknown++;
        });
        return c;
    }, [quotes]);

    const toggleExpand = (id: string) => setExpandedId(expandedId === id ? null : id);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredQuotes.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredQuotes.map(q => q.id));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar esta cotización?")) return;
        const { error } = await supabase.from("quotes").delete().eq("id", id);
        if (error) {
            alert("Error: " + error.message);
        } else {
            setQuotes(quotes.filter(q => q.id !== id));
            setSelectedIds(selectedIds.filter(i => i !== id));
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`¿Estás seguro de eliminar ${selectedIds.length} cotizaciones?`)) return;
        const { error } = await supabase.from("quotes").delete().in("id", selectedIds);
        if (error) {
            alert("Error: " + error.message);
        } else {
            setQuotes(quotes.filter(q => !selectedIds.includes(q.id)));
            setSelectedIds([]);
        }
    };

    const FilterChip = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
        <button
            onClick={onClick}
            className={`px-3 py-2 text-[10px] font-semibold tracking-normal border border-gray-200 transition-colors ${active ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-900 hover:bg-gray-50'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-4">
            {/* Filters block */}
            <div className="bg-white border border-gray-200 p-4 shadow-sm space-y-3">
                {/* Tipo */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold tracking-normal text-gray-500 w-16">Tipo</span>
                    <FilterChip active={filterTipo === 'all'} onClick={() => setFilterTipo('all')} label={`Todos (${counts.all})`} />
                    <FilterChip active={filterTipo === 'share'} onClick={() => setFilterTipo('share')} label={`Share (${counts.share})`} />
                    <FilterChip active={filterTipo === 'wa'} onClick={() => setFilterTipo('wa')} label={`WhatsApp (${counts.wa})`} />
                    <FilterChip active={filterTipo === 'cliente'} onClick={() => setFilterTipo('cliente')} label={`Cliente (${counts.cliente})`} />
                </div>

                {/* Device */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold tracking-normal text-gray-500 w-16">Disp.</span>
                    <FilterChip active={filterDevice === 'all'} onClick={() => setFilterDevice('all')} label={`Todos (${deviceCounts.all})`} />
                    <FilterChip active={filterDevice === 'desktop'} onClick={() => setFilterDevice('desktop')} label={`Desktop (${deviceCounts.desktop})`} />
                    <FilterChip active={filterDevice === 'mobile'} onClick={() => setFilterDevice('mobile')} label={`Mobile (${deviceCounts.mobile})`} />
                    <FilterChip active={filterDevice === 'tablet'} onClick={() => setFilterDevice('tablet')} label={`Tablet (${deviceCounts.tablet})`} />
                </div>

                {/* Date range */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold tracking-normal text-gray-500 w-16">Rango</span>
                    <FilterChip active={false} onClick={() => setPreset(7)} label="7 días" />
                    <FilterChip active={false} onClick={() => setPreset(30)} label="30 días" />
                    <FilterChip active={false} onClick={() => setPreset(90)} label="90 días" />
                    <FilterChip active={!fromDate && !toDate} onClick={() => setPreset(null)} label="Todo" />
                    <div className="flex items-center gap-2 ml-auto">
                        <label className="text-[10px] font-semibold tracking-normal text-gray-500">Desde</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="text-[11px] font-bold border border-gray-200 px-2 py-1.5"
                        />
                        <label className="text-[10px] font-semibold tracking-normal text-gray-500">Hasta</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="text-[11px] font-bold border border-gray-200 px-2 py-1.5"
                        />
                    </div>
                </div>
            </div>

            {selectedIds.length > 0 && (
                <div className="flex justify-between items-center bg-blue-50 border border-gray-200 p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <span className="text-xs font-semibold tracking-normal text-gray-900">
                        {selectedIds.length} SELECCIONADOS
                    </span>
                    <button
                        onClick={handleBulkDelete}
                        className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 text-[10px] font-semibold tracking-normal hover:bg-black transition-colors"
                    >
                        <Trash2 size={14} /> ELIMINAR SELECCIONADOS
                    </button>
                </div>
            )}

            <div className="overflow-x-auto bg-white border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-black">
                        <tr>
                            <th className="px-4 py-4 text-left w-10">
                                <button onClick={toggleSelectAll} className="text-white hover:text-blue-400 text-center">
                                    {selectedIds.length === filteredQuotes.length && filteredQuotes.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                                </button>
                            </th>
                            <th className="px-4 py-4 text-left text-[10px] font-semibold text-white tracking-normal">Fecha</th>
                            <th className="px-4 py-4 text-left text-[10px] font-semibold text-white tracking-normal">Tipo</th>
                            <th className="px-4 py-4 text-left text-[10px] font-semibold text-white tracking-normal">Cliente</th>
                            <th className="px-4 py-4 text-center text-[10px] font-semibold text-white tracking-normal">Disp.</th>
                            <th className="px-4 py-4 text-center text-[10px] font-semibold text-white tracking-normal">Mód.</th>
                            <th className="px-4 py-4 text-left text-[10px] font-semibold text-white tracking-normal">Material</th>
                            <th className="px-4 py-4 text-right text-[10px] font-semibold text-white tracking-normal">Total ARS</th>
                            <th className="px-4 py-4 text-center text-[10px] font-semibold text-white tracking-normal">Views</th>
                            <th className="px-4 py-4 text-right text-[10px] font-semibold text-white tracking-normal w-32">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {filteredQuotes.length === 0 && (
                            <tr>
                                <td colSpan={10} className="px-6 py-12 text-center text-gray-400 text-xs font-bold tracking-normal">
                                    NO HAY COTIZACIONES PARA ESTE FILTRO.
                                </td>
                            </tr>
                        )}
                        {filteredQuotes.map((quote) => {
                            const isExpanded = expandedId === quote.id;
                            const isSelected = selectedIds.includes(quote.id);
                            const config = quote.configuration || {};
                            const bom = Array.isArray(config) ? null : config.bom;
                            const hasBom = bom && Object.keys(bom).length > 0;
                            const modules = getModules(config);
                            const tipo = getTipo(quote);
                            const tipoMeta = TIPO_META[tipo];
                            const views = getViews(quote);
                            const device = getDevice(quote);
                            const deviceLast: DeviceKind | null = (quote.device_last_opened === 'desktop' || quote.device_last_opened === 'mobile' || quote.device_last_opened === 'tablet') ? quote.device_last_opened : null;
                            const lastOpened = quote.last_opened_at ? new Date(quote.last_opened_at) : null;

                            return (
                                <div key={quote.id} className="contents group">
                                    <tr className={`hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-gray-50' : ''} ${isSelected ? 'bg-blue-50' : ''}`}>
                                        <td className="px-4 py-5">
                                            <button onClick={() => toggleSelect(quote.id)} className="text-gray-900/20 hover:text-gray-900">
                                                {isSelected ? <CheckSquare size={16} className="text-gray-900" /> : <Square size={16} />}
                                            </button>
                                        </td>
                                        <td className="px-4 py-5 whitespace-nowrap text-xs font-semibold text-gray-900">
                                            {format(new Date(quote.created_at), "dd MMM yyyy HH:mm", { locale: es }).toUpperCase()}
                                        </td>
                                        <td className="px-4 py-5 whitespace-nowrap">
                                            <span className={`inline-block px-2 py-1 text-[9px] font-semibold tracking-normal border-2 ${tipoMeta.cls}`}>
                                                {tipoMeta.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-5 whitespace-nowrap text-xs font-semibold text-gray-900">
                                            {tipo === 'cliente' ? (quote.client_name || 'SIN NOMBRE') : '—'}
                                        </td>
                                        <td className="px-4 py-5 whitespace-nowrap text-center" title={device ? device.toUpperCase() : 'Desconocido'}>
                                            <span className="inline-flex justify-center text-gray-900">
                                                <DeviceIcon kind={device} />
                                            </span>
                                        </td>
                                        <td className="px-4 py-5 whitespace-nowrap text-center text-xs font-semibold text-gray-900">
                                            {modules.length || '—'}
                                        </td>
                                        <td className="px-4 py-5 whitespace-nowrap text-[10px] font-semibold text-gray-900 tracking-normal">
                                            {getMaterials(modules)}
                                        </td>
                                        <td className="px-4 py-5 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                                            ${Number(quote.total_price_ars || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                        </td>
                                        <td className="px-4 py-5 whitespace-nowrap text-center">
                                            <span
                                                className={`inline-flex items-center gap-1 text-xs font-semibold ${views > 0 ? 'text-gray-900' : 'text-gray-300'}`}
                                                title={lastOpened ? `Última apertura: ${format(lastOpened, "dd MMM yyyy HH:mm", { locale: es })}${deviceLast ? ' · ' + deviceLast : ''}` : 'Sin aperturas'}
                                            >
                                                <Eye size={12} strokeWidth={2.5} /> {views}
                                                {deviceLast && views > 0 && (
                                                    <span className="ml-1 text-gray-400"><DeviceIcon kind={deviceLast} size={11} /></span>
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-4 py-5 whitespace-nowrap text-right align-middle">
                                            <div className="flex justify-end gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => toggleExpand(quote.id)}
                                                    className={`p-2 border transition-colors ${isExpanded ? 'bg-gray-900 text-white border-gray-200' : 'text-gray-900 border-transparent hover:border-gray-300'}`}
                                                    title="Ver Partes"
                                                >
                                                    {isExpanded ? <ChevronUp size={16} strokeWidth={2.5} /> : <ChevronDown size={16} strokeWidth={2.5} />}
                                                </button>
                                                <Link
                                                    href={`/?quote=${quote.id}&admin=1`}
                                                    target="_blank"
                                                    className="text-gray-900 hover:text-indigo-600 inline-flex items-center gap-1 p-2 border border-transparent hover:border-gray-300 transition-colors"
                                                    title="Abrir en Configurador"
                                                >
                                                    <ExternalLink size={16} strokeWidth={2.5} />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(quote.id)}
                                                    className="text-gray-300 hover:text-red-600 p-2 border border-transparent hover:border-red-600 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={16} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr>
                                            <td colSpan={10} className="p-0 border-b border-gray-200">
                                                <div className="bg-white p-8 shadow-inner border-t border-gray-200">
                                                    <h4 className="text-lg font-semibold text-gray-900 tracking-tight flex items-center gap-3 mb-6 border-b border-gray-200 pb-2">
                                                        <Package size={20} strokeWidth={2.5} /> DESGLOSE DE PARTES
                                                    </h4>
                                                    {!hasBom ? (
                                                        <p className="text-xs font-bold text-gray-400 tracking-normal">Esta cotización antigua no tiene desglose de partes guardado.</p>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                            {Object.values(bom).map((item: any, idx) => (
                                                                <div key={idx} className="flex justify-between items-center p-4 bg-white border border-gray-200 hover:bg-gray-50 transition-colors group/item shadow-sm">
                                                                    <div className="flex flex-col text-left">
                                                                        <span className="text-xs font-semibold text-gray-900 group-hover/item:text-indigo-600 transition-colors">{item.name}</span>
                                                                        <span className="text-[10px] font-bold text-gray-500">UNIT: ${Number(item.unitCostARS).toLocaleString('es-AR')}</span>
                                                                    </div>
                                                                    <div className="text-right flex flex-col items-end">
                                                                        <div className="text-[10px] font-semibold bg-gray-900 text-white px-2 py-0.5 mb-1">x{item.quantity}</div>
                                                                        <div className="text-sm font-semibold text-gray-900">${Number(item.totalCostARS).toLocaleString('es-AR')}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
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
        </div>
    );
}
