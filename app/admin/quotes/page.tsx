import { createClient } from "@/lib/supabase/server";
import QuotesTable from "@/components/admin/QuotesTable";

export default async function QuotesPage() {
    const supabase = await createClient();
    const { data: quotes } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false });

    return (
        <div className="space-y-6 pb-32">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Cotizaciones</h1>
                <p className="text-sm text-gray-500 mt-1">Cotizaciones guardadas</p>
            </header>

            <QuotesTable quotes={quotes || []} />
        </div>
    );
}
