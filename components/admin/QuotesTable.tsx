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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total ARS</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {initialQuotes.length === 0 && (
                        <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                No hay cotizaciones guardadas aún.
                            </td>
                        </tr>
                    )}
                    {initialQuotes.map((quote) => {
                        const isExpanded = expandedId === quote.id;
                        const config = quote.configuration || {};
                        const bom = Array.isArray(config) ? null : config.bom;
                        const hasBom = bom && Object.keys(bom).length > 0;

                        return (
                            <>
                                <tr key={quote.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-400">
                                        {quote.id.split('-')[0]}...
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {format(new Date(quote.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {quote.client_name || "Sin Nombre"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                                        ${Number(quote.total_price_ars || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                        <button
                                            onClick={() => toggleExpand(quote.id)}
                                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors ${isExpanded ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                            title="Ver Partes"
                                        >
                                            <Package size={14} />
                                            Detalle
                                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </button>
                                        <Link
                                            href={`/?quote=${quote.id}`}
                                            target="_blank"
                                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1.5 rounded-md transition-colors"
                                        >
                                            <ExternalLink size={14} />
                                            Abrir 3D
                                        </Link>
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr className="bg-gray-50">
                                        <td colSpan={5} className="px-6 py-4">
                                            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-inner">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <Package size={12} /> Desglose de Partes
                                                </h4>
                                                {!hasBom ? (
                                                    <p className="text-sm text-gray-400 italic">Esta cotización antigua no tiene desglose de partes guardado.</p>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        {Object.values(bom).map((item: any, idx) => (
                                                            <div key={idx} className="flex justify-between items-center p-2 border-b border-gray-100 text-sm">
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold text-gray-800">{item.name}</span>
                                                                    <span className="text-xs text-gray-400">Unit: ${item.unitCostARS.toLocaleString('es-AR')}</span>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs inline-block mb-1">x{item.quantity}</div>
                                                                    <div className="font-bold text-gray-900">${item.totalCostARS.toLocaleString('es-AR')}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
