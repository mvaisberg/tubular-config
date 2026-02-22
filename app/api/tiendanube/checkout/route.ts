import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { modules, totalPrice } = await req.json();

        // 1. Validar variables de entorno requeridas
        // Nota: Para una app privada o de un solo store, podés usar variables de entorno.
        // Si no las tenés, debés primero hacer el flujo OAuth (App ID / Client Secret).
        const storeId = process.env.TIENDANUBE_STORE_ID;
        const accessToken = process.env.TIENDANUBE_ACCESS_TOKEN;
        const userAgent = process.env.TIENDANUBE_USER_AGENT || "Tubular (info@tubular.com.ar)";

        if (!storeId || !accessToken) {
            console.error("Faltan credenciales de Tiendanube (TIENDANUBE_STORE_ID o TIENDANUBE_ACCESS_TOKEN)");
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

        // 2. Crear el Producto Dinámico y Oculto
        // Usamos un nombre representativo y único para no colisionar
        const productName = `Configuración Tubular Personalizada`;
        const skuAleatorio = `TUB-${Date.now().toString().slice(-6)}`;

        const productPayload = {
            name: { es: productName },
            published: false, // ¡Oculto! No aparecerá en los listados
            variants: [
                {
                    price: String(totalPrice), // Precio total de la configuración
                    stock: 1, // Fundamental para poder comprar
                    sku: skuAleatorio
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
            return NextResponse.json({ error: "Error al crear el producto en Tiendanube" }, { status: 500 });
        }

        const product = await createProductRes.json();
        const variantId = product.variants[0].id;

        // 3. Crear el Draft Order (Orden Borrador)
        // Agregamos las properties con los detalles de qué módulos eligió
        const properties = [
            { name: "Cantidad de Módulos", value: String(modules.length) },
            { name: "Color", value: modules[0]?.color || "Varios" },
            { name: "Material", value: modules[0]?.material || "Mixto" },
            { name: "Configuración Ref", value: skuAleatorio }
        ];

        const draftOrderPayload = {
            products: [
                {
                    variant_id: variantId,
                    quantity: 1,
                    properties
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
            return NextResponse.json({ error: "Error al generar link de pago" }, { status: 500 });
        }

        const draftOrder = await draftOrderRes.json();

        // El abandon_checkout_url es el link único para el carrito pre-armado
        const checkoutUrl = draftOrder.abandoned_checkout_url;

        if (!checkoutUrl) {
            console.error("Tiendanube no retornó checkout URL", draftOrder);
            return NextResponse.json({ error: "La orden se creó pero no se generó el enlace" }, { status: 500 });
        }

        // Devolver el link al frontend
        return NextResponse.json({ checkoutUrl, productId: product.id });

    } catch (error: any) {
        console.error("Excepción en checkout flow:", error);
        return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
    }
}
