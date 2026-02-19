import { createClient } from "@/lib/supabase/server";
import PartsTable from "@/components/admin/PartsTable";

export default async function PartsPage() {
    const supabase = await createClient(); // createClient is async now in recent next.js/supabase patterns? Yes, cookies() is async.
    const { data: parts } = await supabase.from("parts").select("*").order("sku");

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Parts & Costs</h1>
            </div>
            <div>
                <PartsTable initialParts={parts || []} />
            </div>
        </div>
    );
}
