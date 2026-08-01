import { createClient } from "@/lib/supabase/server";
import IdeasBoard from "@/components/admin/IdeasBoard";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
    const supabase = await createClient();
    const { data: ideas } = await supabase
        .from("ideas")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

    return (
        <div className="space-y-6 pb-32">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Ideas</h1>
                <p className="text-sm text-gray-500 mt-1">Tablero de ideas y tareas del equipo</p>
            </header>
            <IdeasBoard initialIdeas={ideas || []} />
        </div>
    );
}
