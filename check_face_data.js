const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const lines = envLocal.split('\n');
const getEnv = (key) => lines.find(l => l.startsWith(key))?.split('=')[1]?.trim();

const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');

console.log('URL:', url);
console.log('Key Length:', key?.length);

const supabase = createClient(url, key);

async function checkData() {
  console.log('Checking Supabase Connection...');
  const { data, error } = await supabase
    .from('class_enrollments')
    .select(`
      profile:profiles ( id, full_name, face_descriptor, role )
    `)
    .limit(5);

  if (error) {
    console.error('Database Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No enrollments found to check.');
    return;
  }

  data.forEach((row, i) => {
    const p = row.profile;
    console.log(`\n--- Profile ${i+1} (${p.full_name}) ---`);
    console.log('ID:', p.id);
    console.log('Role:', p.role);
    console.log('Has Descriptor?', !!p.face_descriptor);
    if (p.face_descriptor) {
        console.log('Descriptor Type:', typeof p.face_descriptor);
        console.log('Is Array?', Array.isArray(p.face_descriptor));
        console.log('Length:', p.face_descriptor.length);
        console.log('First 3 elements:', p.face_descriptor.slice(0, 3));
    }
  });
}

checkData();
