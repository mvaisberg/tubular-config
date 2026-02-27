"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ContactsTable } from '@/components/admin/ContactsTable';
import { Loader2 } from 'lucide-react';

export default function ContactsAdminPage() {
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/admin/login');
            } else {
                setLoading(false);
            }
        };
        checkAuth();
    }, [router]);

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Contactos de Tienda</h1>
                    <p className="text-slate-500 mt-1 font-medium text-lg leading-relaxed max-w-2xl">
                        Mensajes recibidos desde el formulario de contacto de Tiendanube.
                    </p>
                </div>
            </header>

            <ContactsTable />
        </div>
    );
}
