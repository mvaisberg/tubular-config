"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Contact = {
    id: string;
    created_at: string;
    name: string;
    email: string | null;
    phone: string | null;
    message: string;
    status: string;
    ai_response: string | null;
};

export const ContactsTable = () => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const fetchContacts = async () => {
            const { data, error } = await supabase
                .from('store_contacts')
                .select('*')
                .order('created_at', { ascending: false });

            if (data) {
                setContacts(data);
            }
            setLoading(false);
        };
        fetchContacts();

        // Optional: subscribe to real-time additions if needed
        const channel = supabase
            .channel('public:store_contacts')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'store_contacts' }, payload => {
                fetchContacts();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    const updateStatus = async (id: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('store_contacts')
                .update({ status: newStatus })
                .eq('id', id);

            if (!error) {
                setContacts(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
            }
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Cargando mensajes...</div>;
    }

    if (contacts.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center mt-6">
                <div className="text-4xl mb-4">📬</div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">No hay mensajes aún</h3>
                <p className="text-slate-500 text-sm">Los mensajes del formulario de la tienda aparecerán aquí.</p>
            </div>
        );
    }

    return (
        <div className="mt-8 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-200">
                                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contacto</th>
                                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mensaje</th>
                                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {contacts.map((contact) => (
                                <tr key={contact.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4 whitespace-nowrap text-sm text-slate-500">
                                        {new Date(contact.created_at).toLocaleDateString('es-AR', {
                                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </td>
                                    <td className="p-4">
                                        <div className="text-sm font-bold text-slate-900">{contact.name}</div>
                                        {contact.email && <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">✉️ {contact.email}</div>}
                                        {contact.phone && <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">📱 {contact.phone}</div>}
                                    </td>
                                    <td className="p-4 align-top max-w-sm">
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-3" title={contact.message}>
                                            {contact.message}
                                        </p>
                                    </td>
                                    <td className="p-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${contact.status === 'new' ? 'bg-blue-100 text-blue-800' :
                                                contact.status === 'replied' ? 'bg-green-100 text-green-800' :
                                                    'bg-slate-100 text-slate-800'
                                            }`}>
                                            {contact.status === 'new' ? 'Nuevo' : contact.status === 'replied' ? 'Respondido' : contact.status}
                                        </span>
                                    </td>
                                    <td className="p-4 whitespace-nowrap text-right text-sm">
                                        <div className="flex items-center justify-end gap-2">
                                            {contact.status === 'new' && (
                                                <button
                                                    onClick={() => updateStatus(contact.id, 'replied')}
                                                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                    Marcar Respondido
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
