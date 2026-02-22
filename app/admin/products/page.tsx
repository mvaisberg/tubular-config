import { createClient } from "@/lib/supabase/server";
import ProductsTable from "@/components/admin/ProductsTable";
import Link from "next/link";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProductsAdminPage() {
    const supabase = await createClient();

    // Fetch products
    const { data: products } = await supabase
        .from("preconfigured_products")
        .select("*")
        .order("name");

    // Fetch dependencies for pricing calculation
    const { data: parts } = await supabase.from("parts").select("*");
    const { data: settings } = await supabase.from("settings").select("*").eq("id", 1).single();

    return (
        <div className="max-w-6xl space-y-8 pb-32">
            <header className="mb-12 border-b border-black pb-4 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black tracking-tight uppercase">Productos Fijos</h1>
                    <p className="text-black/60 text-xs font-bold uppercase tracking-widest mt-1">Configuraciones guardadas y precios dinámicos</p>
                </div>
                <Link
                    href="/?admin=true"
                    className="flex items-center gap-2 bg-black text-white px-4 py-3 text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-colors shadow-[4px_4px_0px_#000]"
                >
                    <Plus size={14} strokeWidth={2.5} />
                    NUEVO PRODUCTO
                </Link>
            </header>

            <ProductsTable
                initialProducts={products || []}
                partsData={parts || []}
                settings={settings || { usd_exchange_rate: 1000, profit_margin: 65 }}
            />
        </div>
    );
}
