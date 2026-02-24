"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink, Package, Trash2, CheckSquare, Square } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface QuotesTableProps {
    quotes: any[];
}

export default function QuotesTable({ quotes: initialQuotes }: QuotesTableProps) {
    const [quotes, setQuotes] = useState(initialQuotes);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const supabase = createClient();

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === quotes.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(quotes.map(q => q.id));
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

    return (
        <div className="space-y-4">
            {selectedIds.length > 0 && (
                <div className="flex justify-between items-center bg-blue-50 border-2 border-black p-4 shadow-[4px_4px_0px_#000] animate-in fade-in slide-in-from-top-2">
                    <span className="text-xs font-black uppercase tracking-widest text-black">
                        {selectedIds.length} SELECCIONADOS
                    </span>
                    <button
                        onClick={handleBulkDelete}
                        className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors"
                    >
                        <Trash2 size={14} /> ELIMINAR SELECCIONADOS
                    </button>
                </div>
            )}

            <div className="overflow-x-auto bg-white border border-black shadow-[8px_8px_0px_#000]">
                <table className="min-w-full divide-y divide-black">
                    <thead className="bg-black">
                        <tr>
                            <th className="px-6 py-4 text-left w-10">
                                <button onClick={toggleSelectAll} className="text-white hover:text-blue-400 text-center">
                                    {selectedIds.length === quotes.length && quotes.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                                </button>
                            </th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em]">ID</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em]">Fecha</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em]">Cliente</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-[0.2em]">Total ARS</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-[0.2em] w-32">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-black/20">
                        {quotes.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-black/40 text-xs font-bold uppercase tracking-widest">
                                    NO HAY COTIZACIONES GUARDADAS AÚN.
                                </td>
                            </tr>
                        )}
                        {quotes.map((quote) => {
                            const isExpanded = expandedId === quote.id;
                            const isSelected = selectedIds.includes(quote.id);
                            const config = quote.configuration || {};
                            const bom = Array.isArray(config) ? null : config.bom;
                            const hasBom = bom && Object.keys(bom).length > 0;

                            return (
                                <div key={quote.id} className="contents group">
                                    <tr className={`hover:bg-black/5 transition-colors ${isExpanded ? 'bg-black/5' : ''} ${isSelected ? 'bg-blue-50' : ''}`}>
                                        <td className="px-6 py-5">
                                            <button onClick={() => toggleSelect(quote.id)} className="text-black/20 hover:text-black">
                                                {isSelected ? <CheckSquare size={16} className="text-black" /> : <Square size={16} />}
                                            </button>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-[10px] font-bold text-black/40 uppercase tracking-widest">
                                            {quote.id.split('-')[0]}...
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-xs font-black text-black uppercase">
                                            {format(new Date(quote.created_at), "dd MMM yyyy HH:mm", { locale: es }).toUpperCase()}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-xs font-black text-black uppercase">
                                            {quote.client_name || "SIN NOMBRE"}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-sm text-right font-black text-black">
                                            ${Number(quote.total_price_ars || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-right align-middle">
                                            <div className="flex justify-end gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => toggleExpand(quote.id)}
                                                    className={`p-2 border transition-colors ${isExpanded ? 'bg-black text-white border-black' : 'text-black border-transparent hover:border-black'}`}
                                                    title="Ver Partes"
                                                >
                                                    {isExpanded ? <ChevronUp size={16} strokeWidth={2.5} /> : <ChevronDown size={16} strokeWidth={2.5} />}
                                                </button>
                                                <Link
                                                    href={`/?quote=${quote.id}`}
                                                    target="_blank"
                                                    className="text-black hover:text-blue-600 inline-flex items-center gap-1 p-2 border border-transparent hover:border-black transition-colors"
                                                    title="Abrir en Configurador"
                                                >
                                                    <ExternalLink size={16} strokeWidth={2.5} />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(quote.id)}
                                                    className="text-black/30 hover:text-red-600 p-2 border border-transparent hover:border-red-600 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={16} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr>
                                            <td colSpan={6} className="p-0 border-b-2 border-black">
                                                <div className="bg-white p-8 shadow-inner border-t-2 border-black">
                                                    <h4 className="text-lg font-black text-black uppercase tracking-tight flex items-center gap-3 mb-6 border-b-2 border-black pb-2">
                                                        <Package size={20} strokeWidth={2.5} /> DESGLOSE DE PARTES
                                                    </h4>
                                                    {!hasBom ? (
                                                        <p className="text-xs font-bold text-black/40 uppercase tracking-widest">Esta cotización antigua no tiene desglose de partes guardado.</p>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                            {Object.values(bom).map((item: any, idx) => (
                                                                <div key={idx} className="flex justify-between items-center p-4 bg-white border-2 border-black hover:bg-black/5 transition-colors group/item shadow-[2px_2px_0px_#000]">
                                                                    <div className="flex flex-col text-left">
                                                                        <span className="text-xs font-black text-black uppercase group-hover/item:text-blue-600 transition-colors">{item.name}</span>
                                                                        <span className="text-[10px] font-bold text-black/50 uppercase">UNIT: ${Number(item.unitCostARS).toLocaleString('es-AR')}</span>
                                                                    </div>
                                                                    <div className="text-right flex flex-col items-end">
                                                                        <div className="text-[10px] font-black bg-black text-white px-2 py-0.5 mb-1">x{item.quantity}</div>
                                                                        <div className="text-sm font-black text-black">${Number(item.totalCostARS).toLocaleString('es-AR')}</div>
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
