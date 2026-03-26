const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const lines = envLocal.split('\n');
const getEnv = (key) => lines.find(l => l.startsWith(key))?.split('=')[1]?.trim();

const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// console.log('URL:', url); 
const supabase = createClient(url, anonKey);

async function checkProfiles() {
  console.log('Checking profiles with ANON KEY...');
  const { data, error, count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' });

  if (error) {
    console.error('Profiles Error:', error);
    return;
  }

  console.log(`Visible Profiles: ${count}`);
}

checkProfiles();
