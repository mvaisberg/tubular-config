import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import CashBoxManager from "@/components/admin/CashBoxManager";

export const dynamic = "force-dynamic";

export default async function CajasPage() {
    const role = await getUserRole();
    if (role !== "admin") redirect("/admin/orders");

    const supabase = await createClient();
    const [boxesRes, movRes] = await Promise.all([
        supabase.from("cash_boxes").select("*").order("sort_order"),
        supabase.from("cash_movements").select("*").order("created_at", { ascending: false }).limit(500),
    ]);

    return (
        <div className="space-y-6 pb-32">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Cajas</h1>
                <p className="text-sm text-gray-500 mt-1">Tesorería · saldos, movimientos y transferencias</p>
            </header>
            <CashBoxManager initialBoxes={boxesRes.data || []} initialMovements={movRes.data || []} />
        </div>
    );
}
