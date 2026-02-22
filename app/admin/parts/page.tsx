import { createClient } from "@/lib/supabase/server";
import PartsTable from "@/components/admin/PartsTable";

export default async function PartsPage() {
    const supabase = await createClient(); // createClient is async now in recent next.js/supabase patterns? Yes, cookies() is async.
    const { data: parts } = await supabase.from("parts").select("*").order("sku");

    return (
        <div className="max-w-6xl space-y-8 pb-32">
            <header className="mb-12 border-b border-black pb-4">
                <h1 className="text-4xl font-black tracking-tight uppercase">Base de Partes</h1>
                <p className="text-black/60 text-xs font-bold uppercase tracking-widest mt-1">Gestión de costos y conectores</p>
            </header>
            <div>
                <PartsTable initialParts={parts || []} />
            </div>
        </div>
    );
}
