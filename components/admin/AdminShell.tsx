"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";

type Role = "admin" | "sales" | "marketing" | null;

export function AdminShell({ role, children }: { role: Role; children: React.ReactNode }) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    // Cerrar drawer al cambiar de ruta
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    // Cerrar drawer con Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMobileOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Block body scroll while drawer is open
    useEffect(() => {
        if (mobileOpen) {
            document.body.style.overflow = "hidden";
            return () => { document.body.style.overflow = ""; };
        }
    }, [mobileOpen]);

    // Login page: no chrome
    if (pathname === "/admin/login") {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans antialiased selection:bg-indigo-600 selection:text-white">
            {/* Mobile top bar */}
            <header className="md:hidden fixed top-0 inset-x-0 z-30 bg-gray-900 text-white flex items-center justify-between px-3 h-14 border-b border-gray-800">
                <button
                    onClick={() => setMobileOpen(true)}
                    className="p-2.5 -ml-1 rounded-md hover:bg-gray-800 active:bg-gray-700 transition-colors"
                    aria-label="Abrir menú"
                >
                    <Menu size={20} />
                </button>
                <Link href="/admin" className="flex items-baseline gap-1.5">
                    <span className="text-base font-semibold tracking-tight">Tubular</span>
                    <span className="text-[10px] uppercase font-medium tracking-widest text-gray-400">Admin</span>
                </Link>
                <div className="w-10" /> {/* spacer */}
            </header>

            {/* Mobile backdrop */}
            {mobileOpen && (
                <div
                    className="md:hidden fixed inset-0 z-40 bg-black/50 animate-in fade-in duration-150"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <div className="flex md:min-h-screen">
                {/* Sidebar — drawer on mobile, sticky on desktop */}
                <div
                    className={`
                        fixed md:sticky inset-y-0 left-0 z-50
                        transform ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
                        md:translate-x-0 md:top-0 md:h-screen
                        transition-transform duration-200 ease-out
                        flex shrink-0
                    `}
                >
                    <Sidebar role={role} />
                </div>

                {/* Main content */}
                <main className="flex-1 overflow-auto pt-14 md:pt-0 min-w-0">
                    <div className="px-4 md:px-10 py-6 md:py-10 max-w-[1400px]">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
