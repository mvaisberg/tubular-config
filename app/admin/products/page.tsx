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
        <div className="space-y-6 pb-32">
            <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Productos</h1>
                    <p className="text-sm text-gray-500 mt-1">Configuraciones guardadas y precios dinámicos</p>
                </div>
                <Link
                    href="/?admin=true"
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors w-fit"
                >
                    <Plus size={15} />
                    Nuevo producto
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
