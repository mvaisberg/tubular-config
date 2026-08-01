import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserRole, canViewPricing } from '@/lib/auth';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import fs from 'node:fs';
import path from 'node:path';

const BRAND_BLUE: [number, number, number] = [30, 49, 75]; // #1e314b
const TEXT_DARK: [number, number, number] = [33, 33, 33];
const TEXT_MUTED: [number, number, number] = [120, 120, 120];
const BORDER_LIGHT: [number, number, number] = [220, 220, 220];

const PAYMENT_LABEL: Record<string, string> = {
    transfer: 'Transferencia',
    cash: 'Efectivo',
    other: 'Otro',
};

const SHIPPING_LABEL: Record<string, string> = {
    pickup: 'Retiro en showroom',
    delivery: 'Envío a domicilio',
};

let cachedLogo: string | null = null;
function getLogoDataUrl(): string | null {
    if (cachedLogo) return cachedLogo;
    try {
        const p = path.join(process.cwd(), 'public/brandbook/logo/logo-blanco.png');
        const buf = fs.readFileSync(p);
        cachedLogo = `data:image/png;base64,${buf.toString('base64')}`;
        return cachedLogo;
    } catch {
        return null;
    }
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const id = (await params).id;
        const role = await getUserRole();
        if (!canViewPricing(role)) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        const supabase = await createClient();

        const { data: order, error } = await supabase
            .from('admin_orders')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !order) {
            return new NextResponse('Order not found', { status: 404 });
        }

        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 14;

        // ============ HEADER BAND ============
        doc.setFillColor(...BRAND_BLUE);
        doc.rect(0, 0, pageW, 32, 'F');

        const logo = getLogoDataUrl();
        if (logo) {
            // Logo blanco, izquierda. Tamaño calculado para no deformar.
            doc.addImage(logo, 'PNG', margin, 9, 32, 14);
        } else {
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('TUBULAR', margin, 20);
        }

        // Right side: order ref and date
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const orderRef = order.order_number
            ? `TUB-${String(order.order_number).padStart(4, '0')}`
            : `Pedido #${order.id.slice(0, 8).toUpperCase()}`;
        const orderDate = format(new Date(order.created_at), "d 'de' MMMM, yyyy", { locale: es });
        doc.text(orderRef, pageW - margin, 14, { align: 'right' });
        doc.text(orderDate, pageW - margin, 20, { align: 'right' });

        // Status badge
        const isPartial = order.status === 'partial' || (Number(order.paid_amount) > 0 && Number(order.paid_amount) < Number(order.final_amount));
        const statusLabel = order.status === 'paid' ? 'PAGADO' : isPartial ? 'SEÑA' : 'PENDIENTE';
        const statusColor: [number, number, number] = order.status === 'paid' ? [16, 185, 129] : isPartial ? [99, 102, 241] : [245, 158, 11];
        doc.setFillColor(...statusColor);
        doc.roundedRect(pageW - margin - 24, 24, 24, 5.5, 1, 1, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(statusLabel, pageW - margin - 12, 27.7, { align: 'center' });

        // ============ CLIENT SECTION ============
        let y = 44;
        doc.setTextColor(...TEXT_MUTED);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('CLIENTE', margin, y);
        doc.setTextColor(...TEXT_DARK);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(order.client_name, margin, y + 6);
        y += 11;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        if (order.client_whatsapp) {
            doc.text(`WhatsApp: ${order.client_whatsapp}`, margin, y);
            y += 5;
        }

        // ============ ENTREGA ============
        const shipping = order.shipping_type || 'pickup';
        doc.setTextColor(...TEXT_MUTED);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('ENTREGA', margin, y + 3);
        doc.setTextColor(...TEXT_DARK);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(SHIPPING_LABEL[shipping] || shipping, margin, y + 9);
        if (shipping === 'delivery' && order.shipping_address) {
            const lines = doc.splitTextToSize(order.shipping_address, pageW - margin * 2);
            doc.text(lines, margin, y + 14);
            y += 5 * lines.length;
        }
        y += 16;

        // ============ ITEMS TABLE ============
        const tableRows: string[][] = (order.items || []).map((item: { description: string; quantity: number; unit_price: number }) => [
            item.description || '—',
            String(item.quantity),
            `$${Number(item.unit_price).toLocaleString('es-AR')}`,
            `$${(item.quantity * item.unit_price).toLocaleString('es-AR')}`,
        ]);

        autoTable(doc, {
            head: [['Descripción', 'Cant.', 'P. Unitario', 'Subtotal']],
            body: tableRows,
            startY: y,
            margin: { left: margin, right: margin },
            theme: 'plain',
            styles: {
                fontSize: 9.5,
                cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
                lineColor: BORDER_LIGHT,
                lineWidth: 0.2,
                textColor: TEXT_DARK,
            },
            headStyles: {
                fillColor: [245, 246, 248],
                textColor: TEXT_MUTED,
                fontStyle: 'bold',
                fontSize: 8,
                halign: 'left',
            },
            columnStyles: {
                1: { halign: 'center', cellWidth: 18 },
                2: { halign: 'right', cellWidth: 32 },
                3: { halign: 'right', cellWidth: 32, fontStyle: 'bold' },
            },
            didDrawCell: (data) => {
                if (data.section === 'body' && data.column.index === 0) {
                    // no-op (placeholder for possible icon)
                }
            },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const afterTable = (doc as any).lastAutoTable.finalY;

        // ============ TOTALS ============
        const totalsX = pageW - margin - 80;
        const totalsLabelX = totalsX;
        const totalsValueX = pageW - margin;
        let ty = afterTable + 8;

        const subtotal = (order.items || []).reduce(
            (acc: number, i: { quantity: number; unit_price: number }) => acc + i.quantity * i.unit_price,
            0
        );

        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...TEXT_MUTED);
        doc.text('Subtotal', totalsLabelX, ty);
        doc.setTextColor(...TEXT_DARK);
        doc.text(`$${subtotal.toLocaleString('es-AR')}`, totalsValueX, ty, { align: 'right' });
        ty += 6;

        if (Number(order.discount_percentage) > 0) {
            const discountAmount = subtotal * (Number(order.discount_percentage) / 100);
            doc.setTextColor(...TEXT_MUTED);
            doc.text(`Descuento (${order.discount_percentage}%)`, totalsLabelX, ty);
            doc.setTextColor(99, 102, 241); // indigo
            doc.text(`-$${discountAmount.toLocaleString('es-AR')}`, totalsValueX, ty, { align: 'right' });
            ty += 6;
        }

        // Línea divisoria
        doc.setDrawColor(...BORDER_LIGHT);
        doc.setLineWidth(0.3);
        doc.line(totalsLabelX, ty, totalsValueX, ty);
        ty += 5;

        // Total grande
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...TEXT_DARK);
        doc.text('Total final', totalsLabelX, ty + 2);
        doc.setFontSize(16);
        doc.text(`$${Number(order.final_amount).toLocaleString('es-AR')}`, totalsValueX, ty + 4, { align: 'right' });
        ty += 12;

        // Forma de pago
        if (order.payment_method) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...TEXT_MUTED);
            doc.text(`Medio de pago: ${PAYMENT_LABEL[order.payment_method] || order.payment_method}`, totalsLabelX, ty);
            ty += 5;
        }

        // Seña + saldo
        const paidAmt = Number(order.paid_amount) || 0;
        const finalAmt = Number(order.final_amount) || 0;
        if (isPartial && paidAmt > 0) {
            ty += 2;
            doc.setDrawColor(...BORDER_LIGHT);
            doc.line(totalsLabelX, ty, totalsValueX, ty);
            ty += 5;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(99, 102, 241);
            doc.text('Seña pagada', totalsLabelX, ty);
            doc.text(`$${paidAmt.toLocaleString('es-AR')}`, totalsValueX, ty, { align: 'right' });
            ty += 6;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...TEXT_DARK);
            doc.text('Saldo a pagar', totalsLabelX, ty + 1);
            doc.setFontSize(14);
            doc.text(`$${(finalAmt - paidAmt).toLocaleString('es-AR')}`, totalsValueX, ty + 2, { align: 'right' });
            ty += 10;
        }

        // Las observaciones/comentarios del pedido NO se imprimen en el PDF:
        // son notas internas, se ven solo en el manager.

        // ============ FOOTER ============
        const pageH = doc.internal.pageSize.getHeight();
        doc.setDrawColor(...BORDER_LIGHT);
        doc.line(margin, pageH - 16, pageW - margin, pageH - 16);
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_MUTED);
        doc.setFont('helvetica', 'normal');
        doc.text('Tubular · tubular.com.ar', margin, pageH - 10);
        doc.text(`Generado el ${format(new Date(), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}`, pageW - margin, pageH - 10, { align: 'right' });

        const pdfOutput = doc.output('arraybuffer');

        return new NextResponse(pdfOutput, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="tubular-pedido-${order.id.slice(0, 8)}.pdf"`,
            },
        });
    } catch (e) {
        console.error('Error generating PDF:', e);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
