"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LayoutDashboard, Package, Settings, LogOut, FileText, ShoppingCart, Store } from "lucide-react";

const navItems = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Cotizaciones", href: "/admin/quotes", icon: FileText },
    { name: "Productos", href: "/admin/products", icon: Store },
    { name: "Órdenes", href: "/admin/orders", icon: ShoppingCart },
    { name: "Parts & Costs", href: "/admin/parts", icon: Package },
    { name: "Settings", href: "/admin/settings", icon: Settings },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/admin/login");
        router.refresh();
    };

    if (pathname === "/admin/login") {
        return null;
    }

    return (
        <aside className="w-64 bg-white border-r border-black flex flex-col shrink-0">
            <div className="p-8 border-b border-black flex flex-col items-start gap-1">
                <Link href="/brandbook/identidad.pdf" target="_blank">
                    <h1 className="text-3xl font-black tracking-tighter uppercase relative group cursor-pointer text-black">
                        Tubular
                        <span className="absolute -bottom-2 left-0 w-full h-[2px] bg-blue-600 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
                    </h1>
                </Link>
                <span className="text-[10px] uppercase font-bold text-black/50 tracking-widest mt-2">Admin Panel</span>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 text-xs uppercase tracking-widest font-bold transition-all border ${isActive
                                    ? "bg-black text-white border-black"
                                    : "text-black border-transparent hover:border-black"
                                }`}
                        >
                            <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 space-y-2 border-t border-black">
                <a
                    href="/brandbook/identidad.pdf"
                    target="_blank"
                    className="flex items-center gap-3 px-4 py-3 text-xs uppercase tracking-widest font-bold text-black border border-transparent hover:border-black transition-all"
                >
                    <Settings size={14} strokeWidth={2} />
                    Manual
                </a>
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-3 text-xs uppercase tracking-widest font-bold text-white bg-black hover:bg-blue-600 transition-colors"
                >
                    <LogOut size={14} strokeWidth={2} />
                    Logout
                </button>
            </div>
        </aside>
    );
}
