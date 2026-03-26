import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const searchRole = searchParams.get('searchRole');

  try {
    if (searchRole) {
      // Buscar usuários por papel (ex: professores disponíveis)
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, role, face_descriptor')
        .eq('role', searchRole)
        .order('full_name');
      
      if (error) throw error;
      return NextResponse.json(data);
    } else if (classId) {
      // Listar todos os vinculados (alunos e professores)
      const { data, error } = await supabaseAdmin
        .from('class_enrollments')
        .select(`
          student:profiles (
            id,
            full_name,
            role,
            face_descriptor
          )
        `)
        .eq('class_id', classId);

      if (error) throw error;
      return NextResponse.json(data.map((item: { student: any }) => item.student));
    } else {
      // Listar todas as turmas com contagem de alunos
      const { data, error } = await supabaseAdmin
        .from('classes')
        .select(`
          *,
          students:class_enrollments(count)
        `)
        .order('name');

      if (error) throw error;
      
      const formatted = data.map((c: { id: string, name: string, students: { count: number }[] }) => ({
        ...c,
        studentCount: c.students?.[0]?.count || 0
      }));

      return NextResponse.json(formatted);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
    try {
      const { type, classId, userId } = await req.json();
      
      if (type === 'enrollment' && classId && userId) {
        const { error } = await supabaseAdmin
          .from('class_enrollments')
          .insert({ class_id: classId, student_id: userId });
        
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
      
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao realizar matrícula';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
  try {
    const { type, id, data } = await req.json();

    if (type === 'class') {
      const { error } = await supabaseAdmin.from('classes').update(data).eq('id', id);
      if (error) throw error;
    } else if (type === 'student') {
      const { error } = await supabaseAdmin.from('profiles').update(data).eq('id', id);
      if (error) throw error;
      
      if (data.email) {
          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, { email: data.email });
          if (authError) throw authError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const id = searchParams.get('id');
  const studentId = searchParams.get('studentId');
  const classId = searchParams.get('classId');

  try {
    if (type === 'class' && id) {
      const { error } = await supabaseAdmin.from('classes').delete().eq('id', id);
      if (error) throw error;
    } else if (type === 'enrollment' && studentId && classId) {
      const { error } = await supabaseAdmin.from('class_enrollments').delete().match({ student_id: studentId, class_id: classId });
      if (error) throw error;
    } else if (type === 'student_permanent' && id) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
