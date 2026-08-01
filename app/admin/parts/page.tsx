import { createClient } from "@/lib/supabase/server";
import PartsTable from "@/components/admin/PartsTable";

export default async function PartsPage() {
    const supabase = await createClient(); // createClient is async now in recent next.js/supabase patterns? Yes, cookies() is async.
    const { data: parts } = await supabase.from("parts").select("*").order("sku");

    return (
        <div className="space-y-6 pb-32">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Parts & Costs</h1>
                <p className="text-sm text-gray-500 mt-1">Gestión de costos y conectores</p>
            </header>
            <PartsTable initialParts={parts || []} />
        </div>
    );
}
