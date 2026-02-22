import { createClient } from "@/lib/supabase/server";
import QuotesTable from "@/components/admin/QuotesTable";

export default async function QuotesPage() {
    const supabase = await createClient();
    const { data: quotes } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false });

    return (
        <div className="max-w-6xl space-y-8 pb-32">
            <header className="mb-12 border-b border-black pb-4 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black tracking-tight uppercase">Cotizaciones</h1>
                    <p className="text-black/60 text-xs font-bold uppercase tracking-widest mt-1">Cotizaciones guardadas</p>
                </div>
            </header>

            <QuotesTable quotes={quotes || []} />
        </div>
    );
}
