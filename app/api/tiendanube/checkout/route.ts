import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { modules, totalPrice, imageDataUrl, usdExchangeRate } = await req.json();

        // 1. Validar variables de entorno requeridas
        const storeId = process.env.TIENDANUBE_STORE_ID;
        const accessToken = process.env.TIENDANUBE_ACCESS_TOKEN;
        const userAgent = process.env.TIENDANUBE_USER_AGENT || "Tubular (info@tubular.com.ar)";

        if (!storeId || !accessToken) {
            console.error("Faltan credenciales de Tiendanube");
            return NextResponse.json(
                { error: "La integración con Tiendanube aún no está configurada." },
                { status: 500 }
            );
        }

        const headers = {
            "Authentication": `bearer ${accessToken}`,
            "User-Agent": userAgent,
            "Content-Type": "application/json"
        };

        const randomCode = Date.now().toString().slice(-6);
        const uniqueId = `TUB-${randomCode}`;
        const productName = `Configuración Personalizada ${uniqueId}`;

        // 2. Crear el Producto Dinámico y Oculto sin opciones y sin imágenes (todavía)
        const productPayload = {
            name: { es: productName },
            published: false,
            variants: [
                {
                    price: String(totalPrice),
                    stock: 1,
                    sku: uniqueId
                }
            ]
        };

        const createProductRes = await fetch(`https://api.tiendanube.com/v1/${storeId}/products`, {
            method: 'POST',
            headers,
            body: JSON.stringify(productPayload)
        });

        if (!createProductRes.ok) {
            const errBody = await createProductRes.text();
            console.error("Error al crear producto oculto TN:", errBody);
            return NextResponse.json({ error: `Error al crear el producto: ${errBody}`, details: errBody }, { status: 500 });
        }

        let product = await createProductRes.json();
        const variantId = product.variants[0].id;

        // Subir la imagen si existe (haciendolo luego de crear el producto, como manda Tiendanube)
        let coverImageUrl = null;
        if (imageDataUrl) {
            const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
            try {
                const addImageRes = await fetch(`https://api.tiendanube.com/v1/${storeId}/products/${product.id}/images`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ attachment: base64Data, filename: `${uniqueId}.jpg` })
                });

                if (addImageRes.ok) {
                    const imgData = await addImageRes.json();
                    coverImageUrl = imgData.src;
                } else {
                    console.error("Error al adjuntar imagen al producto:", await addImageRes.text());
                }
            } catch (errImg) {
                console.error("Excepción adjuntando imagen:", errImg);
            }
        }

        // 3. Crear el Draft Order (Orden Borrador). Removemos 'properties' a pedido del usuario.
        const draftOrderPayload = {
            contact_email: `invitado-${randomCode}@tubular.com.ar`,
            contact_name: "Usuario",
            contact_lastname: "Invitado",
            products: [
                {
                    variant_id: variantId,
                    quantity: 1
                }
            ]
        };

        const draftOrderRes = await fetch(`https://api.tiendanube.com/v1/${storeId}/draft_orders`, {
            method: 'POST',
            headers,
            body: JSON.stringify(draftOrderPayload)
        });

        if (!draftOrderRes.ok) {
            const errDraft = await draftOrderRes.text();
            console.error("Error al crear Draft Order TN:", errDraft);
            return NextResponse.json({ error: `Error al generar link de pago: ${errDraft}`, details: errDraft }, { status: 500 });
        }

        const draftOrder = await draftOrderRes.json();
        const checkoutUrl = draftOrder.abandoned_checkout_url;

        if (!checkoutUrl) {
            return NextResponse.json({ error: "La orden se creó pero no se generó el enlace" }, { status: 500 });
        }

        // 4. Guardar en Supabase Cotizaciones (quotes)
        try {
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            const rawExchange = usdExchangeRate || 1000;
            const quoteData = {
                client_name: productName,
                configuration: {
                    modules,
                    checkout_url: checkoutUrl,
                    tiendanube_product_id: product.id,
                    image_url: coverImageUrl
                },
                total_price_ars: Math.round(totalPrice),
                total_price_usd: Math.round(totalPrice / rawExchange)
            };

            await supabase.from('quotes').insert([quoteData]);
        } catch (dbError) {
            console.error("No se pudo guardar la cotización en Supabase", dbError);
            // No detenemos el flujo solo por fallar el guardado
        }

        // Devolver el link al frontend
        return NextResponse.json({ checkoutUrl, productId: product.id });

    } catch (error: any) {
        console.error("Excepción en checkout flow:", error);
        return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
    }
}
