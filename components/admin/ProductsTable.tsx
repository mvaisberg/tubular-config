"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink, Package, Tag, Trash2 } from "lucide-react";
import { calculatePricing, Settings } from "@/lib/pricing";

interface ProductsTableProps {
    initialProducts: any[];
    partsData: any[];
    settings: Settings;
}

export default function ProductsTable({ initialProducts, partsData, settings }: ProductsTableProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const productDetails = useMemo(() => {
        return initialProducts.map(product => {
            const config = product.configuration || [];
            // Assuming configuration is the array of modules
            const modules = Array.isArray(config) ? config : (config.modules || []);
            const pricing = calculatePricing(modules, partsData, settings);
            return {
                ...product,
                pricing,
                modules
            };
        });
    }, [initialProducts, partsData, settings]);

    return (
        <div className="overflow-x-auto bg-white border border-black shadow-[8px_8px_0px_#000]">
            <table className="min-w-full divide-y divide-black">
                <thead className="bg-black">
                    <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em]">Nombre / SKU</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em]">Módulos</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-[0.2em]">Costo Act.</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-[0.2em] opacity-80">PVP Lista</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-blue-200 uppercase tracking-[0.2em] bg-white/5">Transf. (-10%)</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-blue-200 uppercase tracking-[0.2em] bg-white/10">Efectivo (-20%)</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-[0.2em] w-32">Acciones</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-black/20">
                    {productDetails.length === 0 && (
                        <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-black/40 text-xs font-bold uppercase tracking-widest">
                                NO HAY PRODUCTOS PRECONFIGURADOS AÚN.
                            </td>
                        </tr>
                    )}
                    {productDetails.map((product) => {
                        const isExpanded = expandedId === product.id;
                        const { pricing } = product;
                        const bomItems = Object.values(pricing.bomSummary);

                        return (
                            <div key={product.id} className="contents group">
                                <tr className={`hover:bg-black/5 transition-colors ${isExpanded ? 'bg-black/5' : ''}`}>
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <div className="text-sm font-black text-black uppercase">{product.name}</div>
                                        <div className="text-[10px] font-bold text-black/50 tracking-widest uppercase mt-1">
                                            {product.sku || product.id.split('-')[0]}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <span className="bg-black text-white px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-black shadow-[2px_2px_0px_#000]">
                                            {product.modules.length} MÓDULOS
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-xs text-right font-bold text-black/60">
                                        ${Math.round(pricing.totalCost).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-xs text-right font-bold text-black/40 line-through">
                                        ${Math.round(pricing.totalPrice).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-xs text-right font-black text-black bg-black/5">
                                        ${Math.round(pricing.totalPrice * 0.9).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-sm text-right font-black text-white bg-blue-600 border-l border-r border-black">
                                        ${Math.round(pricing.totalPrice * 0.8).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-right align-middle">
                                        <div className="flex justify-end gap-2 items-center">
                                            <button
                                                onClick={() => toggleExpand(product.id)}
                                                className={`p-2 border transition-colors ${isExpanded ? 'bg-black text-white border-black' : 'text-black border-transparent hover:border-black'}`}
                                            >
                                                {isExpanded ? <ChevronUp size={16} strokeWidth={2.5} /> : <ChevronDown size={16} strokeWidth={2.5} />}
                                            </button>
                                            <Link
                                                href={`/?quote=${product.id}&admin=true`}
                                                target="_blank"
                                                className="p-2 text-black border border-transparent hover:border-black hover:text-blue-600 transition-colors"
                                            >
                                                <ExternalLink size={16} strokeWidth={2.5} />
                                            </Link>
                                            <button
                                                className="p-2 text-black/30 border border-transparent hover:border-red-600 hover:text-red-600 transition-colors"
                                                onClick={() => {/* TODO: Delete logic */ }}
                                            >
                                                <Trash2 size={16} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr>
                                        <td colSpan={7} className="p-0 border-b-2 border-black">
                                            <div className="bg-white p-8 lg:p-12 shadow-inner border-t-2 border-black">
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                                                    <div className="bg-black text-white p-6 border-2 border-black shadow-[4px_4px_0px_#000]">
                                                        <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] block mb-2 border-b border-white/20 pb-2">ROAS Break-Even</span>
                                                        <span className="text-3xl font-black">{pricing.metrics.roasBreakEven.toFixed(2)}</span>
                                                    </div>
                                                    <div className="bg-blue-600 text-white p-6 border-2 border-black shadow-[4px_4px_0px_#000]">
                                                        <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] block mb-2 border-b border-white/20 pb-2">ROAS Target (70%)</span>
                                                        <span className="text-3xl font-black">{pricing.metrics.roasTarget.toFixed(2)}</span>
                                                    </div>
                                                    <div className="bg-white p-6 border-2 border-black shadow-[4px_4px_0px_#000]">
                                                        <span className="text-[10px] font-black text-black/50 uppercase tracking-[0.2em] block mb-2 border-b border-black/20 pb-2">Utilidad Bruta</span>
                                                        <span className="text-2xl font-black">${Math.round(pricing.metrics.grossProfit).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                                    </div>
                                                    <div className="bg-white p-6 border-2 border-black shadow-[4px_4px_0px_#000]">
                                                        <span className="text-[10px] font-black text-black/50 uppercase tracking-[0.2em] block mb-2 border-b border-black/20 pb-2">Recaudación Real</span>
                                                        <span className="text-2xl font-black text-blue-600">${Math.round(pricing.metrics.realRevenue).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                                    </div>
                                                </div>

                                                <div className="flex justify-between items-end mb-6 border-b-2 border-black pb-2">
                                                    <h4 className="text-lg font-black text-black uppercase tracking-tight flex items-center gap-3">
                                                        <Tag size={20} strokeWidth={2.5} /> DESGLOSE DE PARTES
                                                    </h4>
                                                    <div className="text-[10px] text-black/50 font-bold uppercase tracking-widest hidden sm:block">
                                                        SINCRONIZADO CON COSTOS ACTUALES
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                    {bomItems.map((item: any, idx) => (
                                                        <div key={idx} className="flex justify-between items-center p-4 bg-white border-2 border-black hover:bg-black/5 transition-colors group/item">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-black text-black uppercase group-hover/item:text-blue-600 transition-colors">{item.name}</span>
                                                                <span className="text-[10px] font-bold text-black/50 uppercase">${Math.round(item.unitCostARS).toLocaleString('es-AR', { maximumFractionDigits: 0 })} C/U</span>
                                                            </div>
                                                            <div className="text-right flex flex-col items-end">
                                                                <div className="text-[10px] font-black bg-black text-white px-2 py-0.5 mb-1">x{item.quantity}</div>
                                                                <div className="text-sm font-black text-black">${Math.round(item.totalCostARS).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
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
