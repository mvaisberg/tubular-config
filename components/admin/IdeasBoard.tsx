"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, X, GripVertical } from "lucide-react";

interface Idea {
    id: string;
    title: string;
    description: string | null;
    status: string;
    sort_order: number;
    author_email: string | null;
    created_at: string;
}

const COLUMNS: { key: string; label: string; cls: string; dot: string }[] = [
    { key: "ideas", label: "Ideas", cls: "bg-amber-50 border-amber-200", dot: "bg-amber-400" },
    { key: "todo", label: "To Do", cls: "bg-blue-50 border-blue-200", dot: "bg-blue-400" },
    { key: "done", label: "Done", cls: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-400" },
];

export default function IdeasBoard({ initialIdeas }: { initialIdeas: Idea[] }) {
    const supabase = createClient();
    const [ideas, setIdeas] = useState<Idea[]>(initialIdeas);
    const [creatingIn, setCreatingIn] = useState<string | null>(null);
    const [dragId, setDragId] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState<string | null>(null);
    const [editing, setEditing] = useState<Idea | null>(null);

    const byColumn = useMemo(() => {
        const g: Record<string, Idea[]> = { ideas: [], todo: [], done: [] };
        ideas.forEach(i => { (g[i.status] || g.ideas).push(i); });
        return g;
    }, [ideas]);

    const createIdea = async (status: string, title: string) => {
        if (!title.trim()) return;
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.from("ideas")
            .insert({ title: title.trim(), status, author_email: user?.email || null })
            .select().single();
        if (error) return alert("Error: " + error.message);
        if (data) setIdeas(prev => [data as Idea, ...prev]);
        setCreatingIn(null);
    };

    const moveIdea = async (id: string, status: string) => {
        const current = ideas.find(i => i.id === id);
        if (!current || current.status === status) return;
        setIdeas(prev => prev.map(i => i.id === id ? { ...i, status } : i));
        const { error } = await supabase.from("ideas").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) { alert("Error: " + error.message); setIdeas(prev => prev.map(i => i.id === id ? { ...i, status: current.status } : i)); }
    };

    const deleteIdea = async (id: string) => {
        if (!confirm("¿Eliminar esta idea?")) return;
        setIdeas(prev => prev.filter(i => i.id !== id));
        await supabase.from("ideas").delete().eq("id", id);
    };

    const saveEdit = async (idea: Idea, title: string, description: string) => {
        setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, title, description } : i));
        setEditing(null);
        await supabase.from("ideas").update({ title, description: description || null, updated_at: new Date().toISOString() }).eq("id", idea.id);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            {COLUMNS.map(col => {
                const items = byColumn[col.key] || [];
                return (
                    <div
                        key={col.key}
                        onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
                        onDragLeave={() => setDragOver(o => o === col.key ? null : o)}
                        onDrop={() => { if (dragId) moveIdea(dragId, col.key); setDragId(null); setDragOver(null); }}
                        className={`rounded-lg border ${col.cls} ${dragOver === col.key ? "ring-2 ring-indigo-400" : ""} flex flex-col min-h-[200px]`}
                    >
                        <div className="px-3 py-2.5 flex items-center justify-between border-b border-black/5">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                                <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                                <span className="text-xs text-gray-400">{items.length}</span>
                            </div>
                            <button onClick={() => setCreatingIn(col.key)} className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-white/60 rounded transition-colors" title="Agregar idea">
                                <Plus size={15} />
                            </button>
                        </div>

                        <div className="p-2 space-y-2 flex-1">
                            {creatingIn === col.key && (
                                <NewCard onCancel={() => setCreatingIn(null)} onSave={t => createIdea(col.key, t)} />
                            )}
                            {items.length === 0 && creatingIn !== col.key && (
                                <div className="text-center text-xs text-gray-300 py-6">Arrastrá o agregá ideas acá</div>
                            )}
                            {items.map(idea => (
                                <div
                                    key={idea.id}
                                    draggable
                                    onDragStart={() => setDragId(idea.id)}
                                    onDragEnd={() => { setDragId(null); setDragOver(null); }}
                                    onClick={() => setEditing(idea)}
                                    className={`bg-white border border-gray-200 rounded-md p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-300 transition-colors group ${dragId === idea.id ? "opacity-40" : ""}`}
                                >
                                    <div className="flex items-start gap-1.5">
                                        <GripVertical size={13} className="text-gray-300 mt-0.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-gray-800 break-words">{idea.title}</div>
                                            {idea.description && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{idea.description}</div>}
                                        </div>
                                        <button onClick={e => { e.stopPropagation(); deleteIdea(idea.id); }} className="p-1 text-gray-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" title="Eliminar">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {editing && (
                <EditModal idea={editing} onClose={() => setEditing(null)} onSave={saveEdit} />
            )}
        </div>
    );
}

function NewCard({ onCancel, onSave }: { onCancel: () => void; onSave: (title: string) => void }) {
    const [title, setTitle] = useState("");
    return (
        <div className="bg-white border border-indigo-200 rounded-md p-2">
            <textarea
                autoFocus value={title} onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSave(title); } if (e.key === "Escape") onCancel(); }}
                placeholder="Escribí la idea… (Enter para guardar)"
                className="w-full text-sm resize-none outline-none min-h-[44px]"
            />
            <div className="flex justify-end gap-1.5 mt-1">
                <button onClick={onCancel} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded">Cancelar</button>
                <button onClick={() => onSave(title)} className="px-2.5 py-1 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700">Agregar</button>
            </div>
        </div>
    );
}

function EditModal({ idea, onClose, onSave }: { idea: Idea; onClose: () => void; onSave: (idea: Idea, title: string, description: string) => void }) {
    const [title, setTitle] = useState(idea.title);
    const [description, setDescription] = useState(idea.description || "");
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5 relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"><X size={18} /></button>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Editar idea</h3>
                <label className="text-xs font-medium text-gray-700 block mb-1">Título</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <label className="text-xs font-medium text-gray-700 block mb-1">Descripción</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mb-4 min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Detalle (opcional)…" />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Cancelar</button>
                    <button onClick={() => { if (title.trim()) onSave(idea, title.trim(), description.trim()); }} className="px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Guardar</button>
                </div>
            </div>
        </div>
    );
}
