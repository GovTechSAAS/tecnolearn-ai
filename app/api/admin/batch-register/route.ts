import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { className, students } = await req.json();

    if (!className || !students || !Array.isArray(students)) {
      return NextResponse.json({ error: 'Dados inválidos. Envie className e uma lista de students.' }, { status: 400 });
    }

    // Admin Client (Service Role)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 1. Criar ou Obter Turma
    let classId;
    const { data: existingClass, error: classFetchError } = await supabaseAdmin
      .from('classes')
      .select('id')
      .eq('name', className)
      .maybeSingle();

    if (classFetchError) throw classFetchError;

    if (existingClass) {
      classId = existingClass.id;
    } else {
      const { data: newClass, error: classCreateError } = await supabaseAdmin
        .from('classes')
        .insert({ name: className })
        .select()
        .single();
      
      if (classCreateError) throw classCreateError;
      classId = newClass.id;
    }

    const results = [];

    // 2. Criar Usuários e Matricular
    for (const student of students) {
      const { name, email, password } = student;
      
      if (!email || !name) continue;

      // Usar a API de Admin para criar o usuário sem confirmação de e-mail
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: password || '123456', // Senha padrão se não fornecida
        email_confirm: true,
        user_metadata: { full_name: name, role: 'aluno' }
      });

      if (authError) {
        results.push({ email, status: 'error', message: authError.message });
        continue;
      }

      const studentId = authUser.user.id;

      // O trigger on_auth_user_created deve criar o perfil automaticamente.
      // Mas podemos forçar uma atualização aqui se necessário ou apenas matricular.

      const { error: enrollError } = await supabaseAdmin
        .from('class_enrollments')
        .insert({ class_id: classId, student_id: studentId });

      if (enrollError) {
        results.push({ email, status: 'partial_success', message: 'Usuário criado, mas erro na matrícula: ' + enrollError.message });
      } else {
        results.push({ email, status: 'success' });
      }
    }

    return NextResponse.json({ 
      message: 'Processamento concluído', 
      classId, 
      results 
    });

  } catch (error: unknown) {
    console.error('Batch registration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno no servidor';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
