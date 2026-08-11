"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Star, Camera, MessageCircle, Send, Ticket, ExternalLink } from "lucide-react";

type Step =
    | "queued" | "sent" | "awaiting_rating" | "awaiting_comment"
    | "awaiting_photo" | "completed" | "declined" | "expired";

interface Review {
    id: string;
    step: Step;
    rating: number | null;
    comment: string | null;
    photo_urls: string[];
    coupon_code: string | null;
    published: boolean;
    requested_at: string | null;
    responded_at: string | null;
    completed_at: string | null;
    created_at: string;
    wa_contacts: { wa_id: string; profile_name: string | null; display_name: string | null } | null;
}

const STEP_LABEL: Record<Step, string> = {
    queued: "En cola",
    sent: "Enviado",
    awaiting_rating: "Esperando puntuación",
    awaiting_comment: "Esperando comentario",
    awaiting_photo: "Esperando foto",
    completed: "Completado",
    declined: "Pidió baja",
    expired: "Sin respuesta",
};

const STEP_CLS: Record<Step, string> = {
    queued: "bg-gray-100 text-gray-600 border-gray-200",
    sent: "bg-blue-50 text-blue-700 border-blue-200",
    awaiting_rating: "bg-amber-50 text-amber-700 border-amber-200",
    awaiting_comment: "bg-amber-50 text-amber-700 border-amber-200",
    awaiting_photo: "bg-violet-50 text-violet-700 border-violet-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    declined: "bg-rose-50 text-rose-700 border-rose-200",
    expired: "bg-gray-100 text-gray-500 border-gray-200",
};

type Filter = "all" | "responded" | "with_photo" | "pending" | "published";

function Stars({ n }: { n: number | null }) {
    if (!n) return <span className="text-gray-300 text-xs">—</span>;
    return (
        <span className="inline-flex items-center gap-0.5" title={`${n} de 5`}>
            {Array.from({ length: 5 }, (_, i) => (
                <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${i < n ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
                />
            ))}
        </span>
    );
}

function StatCard({
    label, value, sub, icon: Icon, accent,
}: {
    label: string; value: string | number; sub?: string;
    icon: typeof Star; accent: string;
}) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-medium text-gray-500">{label}</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">{value}</p>
                    {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
                </div>
                <div className={`rounded-lg p-2 ${accent}`}>
                    <Icon className="w-4 h-4" />
                </div>
            </div>
        </div>
    );
}

interface QueueStats {
    queued: number;
    sent: number;
    skipped: number;
    failed: number;
    nextAt: string | null;
}

export const ReviewsDashboard = () => {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [queue, setQueue] = useState<QueueStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>("all");
    const [lightbox, setLightbox] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        const fetchReviews = async () => {
            const { data } = await supabase
                .from("wa_reviews")
                .select("*, wa_contacts(wa_id, profile_name, display_name)")
                .order("created_at", { ascending: false });
            if (data) setReviews(data as unknown as Review[]);

            // Cola de envíos programados.
            const { data: jobs } = await supabase
                .from("wa_outbound_jobs")
                .select("status, scheduled_at")
                .eq("kind", "review_request");
            if (jobs) {
                const queuedJobs = jobs.filter(j => j.status === "queued");
                setQueue({
                    queued: queuedJobs.length,
                    sent: jobs.filter(j => j.status === "sent").length,
                    skipped: jobs.filter(j => j.status === "skipped").length,
                    failed: jobs.filter(j => j.status === "failed").length,
                    nextAt: queuedJobs.length
                        ? queuedJobs.map(j => j.scheduled_at as string).sort()[0]
                        : null,
                });
            }
            setLoading(false);
        };
        fetchReviews();

        const channel = supabase
            .channel("public:wa_reviews")
            .on("postgres_changes", { event: "*", schema: "public", table: "wa_reviews" }, () => {
                fetchReviews();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [supabase]);

    const stats = useMemo(() => {
        // "Enviados" = todo lo que efectivamente salió (excluye la cola).
        const sent = reviews.filter(r => r.step !== "queued");
        const responded = reviews.filter(r => r.responded_at);
        const withPhoto = reviews.filter(r => (r.photo_urls ?? []).length > 0);
        const withComment = reviews.filter(r => r.comment && r.comment.trim());
        const rated = reviews.filter(r => r.rating !== null);
        const coupons = reviews.filter(r => r.coupon_code);

        const avg = rated.length
            ? rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length
            : 0;

        const pct = (n: number) => (sent.length ? Math.round((n / sent.length) * 100) : 0);

        return {
            sent: sent.length,
            responded: responded.length,
            respondedPct: pct(responded.length),
            rated: rated.length,
            withComment: withComment.length,
            withPhoto: withPhoto.length,
            withPhotoPct: pct(withPhoto.length),
            coupons: coupons.length,
            avg,
            distribution: [5, 4, 3, 2, 1].map(n => ({
                n,
                count: rated.filter(r => r.rating === n).length,
            })),
        };
    }, [reviews]);

    const filtered = useMemo(() => {
        switch (filter) {
            case "responded": return reviews.filter(r => r.responded_at);
            case "with_photo": return reviews.filter(r => (r.photo_urls ?? []).length > 0);
            case "pending": return reviews.filter(r =>
                ["sent", "awaiting_rating", "awaiting_comment", "awaiting_photo"].includes(r.step));
            case "published": return reviews.filter(r => r.published);
            default: return reviews;
        }
    }, [reviews, filter]);

    const togglePublished = async (r: Review) => {
        const next = !r.published;
        setReviews(prev => prev.map(x => x.id === r.id ? { ...x, published: next } : x));
        await supabase.from("wa_reviews").update({ published: next }).eq("id", r.id);
    };

    if (loading) {
        return (
            <div className="flex h-[40vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!reviews.length) {
        return (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
                <MessageCircle className="w-8 h-8 mx-auto text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-700">Todavía no se pidió ninguna review</p>
                <p className="mt-1 text-xs text-gray-500 max-w-md mx-auto">
                    Cuando conectes el número de WhatsApp API y Meta apruebe la plantilla,
                    los pedidos entregados van a aparecer acá automáticamente.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Métricas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                    label="Enviados" value={stats.sent}
                    icon={Send} accent="bg-blue-50 text-blue-600"
                />
                <StatCard
                    label="Contestaron" value={stats.responded}
                    sub={`${stats.respondedPct}% de respuesta`}
                    icon={MessageCircle} accent="bg-amber-50 text-amber-600"
                />
                <StatCard
                    label="Mandaron foto" value={stats.withPhoto}
                    sub={`${stats.withPhotoPct}% de los enviados`}
                    icon={Camera} accent="bg-violet-50 text-violet-600"
                />
                <StatCard
                    label="Promedio" value={stats.avg ? stats.avg.toFixed(1) : "—"}
                    sub={stats.rated ? `sobre ${stats.rated} puntuaciones` : "sin puntuaciones"}
                    icon={Star} accent="bg-emerald-50 text-emerald-600"
                />
            </div>

            {/* Cola de envíos programados */}
            {queue && (queue.queued > 0 || queue.failed > 0) && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="text-sm">
                        <span className="font-semibold text-gray-900">{queue.queued}</span>
                        <span className="text-gray-500"> por enviar</span>
                    </div>
                    <div className="text-sm">
                        <span className="font-semibold text-gray-900">{queue.sent}</span>
                        <span className="text-gray-500"> enviados</span>
                    </div>
                    {queue.skipped > 0 && (
                        <div className="text-sm">
                            <span className="font-semibold text-gray-900">{queue.skipped}</span>
                            <span className="text-gray-500"> descartados</span>
                        </div>
                    )}
                    {queue.failed > 0 && (
                        <div className="text-sm text-red-600">
                            <span className="font-semibold">{queue.failed}</span> fallidos
                        </div>
                    )}
                    <div className="text-xs text-gray-400 ml-auto">
                        Ritmo: 10 por hora, de 10 a 19 hs (Arg.)
                        {queue.nextAt && new Date(queue.nextAt) > new Date() && (
                            <> · próximo lote: {new Date(queue.nextAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} hs</>
                        )}
                    </div>
                </div>
            )}

            {/* Embudo + distribución */}
            <div className="grid lg:grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Embudo</h3>
                    <div className="mt-3 space-y-2">
                        {[
                            { label: "Enviados", n: stats.sent },
                            { label: "Contestaron", n: stats.responded },
                            { label: "Puntuaron", n: stats.rated },
                            { label: "Comentaron", n: stats.withComment },
                            { label: "Mandaron foto", n: stats.withPhoto },
                        ].map(row => (
                            <div key={row.label} className="flex items-center gap-3">
                                <span className="w-28 shrink-0 text-xs text-gray-600">{row.label}</span>
                                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gray-800 transition-all"
                                        style={{ width: stats.sent ? `${(row.n / stats.sent) * 100}%` : "0%" }}
                                    />
                                </div>
                                <span className="w-8 text-right text-xs font-medium tabular-nums text-gray-900">{row.n}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Puntuaciones</h3>
                    <div className="mt-3 space-y-2">
                        {stats.distribution.map(d => (
                            <div key={d.n} className="flex items-center gap-3">
                                <span className="w-12 shrink-0 text-xs text-gray-600 flex items-center gap-1">
                                    {d.n} <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                </span>
                                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-amber-400 transition-all"
                                        style={{ width: stats.rated ? `${(d.count / stats.rated) * 100}%` : "0%" }}
                                    />
                                </div>
                                <span className="w-8 text-right text-xs font-medium tabular-nums text-gray-900">{d.count}</span>
                            </div>
                        ))}
                    </div>
                    {stats.coupons > 0 && (
                        <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 flex items-center gap-1.5">
                            <Ticket className="w-3.5 h-3.5" />
                            {stats.coupons} {stats.coupons === 1 ? "cupón entregado" : "cupones entregados"}
                        </p>
                    )}
                </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-1.5">
                {([
                    ["all", `Todas (${reviews.length})`],
                    ["responded", `Contestaron (${stats.responded})`],
                    ["with_photo", `Con foto (${stats.withPhoto})`],
                    ["pending", "En curso"],
                    ["published", "Publicadas"],
                ] as Array<[Filter, string]>).map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            filter === key
                                ? "bg-gray-900 text-white border-gray-900"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Tabla */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr className="text-left text-xs font-medium text-gray-500">
                                <th className="px-4 py-2.5">Cliente</th>
                                <th className="px-4 py-2.5">Puntuación</th>
                                <th className="px-4 py-2.5 min-w-[220px]">Comentario</th>
                                <th className="px-4 py-2.5">Fotos</th>
                                <th className="px-4 py-2.5">Estado</th>
                                <th className="px-4 py-2.5">Cupón</th>
                                <th className="px-4 py-2.5 text-right">Web</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map(r => {
                                const c = r.wa_contacts;
                                const name = c?.display_name || c?.profile_name || c?.wa_id || "—";
                                const photos = r.photo_urls ?? [];
                                return (
                                    <tr key={r.id} className="hover:bg-gray-50/60">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-900">{name}</div>
                                            {c?.wa_id && c.wa_id !== name && (
                                                <div className="text-xs text-gray-400 tabular-nums">+{c.wa_id}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3"><Stars n={r.rating} /></td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {r.comment
                                                ? <span className="line-clamp-2">{r.comment}</span>
                                                : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {photos.length ? (
                                                <div className="flex -space-x-2">
                                                    {photos.slice(0, 3).map((url, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => setLightbox(url)}
                                                            className="w-8 h-8 rounded-md border-2 border-white overflow-hidden bg-gray-100 hover:z-10 hover:scale-110 transition-transform"
                                                        >
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                        </button>
                                                    ))}
                                                    {photos.length > 3 && (
                                                        <span className="w-8 h-8 rounded-md border-2 border-white bg-gray-100 text-[10px] font-medium text-gray-500 flex items-center justify-center">
                                                            +{photos.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium border ${STEP_CLS[r.step]}`}>
                                                {STEP_LABEL[r.step]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {r.coupon_code
                                                ? <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.coupon_code}</code>
                                                : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => togglePublished(r)}
                                                disabled={!r.rating}
                                                title={r.rating ? "Mostrar en la web" : "Necesita puntuación"}
                                                className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                                    r.published
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                                                }`}
                                            >
                                                {r.published ? "Publicada" : "Publicar"}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Visor de foto */}
            {lightbox && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
                    onClick={() => setLightbox(null)}
                >
                    <div className="relative max-w-3xl max-h-full" onClick={e => e.stopPropagation()}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={lightbox} alt="Foto de review" className="max-h-[85vh] rounded-lg" />
                        <a
                            href={lightbox}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute top-2 right-2 bg-white/90 rounded-md p-1.5 hover:bg-white"
                            title="Abrir original"
                        >
                            <ExternalLink className="w-4 h-4 text-gray-700" />
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};
