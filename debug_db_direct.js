
const { createClient } = require('@supabase/supabase-js');

// Hardcoded for direct debug since dotenv is failing in this environment
const supabaseUrl = 'https://afneclrksetjnjfheuvk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbmVjbHJrc2V0am5qZmhldXZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUzMzc1NCwiZXhwIjoyMDkwMTA5NzU0fQ.VTLhUySjdt-viOs9VhhCudUV9URk6Shswc_oSEVVUH0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDB() {
  console.log('--- DB DEBUG START ---');
  
  // 1. Check if table exists
  const { data: tableCheck, error: tableError } = await supabase
    .from('student_progress')
    .select('*')
    .limit(0);
    
  if (tableError) {
    console.error('Table Error:', tableError.message, tableError.code);
  } else {
    console.log('Table exists. Select success.');
  }

  // 2. Try a real insert (cleaning up after)
  console.log('Attempting service role insert test...');
  const testStudentId = '00000000-0000-0000-0000-000000000000';
  const testNodeId = '00000000-0000-0000-0000-000000000000';
  
  const { error: insError } = await supabase
    .from('student_progress')
    .upsert({ 
      student_id: testStudentId, 
      node_id: testNodeId, 
      status: 'completed' 
    });
    
  if (insError) {
    console.error('Insert Test Failed:', insError.message, insError.code, insError.details);
  } else {
    console.log('Insert Test Success! Schema is valid.');
    // Cleanup
    await supabase.from('student_progress').delete().eq('student_id', testStudentId);
  }

  console.log('--- DB DEBUG END ---');
}

debugDB();
