import { createClient } from "@/lib/supabase/server";
import MarketingModule from "@/components/admin/marketing/MarketingModule";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
    const supabase = await createClient();
    const { data: items } = await supabase
        .from("marketing_items")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

    return (
        <div className="space-y-6 pb-32">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Marketing</h1>
                <p className="text-sm text-gray-500 mt-1">Calendario de contenido e ideas para Instagram</p>
            </header>
            <MarketingModule initialItems={items || []} />
        </div>
    );
}
