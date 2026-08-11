import { createClient } from "@/lib/supabase/server";
import CalendarBoard from "@/components/admin/marketing/CalendarBoard";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
    const supabase = await createClient();
    const { data: items } = await supabase
        .from("marketing_items")
        .select("*")
        .order("sort_order", { ascending: true });

    return (
        <div className="space-y-6 pb-32">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Calendario</h1>
                <p className="text-sm text-gray-500 mt-1">Contenido agendado para Instagram — arrastrá para reprogramar</p>
            </header>
            <CalendarBoard initialItems={items || []} />
        </div>
    );
}
