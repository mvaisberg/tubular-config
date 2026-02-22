import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Download } from "lucide-react";

export default async function OrdersPage() {
    const supabase = await createClient();
    const { data: orders } = await supabase
        .from("admin_orders")
        .select("*")
        .order("created_at", { ascending: false });

    return (
        <div className="max-w-6xl space-y-8 pb-32">
            <header className="mb-12 border-b border-black pb-4 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black tracking-tight uppercase">Órdenes</h1>
                    <p className="text-black/60 text-xs font-bold uppercase tracking-widest mt-1">Gestión de recibos y cobros</p>
                </div>
                <Link
                    href="/admin/orders/new"
                    className="flex items-center gap-2 bg-black text-white px-4 py-3 text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-colors shadow-[4px_4px_0px_#000]"
                >
                    <Plus size={14} strokeWidth={2.5} />
                    CREAR ORDEN
                </Link>
            </header>

            <div className="overflow-x-auto bg-white border border-black shadow-[8px_8px_0px_#000]">
                <table className="min-w-full divide-y divide-black">
                    <thead className="bg-black">
                        <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em]">Fecha</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em]">Cliente</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em]">Canal</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-[0.2em]">Estado</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-[0.2em]">Total / Abonado</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-[0.2em]">Recibo</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-black/20">
                        {(!orders || orders.length === 0) && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-black/40 text-xs font-bold uppercase tracking-widest">
                                    NO HAY ÓRDENES REGISTRADAS.
                                </td>
                            </tr>
                        )}
                        {orders?.map((order) => (
                            <tr key={order.id} className="hover:bg-black/5 transition-colors group">
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
                                    {order.status !== 'paid' && order.paid_amount > 0 && (
                                        <div className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-1">
                                            ABONADO: ${Number(order.paid_amount).toLocaleString('es-AR')}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                                    <Link
                                        href={`/api/orders/${order.id}/pdf`}
                                        target="_blank"
                                        className="text-black hover:text-blue-600 inline-flex items-center gap-1 p-2 border border-transparent hover:border-black transition-colors"
                                        title="Descargar Recibo"
                                    >
                                        <Download size={16} strokeWidth={2.5} />
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
