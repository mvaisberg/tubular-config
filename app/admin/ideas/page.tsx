import { createClient } from "@/lib/supabase/server";
import KanbanBoard from "@/components/admin/marketing/KanbanBoard";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
    const supabase = await createClient();
    const { data: items } = await supabase
        .from("marketing_items")
        .select("*")
        .order("sort_order", { ascending: true });

    return (
        <div className="space-y-6 pb-32">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Ideas</h1>
                <p className="text-sm text-gray-500 mt-1">Tablero de ideas de contenido — arrastrá entre columnas</p>
            </header>
            <KanbanBoard initialItems={items || []} />
        </div>
    );
}
