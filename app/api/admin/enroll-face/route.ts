import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usar Service Role para bypass de RLS e atualizar biometria
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId, descriptor } = await req.json();

    if (!userId || !descriptor || !Array.isArray(descriptor)) {
      return NextResponse.json({ error: 'Dados inválidos. userId e descriptor são obrigatórios.' }, { status: 400 });
    }

    // Atualiza o perfil com o novo descritor facial
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ 
        face_descriptor: descriptor,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Erro ao salvar biometria:', error);
      throw error;
    }

    return NextResponse.json({ success: true, message: 'Biometria registrada com sucesso.' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro interno no servidor.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
