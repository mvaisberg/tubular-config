import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { detectDevice } from '@/lib/device';

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'supabase not configured' }, { status: 500 });
        }
        const supabase = createClient(supabaseUrl, supabaseKey);

        const device = detectDevice(req.headers);

        const { data: row, error: readErr } = await supabase
            .from('quotes')
            .select('views')
            .eq('id', id)
            .single();

        if (readErr || !row) {
            return NextResponse.json({ error: 'quote not found' }, { status: 404 });
        }

        const nextViews = (typeof row.views === 'number' ? row.views : 0) + 1;

        const { error: writeErr } = await supabase
            .from('quotes')
            .update({
                views: nextViews,
                last_opened_at: new Date().toISOString(),
                device_last_opened: device,
            })
            .eq('id', id);

        if (writeErr) {
            return NextResponse.json({ error: writeErr.message }, { status: 500 });
        }

        return NextResponse.json({ views: nextViews });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'internal error' }, { status: 500 });
    }
}
