import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OrderForm, type OrderFormInitial } from "@/components/admin/OrderForm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: order } = await supabase
        .from("admin_orders")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    if (!order) notFound();

    const initial: OrderFormInitial = {
        id: order.id,
        client_name: order.client_name,
        client_whatsapp: order.client_whatsapp,
        observations: order.observations,
        shipping_type: order.shipping_type,
        shipping_address: order.shipping_address,
        items: order.items,
        payment_method: order.payment_method,
        discount_percentage: order.discount_percentage,
        status: order.status,
        paid_amount: order.paid_amount,
    };

    return (
        <div className="max-w-3xl space-y-6 pb-32">
            <header className="flex items-center gap-3">
                <Link href="/admin/orders" className="p-2 text-gray-400 hover:text-gray-900 hover:bg-white border border-gray-200 rounded-md transition-colors">
                    <ArrowLeft size={18} />
                </Link>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Editar pedido</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {order.order_number ? (
                            <>
                                <span className="font-medium text-gray-700 tabular-nums">{`TUB-${String(order.order_number).padStart(4, "0")}`}</span>
                                <span className="mx-1.5">·</span>
                            </>
                        ) : null}
                        {order.client_name}
                    </p>
                </div>
            </header>

            <OrderForm mode="edit" initial={initial} />
        </div>
    );
}
