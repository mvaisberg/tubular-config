"use client";

import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { Trash2 } from "lucide-react";

interface Comment {
    id: string;
    body: string;
    created_at: string;
    user_id: string | null;
    author_email: string | null;
}

export function OrderComments({ orderId, expanded }: { orderId: string; expanded: boolean }) {
    const supabase = createClient();
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [text, setText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!expanded || loaded) return;
        const load = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUserId(user?.id || null);

            const { data } = await supabase
                .from("order_comments")
                .select("*")
                .eq("order_id", orderId)
                .order("created_at", { ascending: true });

            setComments(data || []);
            setLoaded(true);
            setLoading(false);
        };
        load();
    }, [expanded, loaded, orderId, supabase]);

    const submit = async () => {
        const body = text.trim();
        if (!body) return;
        setSubmitting(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert("Sesión expirada");
            setSubmitting(false);
            return;
        }
        const { data, error } = await supabase
            .from("order_comments")
            .insert({
                order_id: orderId,
                user_id: user.id,
                author_email: user.email,
                body,
            })
            .select()
            .single();

        if (error) {
            alert("Error al guardar comentario: " + error.message);
        } else if (data) {
            setComments(prev => [...prev, data]);
            setText("");
        }
        setSubmitting(false);
        textareaRef.current?.focus();
    };

    const remove = async (id: string) => {
        if (!confirm("¿Eliminar este comentario?")) return;
        const { error } = await supabase.from("order_comments").delete().eq("id", id);
        if (error) return alert("Error: " + error.message);
        setComments(comments.filter(c => c.id !== id));
    };

    if (!expanded) return null;

    return (
        <div className="px-4 py-3 border-t border-gray-100 bg-white space-y-2">
            {loading ? (
                <p className="text-xs text-gray-400 italic">Cargando…</p>
            ) : comments.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Sin comentarios todavía.</p>
            ) : (
                <ul className="space-y-2">
                    {comments.map(c => (
                        <li key={c.id} className="text-xs">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="font-medium text-gray-700">{c.author_email || "Usuario"}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400">
                                        {format(new Date(c.created_at), "d MMM HH:mm", { locale: es })}
                                    </span>
                                    {c.user_id && c.user_id === currentUserId && (
                                        <button
                                            onClick={() => remove(c.id)}
                                            className="text-gray-400 hover:text-rose-600"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={11} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap mt-0.5">{c.body}</p>
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex gap-2 items-start pt-1">
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                            e.preventDefault();
                            submit();
                        }
                    }}
                    rows={1}
                    placeholder="Agregar comentario…"
                    className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm bg-white resize-y min-h-[40px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                    onClick={submit}
                    disabled={submitting || !text.trim()}
                    className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 min-h-[40px]"
                >
                    {submitting ? "…" : "Enviar"}
                </button>
            </div>
        </div>
    );
}
