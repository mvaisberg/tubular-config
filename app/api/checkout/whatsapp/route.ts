import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { detectDevice } from '@/lib/device';

export async function POST(req: Request) {
    try {
        const { modules, hasWheels, totalPrice, usdExchangeRate, imageData, clientName } = await req.json();
        const device = detectDevice(req.headers);

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error("Faltan credenciales de Supabase");
            return NextResponse.json(
                { error: "Error de configuración de la base de datos." },
                { status: 500 }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const rawExchange = usdExchangeRate || 1000;
        const configuration: any = { modules, hasWheels: !!hasWheels };

        // Handle image data upload if present
        if (imageData && typeof imageData === 'string') {
            try {
                // Ensure bucket exists or create it
                const { data: buckets } = await supabase.storage.listBuckets();
                if (!buckets?.find(b => b.name === 'quotes')) {
                    await supabase.storage.createBucket('quotes', { public: true });
                }

                // Strip the data:image/jpeg;base64, prefix
                const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                const uniqueFilename = `quote_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('quotes')
                    .upload(uniqueFilename, buffer, {
                        contentType: 'image/jpeg',
                        upsert: false
                    });

                if (uploadError) {
                    console.error("Failed to upload image to Supabase Storage:", uploadError);
                } else if (uploadData) {
                    const { data: publicUrlData } = supabase.storage
                        .from('quotes')
                        .getPublicUrl(uploadData.path);

                    if (publicUrlData && publicUrlData.publicUrl) {
                        configuration.image_url = publicUrlData.publicUrl;
                    }
                }
            } catch (imgError) {
                console.error("Error processing image upload:", imgError);
                // Continue without image if it fails
            }
        }

        const quoteData = {
            client_name: clientName || "Cotización WhatsApp",
            configuration,
            total_price_ars: Math.round(totalPrice),
            total_price_usd: Math.round(totalPrice / rawExchange),
            device,
        };

        const { data, error } = await supabase.from('quotes').insert([quoteData]).select().single();

        if (error) {
            console.error("No se pudo guardar la cotización en Supabase", error);
            return NextResponse.json({ error: "No se pudo generar la cotización." }, { status: 500 });
        }

        return NextResponse.json({ quoteId: data.id });

    } catch (error: any) {
        console.error("Excepción en whatsapp checkout:", error);
        return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
    }
}
