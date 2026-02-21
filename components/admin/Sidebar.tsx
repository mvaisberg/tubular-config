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
        <aside className="w-64 bg-[#ebecdf] border-r border-[#354763]/10 flex flex-col">
            <div className="p-8 border-b border-[#354763]/10 flex flex-col items-center gap-4">
                <img src="/brandbook/logo/logo-azul.svg" alt="Tubular Logo" className="w-32" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#354763]/40">Admin Panel</span>
            </div>
            <nav className="flex-1 p-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all ${isActive
                                ? "bg-[#354763] text-white shadow-md shadow-[#354763]/20"
                                : "text-[#354763]/70 hover:bg-[#354763]/5 hover:text-[#354763]"
                                }`}
                        >
                            <Icon size={18} />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 space-y-2 border-t border-[#354763]/10">
                <a
                    href="/brandbook/identidad.pdf"
                    target="_blank"
                    className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-[#354763]/60 hover:text-[#354763] transition-colors"
                >
                    <Settings size={16} />
                    Manual de Marca
                </a>
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <LogOut size={18} />
                    Logout
                </button>
            </div>
        </aside>
    );
}
