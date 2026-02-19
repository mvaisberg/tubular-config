import { createClient } from "@/lib/supabase/client";
// We need server client for layout? Actually layout is server component by default.
// But we want to show logout button which needs client interaction often.
// Let's make a Client Component for the Sidebar.

import Sidebar from "@/components/admin/Sidebar";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen bg-gray-100">
            <Sidebar />
            <main className="flex-1 overflow-auto p-8">
                {children}
            </main>
        </div>
    );
}
