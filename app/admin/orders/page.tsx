import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import OrdersGrid from "@/components/admin/OrdersGrid";
import { getUserRole, canViewPricing } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
    const supabase = await createClient();
    const role = await getUserRole();
    const showPricing = canViewPricing(role);

    const { data: orders } = await supabase
        .from("admin_orders")
        .select("*")
        .order("created_at", { ascending: false });

    return (
        <div className="space-y-6 pb-32">
            <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Pedidos</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Pedidos manuales y de WooCommerce
                    </p>
                </div>
                {showPricing && (
                    <Link
                        href="/admin/orders/new"
                        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors w-fit"
                    >
                        <Plus size={15} />
                        Nuevo pedido
                    </Link>
                )}
            </header>

            <OrdersGrid initialOrders={orders || []} showPricing={showPricing} />
        </div>
    );
}
