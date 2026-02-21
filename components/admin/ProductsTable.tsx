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
        <div className="bg-[#ebecdf]/50 rounded-2xl shadow-xl border border-[#354763]/10 overflow-hidden">
            <table className="min-w-full divide-y divide-[#354763]/10">
                <thead className="bg-[#354763]">
                    <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-bold text-white uppercase tracking-widest">Nombre / SKU</th>
                        <th className="px-6 py-4 text-left text-[10px] font-bold text-white uppercase tracking-widest">Módulos</th>
                        <th className="px-6 py-4 text-right text-[10px] font-bold text-white uppercase tracking-widest">Costo Act.</th>
                        <th className="px-6 py-4 text-right text-[10px] font-bold text-white uppercase tracking-widest opacity-80">PVP Lista</th>
                        <th className="px-6 py-4 text-right text-[10px] font-bold text-[#aab799] uppercase tracking-widest bg-white/5">Transf. (-10%)</th>
                        <th className="px-6 py-4 text-right text-[10px] font-bold text-[#aab799] uppercase tracking-widest bg-white/10">Efectivo (-20%)</th>
                        <th className="px-6 py-4 text-right text-[10px] font-bold text-white uppercase tracking-widest">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#354763]/5">
                    {productDetails.length === 0 && (
                        <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-[#354763]/40 italic font-medium">
                                No hay productos preconfigurados aún.
                            </td>
                        </tr>
                    )}
                    {productDetails.map((product) => {
                        const isExpanded = expandedId === product.id;
                        const { pricing } = product;
                        const bomItems = Object.values(pricing.bomSummary);

                        return (
                            <div key={product.id} className="contents">
                                <tr className="hover:bg-white transition-colors group">
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <div className="text-sm font-bold text-[#354763]">{product.name}</div>
                                        <div className="text-[10px] font-mono font-bold text-[#354763]/30 tracking-wider">
                                            {product.sku || product.id.split('-')[0]}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <span className="bg-[#354763]/5 text-[#354763] px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                            {product.modules.length} modules
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-sm text-right font-medium text-[#354763]/60">
                                        ${pricing.totalCost.toLocaleString('es-AR')}
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-sm text-right font-bold text-[#354763]/40 italic">
                                        ${pricing.totalPrice.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-sm text-right font-black text-[#354763] bg-[#354763]/5">
                                        ${(pricing.totalPrice * 0.9).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-sm text-right font-black text-[#aab799] bg-[#aab799]/5">
                                        ${(pricing.totalPrice * 0.8).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                        <button
                                            onClick={() => toggleExpand(product.id)}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[10px] tracking-widest uppercase transition-all ${isExpanded ? 'bg-[#354763] text-white shadow-lg shadow-[#354763]/20' : 'bg-white text-[#354763] border border-[#354763]/10 hover:border-[#354763]/30'
                                                }`}
                                        >
                                            <Package size={12} />
                                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        </button>
                                        <Link
                                            href={`/?quote=${product.id}&admin=true`}
                                            target="_blank"
                                            className="inline-flex items-center gap-1.5 bg-[#aab799] text-white px-3 py-1.5 rounded-lg font-bold text-[10px] tracking-widest uppercase hover:bg-[#99a688] transition-all shadow-lg shadow-[#aab799]/10"
                                        >
                                            <ExternalLink size={12} />
                                            3D
                                        </Link>
                                        <button
                                            className="inline-flex items-center gap-1.5 text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg transition-all group-hover:opacity-100 opacity-20"
                                            onClick={() => {/* TODO: Delete logic */ }}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr className="bg-white/50">
                                        <td colSpan={7} className="px-6 py-6 font-sans">
                                            <div className="bg-white p-6 rounded-2xl border border-[#354763]/10 shadow-inner">
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                                    <div className="bg-[#354763] p-4 rounded-2xl shadow-lg border border-white/10">
                                                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-1">ROAS Break-Even</span>
                                                        <span className="text-xl font-black text-white italic">{pricing.metrics.roasBreakEven.toFixed(2)}</span>
                                                    </div>
                                                    <div className="bg-[#aab799] p-4 rounded-2xl shadow-lg border border-white/10">
                                                        <span className="text-[10px] font-black text-[#354763]/40 uppercase tracking-widest block mb-1">ROAS Target (70%)</span>
                                                        <span className="text-xl font-black text-[#354763] italic">{pricing.metrics.roasTarget.toFixed(2)}</span>
                                                    </div>
                                                    <div className="bg-white p-4 rounded-2xl border border-[#354763]/10">
                                                        <span className="text-[10px] font-black text-[#354763]/40 uppercase tracking-widest block mb-1">Utilidad Bruta</span>
                                                        <span className="text-xl font-black text-[#354763]">${pricing.metrics.grossProfit.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                                                    </div>
                                                    <div className="bg-white p-4 rounded-2xl border border-[#354763]/10">
                                                        <span className="text-[10px] font-black text-[#354763]/40 uppercase tracking-widest block mb-1">Recaudación Real</span>
                                                        <span className="text-xl font-black text-[#354763]">${pricing.metrics.realRevenue.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                                                    </div>
                                                </div>

                                                <div className="flex justify-between items-center mb-6">
                                                    <h4 className="text-[10px] font-bold text-[#354763]/40 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <Tag size={12} className="text-[#aab799]" /> Desglose de Partes Actualizado
                                                    </h4>
                                                    <div className="text-[10px] text-[#354763]/30 font-bold tracking-wider italic">
                                                        Sincronizado con costos actuales
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                    {bomItems.map((item: any, idx) => (
                                                        <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-[#ebecdf]/20 border border-transparent hover:border-[#354763]/5 transition-all">
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-xs font-bold text-[#354763]">{item.name}</span>
                                                                <span className="text-[10px] font-bold text-[#354763]/30">${item.unitCostARS.toLocaleString('es-AR')} c/u</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-[10px] font-black bg-[#354763] text-white px-2 py-0.5 rounded-md inline-block mb-1">x{item.quantity}</div>
                                                                <div className="text-xs font-black text-[#354763]">${item.totalCostARS.toLocaleString('es-AR')}</div>
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
