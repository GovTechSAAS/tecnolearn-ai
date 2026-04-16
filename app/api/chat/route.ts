import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // In a real app, you would fetch this from Supabase (config table)
    // For demo/prototype purposes, we use ENV var or a mock string if missing
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API Key não configurada no servidor.' },
        { status: 500 }
      );
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'learnapp Platform',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-3-super-120b-a12b:free', // Fallback fast model
        messages: [
          { role: 'system', content: 'Você é o LUMI, o assistente educacional com Inteligência Artificial da plataforma Tecnolearn. Responda alunos de forma educada, em português brasileiro de forma clara e objetiva.' },
          ...messages
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Erro na API do OpenRouter');
    }

    return NextResponse.json({ reply: data.choices[0].message.content });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
