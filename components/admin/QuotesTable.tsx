"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink, Package } from "lucide-react";

interface QuotesTableProps {
    quotes: any[];
}

export default function QuotesTable({ quotes: initialQuotes }: QuotesTableProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="overflow-x-auto bg-white border border-black shadow-[8px_8px_0px_#000]">
            <table className="min-w-full divide-y divide-black">
                <thead className="bg-black">
                    <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em]">ID</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em]">Fecha</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em]">Cliente</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-[0.2em]">Total ARS</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-[0.2em] w-32">Acciones</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-black/20">
                    {initialQuotes.length === 0 && (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-black/40 text-xs font-bold uppercase tracking-widest">
                                NO HAY COTIZACIONES GUARDADAS AÚN.
                            </td>
                        </tr>
                    )}
                    {initialQuotes.map((quote) => {
                        const isExpanded = expandedId === quote.id;
                        const config = quote.configuration || {};
                        const bom = Array.isArray(config) ? null : config.bom;
                        const hasBom = bom && Object.keys(bom).length > 0;

                        return (
                            <div key={quote.id} className="contents group">
                                <tr className={`hover:bg-black/5 transition-colors ${isExpanded ? 'bg-black/5' : ''}`}>
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
                                        <div className="flex justify-end gap-2 items-center">
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
                                            >
                                                <ExternalLink size={16} strokeWidth={2.5} />
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr>
                                        <td colSpan={5} className="p-0 border-b-2 border-black">
                                            <div className="bg-white p-8 shadow-inner border-t-2 border-black">
                                                <h4 className="text-lg font-black text-black uppercase tracking-tight flex items-center gap-3 mb-6 border-b-2 border-black pb-2">
                                                    <Package size={20} strokeWidth={2.5} /> DESGLOSE DE PARTES
                                                </h4>
                                                {!hasBom ? (
                                                    <p className="text-xs font-bold text-black/40 uppercase tracking-widest">Esta cotización antigua no tiene desglose de partes guardado.</p>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                        {Object.values(bom).map((item: any, idx) => (
                                                            <div key={idx} className="flex justify-between items-center p-4 bg-white border-2 border-black hover:bg-black/5 transition-colors group/item">
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-black text-black uppercase group-hover/item:text-blue-600 transition-colors">{item.name}</span>
                                                                    <span className="text-[10px] font-bold text-black/50 uppercase">UNIT: ${item.unitCostARS.toLocaleString('es-AR')}</span>
                                                                </div>
                                                                <div className="text-right flex flex-col items-end">
                                                                    <div className="text-[10px] font-black bg-black text-white px-2 py-0.5 mb-1">x{item.quantity}</div>
                                                                    <div className="text-sm font-black text-black">${item.totalCostARS.toLocaleString('es-AR')}</div>
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
    );
}
