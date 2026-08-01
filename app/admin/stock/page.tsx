import { createClient } from "@/lib/supabase/server";
import { StockManager } from "@/components/admin/StockManager";

export const dynamic = "force-dynamic";

export default async function StockPage() {
    const supabase = await createClient();

    const { data: items } = await supabase
        .from("stock_items")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

    return (
        <div className="space-y-6 pb-32">
            <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Stock</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Inventario de materiales · descuento automático en pedidos pagados
                    </p>
                </div>
            </header>

            <StockManager initialItems={items || []} />
        </div>
    );
}
