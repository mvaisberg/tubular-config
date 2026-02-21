import { createClient } from "@/lib/supabase/server";
import QuotesTable from "@/components/admin/QuotesTable";

export default async function QuotesPage() {
    const supabase = await createClient();
    const { data: quotes } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Cotizaciones Guardadas</h1>
            </div>

            <QuotesTable quotes={quotes || []} />
        </div>
    );
}
