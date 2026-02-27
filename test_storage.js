import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: buckets } = await supabase.storage.listBuckets();
  console.log("Buckets:", buckets?.map(b => b.name));
  if (!buckets?.find(b => b.name === 'quotes')) {
    console.log("Creating quotes bucket...");
    await supabase.storage.createBucket('quotes', { public: true });
    console.log("Bucket created");
  }
}
check();
