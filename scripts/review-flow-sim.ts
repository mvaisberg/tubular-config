/**
 * Simulador del flujo de reviews. Corre la conversación completa contra la
 * máquina de estados, sin Meta ni base de datos.
 *
 *   node --experimental-strip-types .review-flow-sim.ts
 */
import {
    advanceReviewFlow,
    parseRating,
    type ReviewState,
    type FlowConfig,
} from "../lib/review-flow.ts";

const CONFIG: FlowConfig = { discountPercent: 10, couponDaysValid: 30, couponCode: "TUBU-REV-A1B2" };

function fresh(step: ReviewState["step"] = "sent"): ReviewState {
    return { step, rating: null, comment: null, photo_count: 0, prompt_count: 0 };
}

function apply(state: ReviewState, patch: ReturnType<typeof advanceReviewFlow>["patch"]): ReviewState {
    return {
        step: patch.step ?? state.step,
        rating: patch.rating ?? state.rating,
        comment: patch.comment ?? state.comment,
        photo_count: state.photo_count + (patch.addPhoto ? 1 : 0),
        prompt_count: patch.resetPrompt ? 0 : state.prompt_count + (patch.incrementPrompt ? 1 : 0),
    };
}

let failures = 0;
function check(label: string, cond: boolean, detail = "") {
    if (cond) {
        console.log(`  ✓ ${label}`);
    } else {
        console.log(`  ✗ ${label} ${detail}`);
        failures++;
    }
}

// ── parseRating ──────────────────────────────────────────────────────────────
console.log("\n── parseRating ──");
const ratingCases: Array<[string, number | null]> = [
    ["5", 5],
    ["1", 1],
    ["5 estrellas", 5],
    ["le pongo un 4", 4],
    ["⭐⭐⭐⭐⭐", 5],
    ["⭐⭐⭐", 3],
    ["5/5", 5],
    ["4 de 5", 4],
    ["cinco", 5],
    ["tres", 3],
    ["excelente todo", null],
    ["mi pedido es el 4562", null],   // no debe confundir nro de pedido
    ["", null],
    ["9", null],
];
for (const [input, expected] of ratingCases) {
    const got = parseRating(input);
    check(`"${input}" → ${expected}`, got === expected, `(dio ${got})`);
}

// ── Camino feliz completo ────────────────────────────────────────────────────
console.log("\n── camino feliz: 5★ → comentario → foto → cupón ──");
{
    let s = fresh("sent");
    let r = advanceReviewFlow(s, { type: "text", body: "hola", hasImage: false }, CONFIG);
    check("primer mensaje pide puntuación", r.reply?.includes("1 al 5") === true);
    s = apply(s, r.patch);
    check("pasa a awaiting_rating", s.step === "awaiting_rating");

    r = advanceReviewFlow(s, { type: "text", body: "5", hasImage: false }, CONFIG);
    s = apply(s, r.patch);
    check("guarda rating 5", s.rating === 5);
    check("pide comentario", s.step === "awaiting_comment");
    check("copy positivo para 5★", r.reply?.includes("más te gustó") === true);

    r = advanceReviewFlow(s, { type: "text", body: "Hermoso el mueble, llegó rapidísimo", hasImage: false }, CONFIG);
    s = apply(s, r.patch);
    check("guarda comentario", s.comment === "Hermoso el mueble, llegó rapidísimo");
    check("pide foto con descuento", r.reply?.includes("10% OFF") === true);
    check("pasa a awaiting_photo", s.step === "awaiting_photo");

    r = advanceReviewFlow(s, { type: "image", body: "", hasImage: true }, CONFIG);
    s = apply(s, r.patch);
    check("emite cupón", r.issueCoupon === true);
    check("guarda la foto", r.savePhoto === true);
    check("manda el código", r.reply?.includes("TUBU-REV-A1B2") === true);
    check("queda completed", s.step === "completed");
    check("cuenta 1 foto", s.photo_count === 1);
}

// ── Puntuación baja: copy distinto ───────────────────────────────────────────
console.log("\n── rating bajo (2★) usa otro copy ──");
{
    const s = fresh("awaiting_rating");
    const r = advanceReviewFlow(s, { type: "text", body: "2", hasImage: false }, CONFIG);
    check("reconoce 2★", r.patch.rating === 2);
    check("pregunta qué salió mal", r.reply?.includes("qué salió mal") === true);
    check("no felicita", r.reply?.includes("Nos alegra") !== true);
}

// ── Contesta todo junto en el primer mensaje ─────────────────────────────────
console.log("\n── se saltea paso si ya manda la puntuación ──");
{
    const s = fresh("sent");
    const r = advanceReviewFlow(s, { type: "text", body: "5 estrellas!", hasImage: false }, CONFIG);
    check("captura rating del primer mensaje", r.patch.rating === 5);
    check("salta directo a comentario", r.patch.step === "awaiting_comment");
}

// ── Manda la foto antes del comentario ───────────────────────────────────────
console.log("\n── manda foto cuando se esperaba comentario ──");
{
    const s = fresh("awaiting_comment");
    const r = advanceReviewFlow(s, { type: "image", body: "acá va", hasImage: true }, CONFIG);
    check("acepta la foto igual", r.savePhoto === true);
    check("emite cupón", r.issueCoupon === true);
    check("usa el caption como comentario", r.patch.comment === "acá va");
    check("completa", r.patch.step === "completed");
}

// ── No entiende: repregunta y después afloja ─────────────────────────────────
console.log("\n── repregunta acotada, no insiste para siempre ──");
{
    let s = fresh("awaiting_rating");
    let r = advanceReviewFlow(s, { type: "text", body: "qué tal todo", hasImage: false }, CONFIG);
    check("repregunta la primera vez", r.reply?.includes("no te entendí") === true);
    s = apply(s, r.patch);

    r = advanceReviewFlow(s, { type: "text", body: "ehh", hasImage: false }, CONFIG);
    check("repregunta la segunda vez", r.reply?.includes("no te entendí") === true);
    s = apply(s, r.patch);

    r = advanceReviewFlow(s, { type: "text", body: "mmm", hasImage: false }, CONFIG);
    s = apply(s, r.patch);
    check("a la tercera deja de insistir", s.step === "completed");
    check("se despide bien", r.reply?.includes("tranquilo") === true);
}

// ── Opt-out en cualquier momento ─────────────────────────────────────────────
console.log("\n── pedido de baja corta el flujo ──");
for (const step of ["sent", "awaiting_rating", "awaiting_comment", "awaiting_photo"] as const) {
    const s = fresh(step);
    const r = advanceReviewFlow(s, { type: "text", body: "no quiero recibir más mensajes", hasImage: false }, CONFIG);
    check(`desde ${step} → declined`, r.patch.step === "declined");
}

// ── Rechaza la foto ──────────────────────────────────────────────────────────
console.log("\n── rechaza mandar foto ──");
{
    const s = fresh("awaiting_photo");
    const r = advanceReviewFlow(s, { type: "text", body: "no gracias", hasImage: false }, CONFIG);
    check("cierra sin cupón", r.patch.step === "completed" && r.issueCoupon === false);
}

// ── Estados terminales no responden ──────────────────────────────────────────
console.log("\n── estados terminales quedan mudos ──");
for (const step of ["completed", "declined", "expired"] as const) {
    const s = fresh(step);
    const r = advanceReviewFlow(s, { type: "text", body: "hola", hasImage: false }, CONFIG);
    check(`${step} no contesta`, r.reply === null);
}

console.log(`\n${failures === 0 ? "TODO OK" : `${failures} FALLAS`}\n`);
process.exit(failures === 0 ? 0 : 1);
