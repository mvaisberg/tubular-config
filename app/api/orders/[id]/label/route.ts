import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { jsPDF } from 'jspdf';
import { drawLabel, formatOrderNumber, LABEL_FIELDS } from '@/lib/label';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const id = (await params).id;
        const supabase = await createClient();

        const { data: order, error } = await supabase
            .from('admin_orders')
            .select(LABEL_FIELDS)
            .eq('id', id)
            .single();

        if (error || !order) {
            return new NextResponse('Order not found', { status: 404 });
        }

        // A4 portrait. 2 etiquetas side-by-side de 100×150 mm.
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();  // 210
        const labelW = 100;
        const gap = 4;
        const totalW = labelW * 2 + gap;
        const x1 = (pageW - totalW) / 2;
        const x2 = x1 + labelW + gap;
        const y = 20;

        drawLabel(doc, x1, y, order);
        drawLabel(doc, x2, y, order);

        const pdfOutput = doc.output('arraybuffer');
        return new NextResponse(pdfOutput, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${formatOrderNumber(order.order_number)}-etiqueta.pdf"`,
            },
        });
    } catch (e) {
        console.error('Error generating label PDF:', e);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
