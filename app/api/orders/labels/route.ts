// Genera un PDF con varias etiquetas: 1 por hoja de 100×150mm, para impresora
// térmica de etiquetas. Recibe { ids: string[] } (uno o varios pedidos).

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { jsPDF } from 'jspdf';
import { drawLabel, LABEL_FIELDS, OrderRow } from '@/lib/label';

export async function POST(req: Request) {
    try {
        const auth = await createClient();
        const { data: { user } } = await auth.auth.getUser();
        if (!user) return new NextResponse('Unauthorized', { status: 401 });

        let body: { ids?: string[] };
        try { body = await req.json(); } catch { return new NextResponse('Bad JSON', { status: 400 }); }
        const ids = (body.ids || []).filter(Boolean);
        if (ids.length === 0) return new NextResponse('No ids', { status: 400 });

        const { data: orders, error } = await auth
            .from('admin_orders')
            .select(LABEL_FIELDS)
            .in('id', ids);

        if (error || !orders || orders.length === 0) {
            return new NextResponse('Orders not found', { status: 404 });
        }

        // Mantener el orden en que llegaron los ids seleccionados.
        const byId = new Map<string, OrderRow>((orders as OrderRow[]).map(o => [o.id, o]));
        const ordered = ids.map(id => byId.get(id)).filter(Boolean) as OrderRow[];

        // Página de exactamente 100×150mm, una etiqueta por página.
        const doc = new jsPDF({ unit: 'mm', format: [100, 150] });
        ordered.forEach((order, i) => {
            if (i > 0) doc.addPage([100, 150], 'portrait');
            drawLabel(doc, 0, 0, order);
        });

        const pdfOutput = doc.output('arraybuffer');
        return new NextResponse(pdfOutput, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="etiquetas-${ordered.length}.pdf"`,
            },
        });
    } catch (e) {
        console.error('Error generating bulk labels PDF:', e);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
