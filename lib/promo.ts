// Promo "Color Drop" — 20% OFF en todo, del 20 de junio al 7 de julio de 2026 (extendida).
//
// Modelo acordado: el descuento baja el PRECIO BASE (precio de lista). Los
// descuentos por medio de pago (efectivo, etc.) se aplican sobre el precio ya
// descontado. Fuera de las fechas, todo vuelve a la normalidad automáticamente.

export const PROMO = {
    name: "Color Drop",
    bannerLabel: "Color Drop · hasta el 7 de julio · 20% OFF en todo",
    marqueeText: "Color Drop · 20% OFF hasta el 7 de julio · 💳 6 cuotas sin interés ó 20% adicional abonando en efectivo o transferencia 💵",
    discountPercent: 20,
    // Fechas en horario Argentina (UTC-3).
    startsAt: new Date("2026-06-20T00:00:00-03:00").getTime(),
    endsAt: new Date("2026-07-07T23:59:59-03:00").getTime(),
};

/** Color Drop FINALIZADO — desactivada de forma permanente. */
export function isPromoActive(now: number = Date.now()): boolean {
    void now;
    return false;
}

/** Aplica el descuento de la promo (si está activa) a un precio base. Siempre redondea. */
export function applyPromo(price: number, active: boolean = isPromoActive()): number {
    return Math.round(active ? price * (1 - PROMO.discountPercent / 100) : price);
}
