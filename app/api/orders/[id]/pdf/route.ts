import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const id = (await params).id;
        const supabase = await createClient();

        const { data: order, error } = await supabase
            .from('admin_orders')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !order) {
            return new NextResponse('Order not found', { status: 404 });
        }

        // Initialize PDF document
        const doc = new jsPDF();

        // Add header
        doc.setFontSize(20);
        doc.text('Recibo de Orden - TUBULAR', 14, 22);

        doc.setFontSize(11);
        doc.setTextColor(100);

        // Order details
        const orderDate = format(new Date(order.created_at), "dd 'de' MMMM, yyyy - HH:mm", { locale: es });
        doc.text(`Fecha: ${orderDate}`, 14, 32);
        doc.text(`Cliente: ${order.client_name} ${order.client_whatsapp ? `(${order.client_whatsapp})` : ''}`, 14, 38);
        doc.text(`Estado: ${order.status === 'paid' ? 'Pagado' : order.status === 'partially_paid' ? 'Pago Parcial' : 'Pendiente'}`, 14, 44);

        // Items table
        const tableColumn = ["Descripción", "Cantidad", "Precio Unitario", "Subtotal"];
        const tableRows: string[][] = [];

        let subtotal = 0;

        order.items.forEach((item: any) => {
            const itemSubtotal = item.quantity * item.unit_price;
            subtotal += itemSubtotal;
            const itemData = [
                item.description,
                item.quantity.toString(),
                `$${item.unit_price.toLocaleString('es-AR')}`,
                `$${itemSubtotal.toLocaleString('es-AR')}`,
            ];
            tableRows.push(itemData);
        });

        // Use autoTable
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 55,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
        });

        const finalY = (doc as any).lastAutoTable.finalY || 55;

        // Totals
        doc.setFontSize(11);
        doc.setTextColor(0);

        doc.text(`Subtotal: $${subtotal.toLocaleString('es-AR')}`, 14, finalY + 10);

        if (order.discount_percentage > 0) {
            const discountAmount = subtotal * (order.discount_percentage / 100);
            doc.text(`Descuento (${order.discount_percentage}%): -$${discountAmount.toLocaleString('es-AR')}`, 14, finalY + 16);
        }

        doc.setFontSize(14);
        doc.text(`Total Final: $${Number(order.final_amount).toLocaleString('es-AR')}`, 14, finalY + 26);

        if (order.status === 'partially_paid') {
            doc.setFontSize(11);
            doc.setTextColor(200, 100, 0); // Orange
            doc.text(`Abonado (Seña): $${Number(order.paid_amount).toLocaleString('es-AR')}`, 14, finalY + 34);
            const remaining = order.final_amount - order.paid_amount;
            doc.text(`Restante a pagar: $${remaining.toLocaleString('es-AR')}`, 14, finalY + 40);
        } else if (order.status === 'paid') {
            doc.setTextColor(0, 150, 0); // Green
            doc.text(`PAGADO TOTALMENTE`, 14, finalY + 34);
        }

        // Output as Buffer
        const pdfOutput = doc.output('arraybuffer');

        return new NextResponse(pdfOutput, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="orden_${order.id.slice(0, 8)}.pdf"`
            }
        });

    } catch (error) {
        console.error('Error generating PDF:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
