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
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Órdenes</h1>
                <Link
                    href="/admin/orders/new"
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 font-medium transition-colors"
                >
                    <Plus size={20} />
                    Crear Orden
                </Link>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Canal</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Abonado / Total</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Recibo</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {orders?.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                    No hay órdenes registradas.
                                </td>
                            </tr>
                        )}
                        {orders?.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {format(new Date(order.created_at), "dd MMM yyyy", { locale: es })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{order.client_name}</div>
                                    <div className="text-sm text-gray-500">{order.client_whatsapp}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                    {order.channel}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${order.status === 'paid' ? 'bg-green-100 text-green-800' :
                                            order.status === 'partially_paid' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'}`}>
                                        {order.status === 'paid' ? 'Pagado' : order.status === 'partially_paid' ? 'Parcial' : 'Pendiente'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                    <div className="font-medium text-gray-900">
                                        ${Number(order.final_amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </div>
                                    {order.status !== 'paid' && order.paid_amount > 0 && (
                                        <div className="text-xs text-orange-600 font-medium">
                                            Abonado: ${Number(order.paid_amount).toLocaleString('es-AR')}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <Link
                                        href={`/api/orders/${order.id}/pdf`}
                                        target="_blank"
                                        className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                                        title="Descargar Recibo"
                                    >
                                        <Download size={18} />
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
