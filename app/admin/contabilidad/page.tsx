import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import ContabilidadView from "@/components/admin/ContabilidadView";

export const dynamic = "force-dynamic";

export default async function ContabilidadPage() {
    const role = await getUserRole();
    if (role !== "admin") redirect("/admin/orders");

    const supabase = await createClient();
    const [ordersRes, purchasesRes] = await Promise.all([
        supabase.from("admin_orders")
            .select("id, order_number, created_at, invoiced_at, client_name, final_amount, status, payment_method, source")
            .eq("invoiced", true)
            .order("invoiced_at", { ascending: false }),
        supabase.from("purchase_invoices")
            .select("*")
            .order("invoice_date", { ascending: false }),
    ]);

    return (
        <div className="space-y-6 pb-32">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Contabilidad</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Ventas facturadas y compras · IVA débito/crédito e IIBB 3,5%
                </p>
            </header>
            <ContabilidadView orders={ordersRes.data || []} purchases={purchasesRes.data || []} />
        </div>
    );
}
