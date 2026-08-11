"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ReviewsDashboard } from "@/components/admin/ReviewsDashboard";
import TemplatesManager from "@/components/admin/TemplatesManager";
import { Loader2, AlertTriangle } from "lucide-react";

export default function ReviewsAdminPage() {
    const [loading, setLoading] = useState(true);
    const [waConfigured, setWaConfigured] = useState<boolean | null>(null);
    const router = useRouter();

    useEffect(() => {
        const init = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push("/admin/login");
                return;
            }
            // Aviso si todavía no hay número de WhatsApp conectado.
            try {
                const res = await fetch("/configurador/api/whatsapp/status");
                const json = await res.json();
                setWaConfigured(Boolean(json?.configured));
            } catch {
                setWaConfigured(false);
            }
            setLoading(false);
        };
        init();
    }, [router]);

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Reviews</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Pedidos de opinión por WhatsApp: puntuación, comentario y foto a cambio de descuento.
                </p>
            </header>

            {waConfigured === false && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-medium text-amber-900">WhatsApp todavía no está conectado</p>
                        <p className="text-amber-800 mt-0.5">
                            El sistema está armado y listo. Falta cargar las credenciales de Meta en
                            <code className="mx-1 px-1 py-0.5 rounded bg-amber-100 text-xs">.env.local</code>
                            y que Meta apruebe la plantilla del disparo inicial. Hasta entonces no sale ningún mensaje.
                        </p>
                    </div>
                </div>
            )}

            {waConfigured && <TemplatesManager />}

            <ReviewsDashboard />
        </div>
    );
}
