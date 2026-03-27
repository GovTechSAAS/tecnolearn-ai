
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('ENV:', { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });
  console.error('Missing Supabase ENV variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
  console.log('Checking student_progress table with SERVICE ROLE...');
  
  // Try to select
  const { data, error } = await supabase
    .from('student_progress')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error selecting from student_progress:', error);
    if (error.code === '42P01') {
      console.log('RESULT: Table does NOT exist.');
    } else if (error.code === '42501') {
      console.log('RESULT: Permission Denied (RLS issue or missing table).');
    }
  } else {
    console.log('RESULT: Table exists and is accessible.');
  }

  // Try to describe columns via RPC or metadata if available, 
  // but let's just try to insert a dummy (it should fail if RLS is on, but tell us if table exists)
  const { error: insertError } = await supabase
    .from('student_progress')
    .insert({ student_id: '00000000-0000-0000-0000-000000000000', node_id: '00000000-0000-0000-0000-000000000000', status: 'completed' });
  
  if (insertError) {
    console.log('Insert attempt error (expected if RLS or missing table):', insertError.message);
  }
}

checkTable();
