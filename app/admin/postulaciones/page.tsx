import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import JobApplicationsBoard from "@/components/admin/JobApplicationsBoard";

export const dynamic = "force-dynamic";

export default async function PostulacionesPage() {
    const role = await getUserRole();
    if (role !== "admin") redirect("/admin/orders");

    const supabase = await createClient();
    const { data } = await supabase
        .from("job_applications")
        .select("*")
        .order("created_at", { ascending: false });

    return (
        <div className="space-y-6 pb-32">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Postulaciones</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Búsqueda: Operario/a de Producción y Armado · el formulario vive en tubular.com.ar/trabaja
                </p>
            </header>
            <JobApplicationsBoard initial={data || []} />
        </div>
    );
}
