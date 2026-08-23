import { getUserRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import TrafficReport from "@/components/admin/TrafficReport";

export const dynamic = "force-dynamic";

export default async function TraficoPage() {
    const role = await getUserRole();
    if (role !== "admin") redirect("/admin/orders");

    return (
        <div className="space-y-6 pb-32">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Tráfico del configurador</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Quién llega (publicidad vs orgánico), quién lo usa de verdad y quién es tráfico basura
                </p>
            </header>
            <TrafficReport />
        </div>
    );
}
