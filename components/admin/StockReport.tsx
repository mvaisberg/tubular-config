"use client";

import { useEffect, useState } from "react";
import { Boxes, RefreshCw, AlertTriangle, Package, Paintbrush } from "lucide-react";

interface Piece { sku: string; name: string; quantity: number; }
interface ColorLine { color: string; quantity: number; }
interface Unmatched { description: string; quantity: number; order: string; }
interface StockData {
    pendingOrders: number;
    matchedOrders: number;
    pieces: Piece[];
    panelsByColor: ColorLine[];
    unmatched: Unmatched[];
}

export default function StockReport() {
    const [data, setData] = useState<StockData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = () => {
        setLoading(true);
        setError(null);
        fetch("/configurador/api/reports/stock", { cache: "no-store" })
            .then(async r => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Error ${r.status}`);
                return r.json();
            })
            .then(setData)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    };
    useEffect(load, []);

    const exportCSV = () => {
        if (!data) return;
        const rows = [["Pieza", "SKU", "Cantidad"], ...data.pieces.map(p => [p.name, p.sku, String(p.quantity)])];
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "stock-piezas-pendientes.csv";
        a.click();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1.5 bg-gray-900 text-white px-3 py-1.5 font-semibold">
                        <Package size={15} strokeWidth={2.5} /> {data?.pendingOrders ?? "—"} pedidos pendientes
                    </span>
                    {data && data.matchedOrders < data.pendingOrders && (
                        <span className="text-amber-600 font-medium">
                            {data.matchedOrders} con receta · {data.pendingOrders - data.matchedOrders} sin config vinculada
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    <button onClick={exportCSV} disabled={!data || !data.pieces.length}
                        className="flex items-center gap-2 border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-40">
                        Exportar CSV
                    </button>
                    <button onClick={load} disabled={loading}
                        className="flex items-center gap-2 bg-gray-900 text-white px-3 py-2 text-sm font-semibold hover:bg-indigo-600 disabled:opacity-40">
                        <RefreshCw size={15} strokeWidth={2.5} className={loading ? "animate-spin" : ""} /> Actualizar
                    </button>
                </div>
            </div>

            {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            {loading && !data && <div className="p-12 text-center text-gray-400 text-sm">Calculando piezas…</div>}

            {data && (
                <>
                    {/* Piezas totales */}
                    <div className="bg-white border border-gray-200">
                        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200 bg-black text-white">
                            <Boxes size={18} strokeWidth={2.5} />
                            <h3 className="text-sm font-semibold tracking-tight">PIEZAS TOTALES A PRODUCIR</h3>
                        </div>
                        {data.pieces.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">No hay piezas — ningún pedido pendiente tiene config resoluble.</div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                {data.pieces.map(p => (
                                    <div key={p.sku} className="flex justify-between items-center px-6 py-4 border-b border-r border-gray-100">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                                            <span className="text-[10px] font-bold text-gray-400">{p.sku}</span>
                                        </div>
                                        <span className="text-lg font-bold tabular-nums text-indigo-600">{p.quantity.toLocaleString("es-AR")}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Paneles por color */}
                    {data.panelsByColor.length > 0 && (
                        <div className="bg-white border border-gray-200">
                            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200">
                                <Paintbrush size={18} strokeWidth={2.5} className="text-gray-700" />
                                <h3 className="text-sm font-semibold tracking-tight text-gray-900">PANELES / ESTANTES POR COLOR</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                {data.panelsByColor.map(c => (
                                    <div key={c.color} className="flex justify-between items-center px-6 py-4 border-b border-r border-gray-100">
                                        <span className="text-sm font-medium text-gray-700">{c.color}</span>
                                        <span className="text-lg font-bold tabular-nums text-gray-900">{c.quantity.toLocaleString("es-AR")}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Sin config vinculada */}
                    {data.unmatched.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200">
                            <div className="flex items-center gap-2 px-6 py-4 border-b border-amber-200">
                                <AlertTriangle size={18} strokeWidth={2.5} className="text-amber-600" />
                                <h3 className="text-sm font-semibold tracking-tight text-amber-800">
                                    LÍNEAS SIN CONFIG VINCULADA ({data.unmatched.length}) — no suman piezas
                                </h3>
                            </div>
                            <div className="divide-y divide-amber-100">
                                {data.unmatched.map((u, i) => (
                                    <div key={i} className="flex justify-between items-center px-6 py-3 text-sm">
                                        <span className="text-gray-700">{u.description} <span className="text-gray-400">· pedido {u.order}</span></span>
                                        <span className="font-semibold text-gray-500">x{u.quantity}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="px-6 py-3 text-[11px] text-amber-700 border-t border-amber-200">
                                Vinculá estos productos a una config en <b>Productos</b> para que sumen al informe.
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
