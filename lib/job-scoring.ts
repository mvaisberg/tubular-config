// Parseo y scoring de postulaciones laborales.
// Los campos vienen de texto libre (sueldo y tiempo de viaje), así que se
// normalizan con heurísticas y se muestra el valor interpretado en la ficha
// para que el equipo pueda verificarlo de un vistazo.

/**
 * Sueldo pretendido → número en pesos.
 * Acepta "900.000", "1,200,000", "800 mil a 900 mil", "1.2 millones", "1200000".
 * Ante un rango toma el techo (lo máximo que pide).
 */
export function parseSalary(raw: string | null): number | null {
    if (!raw) return null;
    const txt = raw.toLowerCase().replace(/\$|ars|pesos/g, " ").trim();
    if (!txt) return null;

    const values: number[] = [];
    // Números con su sufijo opcional (mil / millón), en orden de aparición.
    const re = /(\d+(?:[.,]\d+)*)\s*(millon(?:es)?|mill|m\b|mil\b|k\b)?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(txt)) !== null) {
        const rawNum = m[1];
        const suffix = m[2];
        // "1.200.000" y "1,200,000" son separadores de miles; "1.2" con sufijo es decimal.
        let n: number;
        const groups = rawNum.split(/[.,]/);
        const looksDecimal = groups.length === 2 && groups[1].length <= 2 && !!suffix;
        n = looksDecimal ? parseFloat(rawNum.replace(",", ".")) : parseFloat(rawNum.replace(/[.,]/g, ""));
        if (!isFinite(n) || n <= 0) continue;

        if (suffix) {
            if (/^(millon|milones|millones|mill|m)$/.test(suffix)) n *= 1_000_000;
            else n *= 1_000; // mil / k
        } else if (n < 10_000) {
            // "1.300" o "900" sueltos: en sueldos argentinos son miles.
            n *= 1_000;
        }
        values.push(n);
    }
    if (!values.length) return null;
    const max = Math.max(...values);
    // Menos de $100.000 no es un sueldo: es "0", "indefinido" o un dato mal cargado.
    return max >= 100_000 ? max : null;
}

/** Tiempo de viaje declarado → minutos. "20 minutos", "1 hora y 30", "2hs micro". */
export function parseCommuteMinutes(raw: string | null): number | null {
    if (!raw) return null;
    const txt = raw.toLowerCase();
    let minutes = 0;
    let found = false;

    const h = txt.match(/(\d+(?:[.,]\d+)?)\s*(?:h\b|hs\b|hora)/);
    if (h) { minutes += parseFloat(h[1].replace(",", ".")) * 60; found = true; }
    const mm = txt.match(/(\d+)\s*(?:'|min)/);
    if (mm) { minutes += parseInt(mm[1], 10); found = true; }

    if (!found) {
        // "40 minutos" ya cubierto; un número suelto chico se lee como minutos.
        const n = txt.match(/\b(\d{1,3})\b/);
        if (n) { const v = parseInt(n[1], 10); if (v > 0 && v <= 180) { minutes = v; found = true; } }
    }
    return found ? Math.round(minutes) : null;
}

export function ageFromYear(year: number | null): number | null {
    if (!year || year < 1940 || year > 2015) return null;
    return new Date().getFullYear() - year;
}

export interface Criteria { ageMin: number; ageMax: number; salaryMax: number }
export const DEFAULT_CRITERIA: Criteria = { ageMin: 18, ageMax: 30, salaryMax: 1_000_000 };

export interface Evaluation {
    passes: boolean;
    reasons: string[];      // por qué NO pasa
    age: number | null;
    salary: number | null;
    commute: number | null;
    score: number;          // para ordenar dentro de los recomendados
}

export function evaluate(app: {
    birth_year: number | null;
    salary_expectation: string | null;
    location: string | null;
    available_schedule: boolean | null;
    physical_ok: boolean | null;
    experience: string | null;
    strengths: string | null;
    cv_path: string | null;
    drivers_license: string | null;
}, c: Criteria = DEFAULT_CRITERIA): Evaluation {
    const age = ageFromYear(app.birth_year);
    const salary = parseSalary(app.salary_expectation);
    const commute = parseCommuteMinutes(app.location);
    const reasons: string[] = [];

    if (app.available_schedule === false) reasons.push("no puede el horario");
    if (app.physical_ok === false) reasons.push("no puede el esfuerzo físico");
    if (age === null) reasons.push("sin edad declarada");
    else if (age < c.ageMin || age > c.ageMax) reasons.push(`${age} años (busca ${c.ageMin}–${c.ageMax})`);
    if (salary === null) reasons.push("sueldo no interpretable");
    else if (salary > c.salaryMax) reasons.push(`pide $${salary.toLocaleString("es-AR")}`);

    // Score: viaje corto pesa más que todo (predice rotación), después margen de
    // sueldo, y suma si se tomó el trabajo de contar su experiencia o dejar CV.
    let score = 0;
    if (commute !== null) score += Math.max(0, 60 - commute);       // 0–60
    if (salary !== null) score += Math.max(0, (c.salaryMax - salary) / c.salaryMax) * 25; // 0–25
    const expLen = (app.experience || "").trim().length;
    score += Math.min(expLen / 20, 10);                              // 0–10
    if ((app.strengths || "").trim().length > 15) score += 3;
    if (app.cv_path) score += 4;
    if (app.drivers_license && app.drivers_license !== "no") score += 3;

    return { passes: reasons.length === 0, reasons, age, salary, commute, score: Math.round(score) };
}
