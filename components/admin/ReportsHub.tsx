"use client";

import { useState } from "react";
import { ArrowLeft, BarChart3, Boxes, ChevronRight } from "lucide-react";
import ReportsView from "@/components/admin/ReportsView";
import StockReport from "@/components/admin/StockReport";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ReportsHub({ orders }: { orders: any[] }) {
    const [selected, setSelected] = useState<"general" | "stock" | null>(null);

    if (selected) {
        const meta = selected === "general"
            ? { title: "Facturación y cobranzas", subtitle: "Ingresos, cobros y descuentos por período" }
            : { title: "Stock de piezas · pedidos pendientes", subtitle: "Piezas a producir según los pedidos pendientes de entregar" };
        return (
            <div className="space-y-6 pb-32">
                <button onClick={() => setSelected(null)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">
                    <ArrowLeft size={16} strokeWidth={2.5} /> Elegir otro informe
                </button>
                <header>
                    <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{meta.title}</h1>
                    <p className="text-sm text-gray-500 mt-1">{meta.subtitle}</p>
                </header>
                {selected === "general" ? <ReportsView orders={orders} /> : <StockReport />}
            </div>
        );
    }

    const cards = [
        {
            key: "general" as const,
            icon: BarChart3,
            title: "Informe general",
            desc: "Facturación, cobranzas y descuentos. Filtrable por período.",
        },
        {
            key: "stock" as const,
            icon: Boxes,
            title: "Stock de piezas",
            desc: "Qué piezas necesito para armar los pedidos pendientes de entregar. Dinámico y con desglose de paneles por color.",
        },
    ];

    return (
        <div className="space-y-6 pb-32">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Informes</h1>
                <p className="text-sm text-gray-500 mt-1">Elegí qué informe querés ver</p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
                {cards.map(c => (
                    <button key={c.key} onClick={() => setSelected(c.key)}
                        className="group text-left bg-white border border-gray-200 p-7 hover:border-gray-900 hover:shadow-lg transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-gray-900 text-white group-hover:bg-indigo-600 transition-colors">
                                <c.icon size={22} strokeWidth={2.2} />
                            </div>
                            <ChevronRight size={20} className="text-gray-300 group-hover:text-gray-900 transition-colors" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900 tracking-tight">{c.title}</h2>
                        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{c.desc}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}
