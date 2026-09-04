"use client";

// Base de colaboradores (solo admin): dos pestañas — gente que quiere trabajar
// con nosotros y creadores de contenido / canje.

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { FileText, MessageCircle, Instagram, ExternalLink, X, StickyNote } from "lucide-react";

interface Collab {
    id: string;
    created_at: string;
    type: string;
    full_name: string;
    whatsapp: string;
    email: string | null;
    location: string | null;
    areas: string[] | null;
    experience: string | null;
    cv_path: string | null;
    instagram: string | null;
    tiktok: string | null;
    followers: string | null;
    content_type: string | null;
    portfolio_url: string | null;
    proposal: string | null;
    status: string;
    admin_notes: string | null;
    utm_source: string | null;
}

const STATUS: Record<string, { label: string; cls: string }> = {
    new: { label: "Nuevo", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    contacted: { label: "Contactado", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    interested: { label: "Nos interesa", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    archived: { label: "Archivado", cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

const igUrl = (u: string) => `https://instagram.com/${u.replace(/^@/, "")}`;

export default function CollaboratorsBoard({ initial }: { initial: Collab[] }) {
    const supabase = createClient();
    const [rows, setRows] = useState<Collab[]>(initial);
    const [tab, setTab] = useState<"trabajo" | "contenido">("trabajo");
    const [openId, setOpenId] = useState<string | null>(null);
    const [hideArchived, setHideArchived] = useState(true);

    const list = useMemo(() => rows
        .filter(r => r.type === tab)
        .filter(r => !hideArchived || r.status !== "archived"),
        [rows, tab, hideArchived]);

    const counts = useMemo(() => ({
        trabajo: rows.filter(r => r.type === "trabajo" && (!hideArchived || r.status !== "archived")).length,
        contenido: rows.filter(r => r.type === "contenido" && (!hideArchived || r.status !== "archived")).length,
    }), [rows, hideArchived]);

    const setStatus = async (id: string, status: string) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r));
        await supabase.from("collaborators").update({ status }).eq("id", id);
    };
    const saveNotes = async (id: string, admin_notes: string) => {
        await supabase.from("collaborators").update({ admin_notes }).eq("id", id);
    };
    const openCv = async (path: string) => {
        const res = await fetch(`/configurador/api/jobs/cv?path=${encodeURIComponent(path)}`);
        const json = await res.json();
        if (json.url) window.open(json.url, "_blank");
        else alert(json.error || "No se pudo abrir el CV");
    };

    const open = rows.find(r => r.id === openId);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                {([["trabajo", `Quieren trabajar (${counts.trabajo})`], ["contenido", `Contenido y canje (${counts.contenido})`]] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setTab(k)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === k ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {l}
                    </button>
                ))}
                <label className="flex items-center gap-1.5 text-xs text-gray-600 ml-auto">
                    <input type="checkbox" checked={hideArchived} onChange={e => setHideArchived(e.target.checked)} />
                    Ocultar archivados
                </label>
            </div>

            {list.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-sm text-gray-400">
                    Todavía no hay nadie en esta lista. Compartí el link <b>tubular.com.ar/sumate</b>.
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {list.map(r => {
                        const st = STATUS[r.status] || STATUS.new;
                        return (
                            <button key={r.id} onClick={() => setOpenId(r.id)}
                                className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-left hover:border-gray-400 hover:shadow-sm transition-all">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-sm font-semibold text-gray-900">{r.full_name}</span>
                                    <span className={`text-[10px] font-medium border rounded-full px-1.5 py-0.5 ${st.cls}`}>{st.label}</span>
                                    {r.cv_path && <FileText size={12} className="text-gray-400" />}
                                    {r.admin_notes && <StickyNote size={12} className="text-indigo-400" />}
                                </div>
                                <div className="text-[11px] text-gray-500 mt-1 truncate">
                                    {r.type === "contenido"
                                        ? `${r.instagram || r.tiktok || "sin redes"}${r.followers ? ` · ${r.followers} seg.` : ""}${r.content_type ? ` · ${r.content_type}` : ""}`
                                        : (r.areas?.join(" · ") || "sin área elegida")}
                                </div>
                                <div className="text-[11px] text-gray-400 mt-0.5 truncate">
                                    {r.location || "—"} · {format(new Date(r.created_at), "d MMM", { locale: es })}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Ficha */}
            {open && (() => {
                const st = STATUS[open.status] || STATUS.new;
                const wa = (open.whatsapp || "").replace(/\D/g, "");
                const waLink = `https://wa.me/${wa.startsWith("54") ? wa : "549" + wa}`;
                return (
                    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto" onClick={() => setOpenId(null)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8" onClick={e => e.stopPropagation()}>
                            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-lg font-semibold text-gray-900">{open.full_name}</h3>
                                        <span className={`text-[11px] font-medium border rounded-full px-2 py-0.5 ${st.cls}`}>{st.label}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {open.type === "contenido" ? "Contenido y canje" : "Quiere trabajar"} ·
                                        {" "}se anotó el {format(new Date(open.created_at), "d 'de' MMMM", { locale: es })}
                                        {open.utm_source ? ` · vino por ${open.utm_source}` : ""}
                                    </p>
                                </div>
                                <button onClick={() => setOpenId(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                            </div>

                            <div className="p-5 space-y-4 text-sm">
                                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
                                    <Row k="WhatsApp" v={open.whatsapp} />
                                    <Row k="Email" v={open.email} />
                                    <Row k="Zona" v={open.location} />
                                    {open.type === "contenido" ? (
                                        <>
                                            <Row k="Seguidores" v={open.followers} />
                                            <Row k="Instagram" v={open.instagram} />
                                            <Row k="TikTok" v={open.tiktok} />
                                            <Row k="Tipo de contenido" v={open.content_type} />
                                        </>
                                    ) : (
                                        <Row k="Le interesa" v={open.areas?.join(", ") || null} />
                                    )}
                                </div>

                                {open.experience && <Block title="Experiencia" text={open.experience} />}
                                {open.proposal && <Block title="Qué propone" text={open.proposal} />}

                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Notas internas</div>
                                    <textarea key={open.id} defaultValue={open.admin_notes || ""}
                                        onBlur={e => saveNotes(open.id, e.target.value)} rows={3}
                                        placeholder="Se guarda al salir del campo…"
                                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
                                <a href={waLink} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700">
                                    <MessageCircle size={14} /> WhatsApp
                                </a>
                                {open.cv_path && (
                                    <button onClick={() => openCv(open.cv_path!)}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800">
                                        <FileText size={14} /> Ver CV
                                    </button>
                                )}
                                {open.instagram && (
                                    <a href={igUrl(open.instagram)} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-pink-600 text-white text-xs font-semibold rounded-lg hover:bg-pink-700">
                                        <Instagram size={14} /> Ver perfil
                                    </a>
                                )}
                                {open.portfolio_url && (
                                    <a href={open.portfolio_url} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50">
                                        <ExternalLink size={14} /> Trabajos
                                    </a>
                                )}
                                <div className="ml-auto flex flex-wrap gap-1.5">
                                    {Object.entries(STATUS).map(([k, v]) => (
                                        <button key={k} onClick={() => setStatus(open.id, k)}
                                            className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium border ${open.status === k ? v.cls : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"}`}>
                                            {v.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

function Row({ k, v }: { k: string; v: string | null }) {
    return (
        <div className="flex gap-2">
            <span className="text-gray-400 w-32 shrink-0">{k}</span>
            <span className="text-gray-900 font-medium break-words">{v || "—"}</span>
        </div>
    );
}

function Block({ title, text }: { title: string; text: string }) {
    return (
        <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{title}</div>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{text}</p>
        </div>
    );
}
