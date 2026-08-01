import { jsPDF } from 'jspdf';
import fs from 'node:fs';
import path from 'node:path';

const BRAND_BLUE: [number, number, number] = [30, 49, 75];
const TEXT_DARK: [number, number, number] = [33, 33, 33];
const TEXT_MUTED: [number, number, number] = [120, 120, 120];

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

export function formatOrderNumber(n: number | null | undefined): string {
    if (!n) return 'TUB-—';
    return `TUB-${String(n).padStart(4, '0')}`;
}

export interface OrderRow {
    id: string;
    order_number: number | null;
    client_name: string;
    client_whatsapp: string | null;
    shipping_type: 'pickup' | 'delivery' | null;
    shipping_address: string | null;
    created_at: string;
    items: Array<{ description: string; quantity: number }> | null;
    observations: string | null;
}

export const LABEL_FIELDS = 'id, order_number, client_name, client_whatsapp, shipping_type, shipping_address, created_at, items, observations';

// Dibuja una etiqueta de 100×150mm en el offset (x, y).
export function drawLabel(doc: jsPDF, x: number, y: number, order: OrderRow) {
    const W = 100, H = 150;
    const inner = 5;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.rect(x, y, W, H);

    doc.setFillColor(...BRAND_BLUE);
    doc.rect(x, y, W, 18, 'F');

    const logo = getLogoDataUrl();
    if (logo) {
        doc.addImage(logo, 'PNG', x + inner, y + 5, 22, 9);
    } else {
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('TUBULAR', x + inner, y + 11);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(formatOrderNumber(order.order_number), x + W - inner, y + 11, { align: 'right' });

    let cy = y + 18 + 8;
    doc.setTextColor(...TEXT_MUTED);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE', x + inner, cy);
    cy += 5;

    doc.setTextColor(...TEXT_DARK);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const nameLines = doc.splitTextToSize(order.client_name || '—', W - inner * 2);
    doc.text(nameLines.slice(0, 2), x + inner, cy);
    cy += 6 * Math.min(nameLines.length, 2);

    if (order.client_whatsapp) {
        cy += 2;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...TEXT_MUTED);
        doc.text(order.client_whatsapp, x + inner, cy);
        cy += 5;
    }

    cy += 4;
    const isDelivery = order.shipping_type === 'delivery';
    const deliveryColor: [number, number, number] = isDelivery ? [99, 102, 241] : [16, 185, 129];
    doc.setFillColor(...deliveryColor);
    doc.roundedRect(x + inner, cy - 4, W - inner * 2, 8, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(isDelivery ? 'ENVÍO A DOMICILIO' : 'RETIRO EN SHOWROOM', x + W / 2, cy + 1, { align: 'center' });
    cy += 8;

    if (isDelivery && order.shipping_address) {
        cy += 5;
        doc.setTextColor(...TEXT_MUTED);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.text('DIRECCIÓN', x + inner, cy);
        cy += 4;

        doc.setTextColor(...TEXT_DARK);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const addrLines = doc.splitTextToSize(order.shipping_address, W - inner * 2);
        doc.text(addrLines.slice(0, 4), x + inner, cy);
        cy += 4 * Math.min(addrLines.length, 4);
    }

    const items = order.items || [];
    const totalUnits = items.reduce((acc, i) => acc + (i.quantity || 0), 0);
    if (items.length > 0) {
        cy += 5;
        doc.setTextColor(...TEXT_MUTED);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.text(`ÍTEMS (${totalUnits} ${totalUnits === 1 ? 'unidad' : 'unidades'})`, x + inner, cy);
        cy += 4;

        doc.setTextColor(...TEXT_DARK);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const maxItemsToShow = 4;
        items.slice(0, maxItemsToShow).forEach(item => {
            const line = `${item.quantity}× ${item.description || '—'}`;
            const wrapped = doc.splitTextToSize(line, W - inner * 2);
            doc.text(wrapped.slice(0, 1), x + inner, cy);
            cy += 4;
        });
        if (items.length > maxItemsToShow) {
            doc.setTextColor(...TEXT_MUTED);
            doc.setFontSize(7);
            doc.text(`+${items.length - maxItemsToShow} más`, x + inner, cy);
            cy += 4;
        }
    }

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(x + inner, y + H - 8, x + W - inner, y + H - 8);

    doc.setTextColor(...TEXT_MUTED);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const dateStr = new Date(order.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.text(dateStr, x + inner, y + H - 3);
    doc.text('tubular.com.ar', x + W - inner, y + H - 3, { align: 'right' });
}
