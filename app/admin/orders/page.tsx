import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import OrdersTable from "@/components/admin/OrdersTable";

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

            <OrdersTable initialOrders={orders || []} />
        </div>
    );
}
