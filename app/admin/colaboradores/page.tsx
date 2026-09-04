import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import CollaboratorsBoard from "@/components/admin/CollaboratorsBoard";

export const dynamic = "force-dynamic";

export default async function ColaboradoresPage() {
    const role = await getUserRole();
    if (role !== "admin") redirect("/admin/orders");

    const supabase = await createClient();
    const { data } = await supabase
        .from("collaborators")
        .select("*")
        .order("created_at", { ascending: false });

    return (
        <div className="space-y-6 pb-32">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Colaboradores</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Base de gente que quiere trabajar con nosotros o hacer contenido · el formulario vive en tubular.com.ar/sumate
                </p>
            </header>
            <CollaboratorsBoard initial={data || []} />
        </div>
    );
}
