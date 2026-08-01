import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import ReportsHub from "@/components/admin/ReportsHub";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
    const role = await getUserRole();
    // Informes = datos de facturación → solo admin.
    if (role !== "admin") redirect("/admin/orders");

    const supabase = await createClient();
    const { data: orders } = await supabase
        .from("admin_orders")
        .select("id, order_number, created_at, client_name, final_amount, paid_amount, status, payment_method, source, discount_percentage")
        .order("created_at", { ascending: false });

    return <ReportsHub orders={orders || []} />;
}
