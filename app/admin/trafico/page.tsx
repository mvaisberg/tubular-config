import { redirect } from "next/navigation";

// El informe de tráfico vive dentro de Informes.
export default function TraficoPage() {
    redirect("/admin/reports");
}
