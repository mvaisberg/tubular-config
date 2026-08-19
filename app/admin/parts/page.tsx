import { createClient } from "@/lib/supabase/server";
import PartsTable from "@/components/admin/PartsTable";
import ProfitAnalyzer from "@/components/admin/ProfitAnalyzer";
import PnLReport from "@/components/admin/PnLReport";

export default async function PartsPage() {
    const supabase = await createClient(); // createClient is async now in recent next.js/supabase patterns? Yes, cookies() is async.
    const { data: parts } = await supabase.from("parts").select("*").order("sku");
    const { data: settings } = await supabase.from("settings").select("*").eq("id", 1).single();

    return (
        <div className="space-y-6 pb-32">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Parts & Costs</h1>
                <p className="text-sm text-gray-500 mt-1">Gestión de costos y conectores</p>
            </header>
            {/* Sólo admins llegan a esta ruta (middleware) — análisis con impuestos y márgenes reales */}
            <ProfitAnalyzer partsData={parts || []} settings={settings || { usd_exchange_rate: 1530, profit_margin: 70 }} />
            <PnLReport settings={settings || undefined} />
            <PartsTable initialParts={parts || []} />
        </div>
    );
}
