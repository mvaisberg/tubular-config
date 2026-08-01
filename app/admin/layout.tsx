import { AdminShell } from "@/components/admin/AdminShell";
import { getUserRole } from "@/lib/auth";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const role = await getUserRole();
    return <AdminShell role={role}>{children}</AdminShell>;
}
