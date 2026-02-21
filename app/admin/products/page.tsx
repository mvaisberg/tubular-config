import { createClient } from "@/lib/supabase/server";
import ProductsTable from "@/components/admin/ProductsTable";
import Link from "next/link";
import { Plus } from "lucide-react";

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
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Productos Preconfigurados</h1>
                    <p className="text-sm text-gray-500">Muebles con configuración fija y precios dinámicos según el costo de partes.</p>
                </div>
                {/* 
                  To create a new product, we can either have a modal here 
                  or a link to the configurator with a "Save as Product" flag.
                  For simplicity, let's link to the home with a special admin mode.
                */}
                <Link
                    href="/?admin=true"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-md active:scale-95"
                >
                    <Plus size={18} />
                    Nuevo Producto
                </Link>
            </div>

            <ProductsTable
                initialProducts={products || []}
                partsData={parts || []}
                settings={settings || { usd_exchange_rate: 1000, profit_margin: 65 }}
            />
        </div>
    );
}
