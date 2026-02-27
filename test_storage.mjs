import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: buckets } = await supabase.storage.listBuckets();
    console.log("Buckets:", buckets?.map(b => b.name));

    if (!buckets?.find(b => b.name === 'quotes')) {
        console.log("Creating quotes bucket...");
        const res = await supabase.storage.createBucket('quotes', { public: true });
        console.log("Bucket creation result:", res);
    } else {
        console.log("Bucket 'quotes' already exists.");
    }
}
check();
