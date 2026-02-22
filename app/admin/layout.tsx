import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/admin/Sidebar";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-white text-black font-sans selection:bg-blue-600 selection:text-white">
            <Sidebar />
            <main className="flex-1 overflow-auto p-8 lg:p-12">
                {children}
            </main>
        </div>
    );
}
