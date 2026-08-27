"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import NoStatsToggle from "./NoStatsToggle";
import {
    LayoutDashboard,
    Package,
    Settings,
    LogOut,
    FileText,
    ShoppingCart,
    Store,
    MessageSquare,
    ExternalLink,
    Boxes,
    BarChart3,
    UserPlus,
    Wallet,
    Lightbulb,
    Calculator,
    Star,
    Megaphone,
    ListChecks,
} from "lucide-react";

type Role = "admin" | "sales" | "marketing" | null;

const navItems = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard, adminOnly: true },
    { name: "Pedidos", href: "/admin/orders", icon: ShoppingCart, adminOnly: false },
    { name: "Informes", href: "/admin/reports", icon: BarChart3, adminOnly: true },
    { name: "Cajas", href: "/admin/cajas", icon: Wallet, adminOnly: true },
    { name: "Contabilidad", href: "/admin/contabilidad", icon: Calculator, adminOnly: true },
    { name: "Cotizaciones", href: "/admin/quotes", icon: FileText, adminOnly: true },
    { name: "Contactos", href: "/admin/contacts", icon: MessageSquare, adminOnly: false },
    { name: "Postulaciones", href: "/admin/postulaciones", icon: UserPlus, adminOnly: true },
    { name: "Productos", href: "/admin/products", icon: Store, adminOnly: true },
    { name: "Stock", href: "/admin/stock", icon: Boxes, adminOnly: true },
    { name: "Parts & Costs", href: "/admin/parts", icon: Package, adminOnly: true },
    { name: "Settings", href: "/admin/settings", icon: Settings, adminOnly: true },
];

// Sección Marketing: subtítulo sin link + accesos. La ve todo el mundo;
// el rol marketing ve SOLO esto.
const marketingItems = [
    { name: "Ideas", href: "/admin/ideas", icon: Lightbulb },
    { name: "Calendario", href: "/admin/marketing", icon: Megaphone },
    { name: "Reviews", href: "/admin/reviews", icon: Star },
    { name: "Checklist conversión", href: "/admin/conversion", icon: ListChecks },
];

export default function Sidebar({ role }: { role: Role }) {
    const visibleItems = role === "marketing"
        ? []
        : navItems.filter(i => role === "admin" || !i.adminOnly);
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/admin/login");
        router.refresh();
    };

    if (pathname === "/admin/login") return null;

    return (
        <aside className="w-60 bg-gray-900 text-gray-300 flex flex-col shrink-0 border-r border-gray-800">
            <div className="px-5 py-6 border-b border-gray-800">
                <Link href="/admin" className="flex items-baseline gap-2 group">
                    <span className="text-lg font-semibold tracking-tight text-white">Tubular</span>
                    <span className="text-[10px] uppercase font-medium tracking-widest text-gray-500 group-hover:text-gray-400 transition-colors">
                        Admin
                    </span>
                </Link>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {visibleItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive
                                ? "bg-gray-800 text-white"
                                : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"
                                }`}
                        >
                            <Icon size={16} strokeWidth={2} />
                            {item.name}
                        </Link>
                    );
                })}

                {/* Sección Marketing */}
                <div className="pt-4 pb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    Marketing
                </div>
                {marketingItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive
                                ? "bg-gray-800 text-white"
                                : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"
                                }`}
                        >
                            <Icon size={16} strokeWidth={2} />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="px-3 py-4 border-t border-gray-800 space-y-1">
                <NoStatsToggle compact />
                <a
                    href="/configurador"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-gray-400 rounded-md hover:bg-gray-800/60 hover:text-gray-200 transition-colors"
                >
                    <ExternalLink size={16} strokeWidth={2} />
                    Ir al configurador
                </a>
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium text-gray-400 rounded-md hover:bg-gray-800/60 hover:text-gray-200 transition-colors"
                >
                    <LogOut size={16} strokeWidth={2} />
                    Cerrar sesión
                </button>
            </div>
        </aside>
    );
}
