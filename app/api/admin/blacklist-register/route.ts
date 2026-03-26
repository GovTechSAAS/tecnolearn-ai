import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { name, reason, descriptor } = await req.json();

    if (!name || !descriptor || !Array.isArray(descriptor)) {
      return NextResponse.json({ error: 'Dados inválidos. name e descriptor são obrigatórios.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('security_blacklist')
      .insert({ 
        name,
        reason: reason || 'Não informado',
        face_descriptor: descriptor
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
