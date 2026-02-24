"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { ChevronDown, ChevronUp, Download, Trash2, CheckSquare, Square } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface OrdersTableProps {
    initialOrders: any[];
}

export default function OrdersTable({ initialOrders: initialData }: OrdersTableProps) {
    const router = useRouter();
    const supabase = createClient();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [orders, setOrders] = useState(initialData);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === orders.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(orders.map(o => o.id));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar esta orden?")) return;

        const { error } = await supabase.from("admin_orders").delete().eq("id", id);
        if (error) {
            alert("Error: " + error.message);
        } else {
            setOrders(orders.filter(o => o.id !== id));
            setSelectedIds(selectedIds.filter(i => i !== id));
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`¿Estás seguro de eliminar ${selectedIds.length} órdenes?`)) return;

        const { error } = await supabase.from("admin_orders").delete().in("id", selectedIds);
        if (error) {
            alert("Error: " + error.message);
        } else {
            setOrders(orders.filter(o => !selectedIds.includes(o.id)));
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
                                <button onClick={toggleSelectAll} className="text-white hover:text-blue-400">
                                    {selectedIds.length === orders.length && orders.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                                </button>
                            </th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em]">Fecha</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em]">Cliente</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em]">Canal</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em]">Estado</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-[0.2em]">Total / Abonado</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-[0.2em] w-32">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-black/20">
                        {orders.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-black/40 text-xs font-bold uppercase tracking-widest">
                                    NO HAY ÓRDENES REGISTRADAS.
                                </td>
                            </tr>
                        )}
                        {orders.map((order) => {
                            const isSelected = selectedIds.includes(order.id);
                            return (
                                <tr key={order.id} className={`hover:bg-black/5 transition-colors group ${isSelected ? 'bg-blue-50' : ''}`}>
                                    <td className="px-6 py-5">
                                        <button onClick={() => toggleSelect(order.id)} className="text-black/20 hover:text-black">
                                            {isSelected ? <CheckSquare size={16} className="text-black" /> : <Square size={16} />}
                                        </button>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-xs font-black text-black">
                                        {format(new Date(order.created_at), "dd MMM yyyy", { locale: es }).toUpperCase()}
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <div className="text-sm font-black text-black uppercase">{order.client_name}</div>
                                        <div className="text-[10px] font-bold text-black/50 tracking-widest mt-1">{order.client_whatsapp}</div>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-xs font-black text-black/60 uppercase tracking-widest">
                                        {order.channel}
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-sm">
                                        <span className={`px-2 py-1 inline-flex text-[10px] font-black uppercase tracking-widest border border-black shadow-[2px_2px_0px_#000]
                                            ${order.status === 'paid' ? 'bg-black text-white' :
                                                order.status === 'partially_paid' ? 'bg-blue-600 text-white' :
                                                    'bg-white text-black'}`}>
                                            {order.status === 'paid' ? 'PAGADO' : order.status === 'partially_paid' ? 'PARCIAL' : 'PENDIENTE'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-sm text-right">
                                        <div className="font-black text-black text-sm">
                                            ${Number(order.final_amount).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                        </div>
                                        {order.status !== 'paid' && (order.paid_amount || 0) > 0 && (
                                            <div className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-1">
                                                ABONADO: ${Number(order.paid_amount).toLocaleString('es-AR')}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Link
                                                href={`/api/orders/${order.id}/pdf`}
                                                target="_blank"
                                                className="text-black hover:text-blue-600 inline-flex items-center gap-1 p-2 border border-transparent hover:border-black transition-colors"
                                                title="Descargar Recibo"
                                            >
                                                <Download size={16} strokeWidth={2.5} />
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(order.id)}
                                                className="text-black/30 hover:text-red-600 p-2 border border-transparent hover:border-red-600 transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
