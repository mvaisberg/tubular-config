import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Define CORS headers for the storefront
const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Adjust this to your specific Tiendanube domain for production if needed
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, email, phone, message } = body;

        // Validation
        if (!name || !message || (!email && !phone)) {
            return NextResponse.json(
                { error: 'Name, message, and either email or phone are required.' },
                { status: 400, headers: corsHeaders }
            );
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error("Missing Supabase credentials");
            return NextResponse.json(
                { error: "Database configuration error." },
                { status: 500, headers: corsHeaders }
            );
        }

        // Use service role to bypass RLS if needed, or anon key
        const supabase = createClient(supabaseUrl, supabaseKey);

        const contactData = {
            name,
            email,
            phone,
            message,
            status: 'new'
        };

        const { data, error } = await supabase
            .from('store_contacts')
            .insert([contactData])
            .select()
            .single();

        if (error) {
            console.error("Failed to save contact to Supabase", error);
            return NextResponse.json(
                { error: "Failed to save your message. Please try again later." },
                { status: 500, headers: corsHeaders }
            );
        }

        return NextResponse.json(
            { success: true, message: "Thank you! Your message has been received.", id: data.id },
            { status: 200, headers: corsHeaders }
        );

    } catch (error: any) {
        console.error("Exception in storefront contact API:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500, headers: corsHeaders }
        );
    }
}
