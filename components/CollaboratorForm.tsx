"use client";

// Formulario público /sumate: dos caminos (trabajar con nosotros / contenido y
// canje). Base pasiva: no promete nada, solo registra el interés.

import { useState } from "react";
import { useSearchParams } from "next/navigation";

const inputCls = "w-full border border-gray-300 rounded-xl px-4 py-3 text-[15px] bg-white focus:outline-none focus:ring-2 focus:ring-[#354763]/40 focus:border-[#354763]";
const labelCls = "block text-sm font-semibold text-[#354763] mb-1.5";

const AREAS = [
    "Producción y armado", "Depósito y logística", "Ventas y atención",
    "Diseño", "Marketing y contenido", "Administración",
];

type Path = null | "trabajo" | "contenido";

export default function CollaboratorForm() {
    const params = useSearchParams();
    const initial = params.get("tipo") === "contenido" ? "contenido"
        : params.get("tipo") === "trabajo" ? "trabajo" : null;
    const [path, setPath] = useState<Path>(initial as Path);
    const [areas, setAreas] = useState<string[]>([]);
    const [cvName, setCvName] = useState("");
    const [sending, setSending] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (done) {
        return (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
                <div className="text-4xl mb-3">✅</div>
                <h2 className="text-xl font-black text-[#354763]">¡Listo, quedaste en la base!</h2>
                <p className="text-sm text-gray-600 mt-2 max-w-sm mx-auto">
                    Guardamos tus datos. Cuando busquemos a alguien o armemos una acción, te escribimos por WhatsApp.
                </p>
            </div>
        );
    }

    if (!path) {
        return (
            <div className="space-y-3">
                <button onClick={() => setPath("trabajo")}
                    className="w-full text-left bg-white border-2 border-gray-200 hover:border-[#354763] rounded-2xl p-5 transition-colors group">
                    <div className="font-black text-[#354763] text-lg">Quiero trabajar en Tubular →</div>
                    <p className="text-sm text-gray-600 mt-1">
                        Dejá tu CV y tus datos. Cuando abramos una búsqueda, miramos esta base primero.
                    </p>
                </button>
                <button onClick={() => setPath("contenido")}
                    className="w-full text-left bg-white border-2 border-gray-200 hover:border-[#354763] rounded-2xl p-5 transition-colors group">
                    <div className="font-black text-[#354763] text-lg">Quiero hacer contenido o canje →</div>
                    <p className="text-sm text-gray-600 mt-1">
                        Creadores, deco, arquitectura e interiorismo. Contanos qué hacés y te tenemos en cuenta.
                    </p>
                </button>
            </div>
        );
    }

    const esTrabajo = path === "trabajo";

    return (
        <form
            className="bg-white border border-gray-200 rounded-2xl p-5 md:p-7 space-y-5"
            onSubmit={async (e) => {
                e.preventDefault();
                setSending(true); setError(null);
                try {
                    const fd = new FormData(e.currentTarget);
                    fd.set("type", path);
                    areas.forEach(a => fd.append("areas", a));
                    fd.set("utm_source", params.get("utm_source") || "");
                    fd.set("utm_medium", params.get("utm_medium") || "");
                    fd.set("utm_campaign", params.get("utm_campaign") || "");
                    const res = await fetch("/configurador/api/collaborators", { method: "POST", body: fd });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || "Error al enviar");
                    setDone(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                } catch (err) {
                    setError((err as Error).message);
                } finally { setSending(false); }
            }}
        >
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

            <button type="button" onClick={() => setPath(null)} className="text-xs font-semibold text-gray-400 hover:text-[#354763]">
                ← cambiar
            </button>

            <div>
                <label className={labelCls}>Nombre y apellido *</label>
                <input name="full_name" required maxLength={120} className={inputCls} autoComplete="name" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>WhatsApp *</label>
                    <input name="whatsapp" required maxLength={40} inputMode="tel" className={inputCls} placeholder="11 1234 5678" />
                </div>
                <div>
                    <label className={labelCls}>Email</label>
                    <input name="email" type="email" maxLength={160} className={inputCls} />
                </div>
            </div>
            <div>
                <label className={labelCls}>¿En qué zona vivís? *</label>
                <input name="location" required maxLength={200} className={inputCls} placeholder="Ej: Villa Urquiza, CABA" />
            </div>

            {esTrabajo ? (
                <>
                    <div>
                        <label className={labelCls}>¿En qué te gustaría trabajar? *</label>
                        <div className="grid grid-cols-2 gap-2">
                            {AREAS.map(a => (
                                <button key={a} type="button"
                                    onClick={() => setAreas(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}
                                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border text-left transition-colors ${areas.includes(a) ? "bg-[#354763] text-white border-[#354763]" : "bg-white text-gray-600 border-gray-300"}`}>
                                    {a}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Contanos tu experiencia</label>
                        <textarea name="experience" maxLength={2000} rows={4} className={inputCls}
                            placeholder="En qué trabajaste, qué sabés hacer. Si es tu primer trabajo, contanos qué estudiaste o qué te gusta hacer." />
                    </div>
                    <div>
                        <label className={labelCls}>Adjuntá tu CV (PDF, opcional)</label>
                        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl px-4 py-5 text-sm text-gray-500 cursor-pointer hover:border-[#354763]/50">
                            <input type="file" name="cv" accept="application/pdf" className="hidden"
                                onChange={e => setCvName(e.target.files?.[0]?.name || "")} />
                            {cvName ? <span className="font-semibold text-[#354763]">📄 {cvName}</span> : <span>Tocá para elegir el archivo (máx. 10 MB)</span>}
                        </label>
                    </div>
                </>
            ) : (
                <>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Instagram</label>
                            <input name="instagram" maxLength={80} className={inputCls} placeholder="@tuusuario" />
                        </div>
                        <div>
                            <label className={labelCls}>TikTok</label>
                            <input name="tiktok" maxLength={80} className={inputCls} placeholder="@tuusuario" />
                        </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Seguidores (aprox.)</label>
                            <input name="followers" maxLength={40} className={inputCls} placeholder="Ej: 8.000" />
                        </div>
                        <div>
                            <label className={labelCls}>¿Qué tipo de contenido hacés?</label>
                            <input name="content_type" maxLength={80} className={inputCls} placeholder="Deco, arquitectura, lifestyle…" />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Link a tus trabajos (opcional)</label>
                        <input name="portfolio_url" maxLength={300} className={inputCls} placeholder="Portfolio, reel, drive…" />
                    </div>
                    <div>
                        <label className={labelCls}>Contanos qué te gustaría hacer con nosotros</label>
                        <textarea name="proposal" maxLength={2000} rows={4} className={inputCls}
                            placeholder="Qué tipo de colaboración imaginás." />
                    </div>
                </>
            )}

            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</div>}

            <button type="submit" disabled={sending}
                className="w-full py-4 bg-[#354763] text-white font-bold text-sm tracking-widest uppercase rounded-xl hover:bg-[#2a3850] transition-colors disabled:opacity-60">
                {sending ? "Enviando…" : "Sumarme a la base"}
            </button>
            <p className="text-[11px] text-gray-400 text-center">
                Usamos tus datos solo para contactarte desde Tubular.
            </p>
        </form>
    );
}
