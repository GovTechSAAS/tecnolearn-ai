"use client";

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainCircuit, Loader2, MailCheck, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-xl dark:bg-zinc-950/80 text-center py-10">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <MailCheck className="text-blue-600 w-8 h-8" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Verifique seu e-mail</CardTitle>
          <CardDescription className="text-base mt-2">
            Enviamos um link de recuperação de senha para <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/login">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Login
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-xl dark:bg-zinc-950/80">
      <CardHeader className="space-y-3 pb-6 text-center">
        <div className="flex justify-center mb-2">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center shadow-sm">
            <BrainCircuit className="text-[var(--accent)]" size={24} />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">Recuperar Senha</CardTitle>
        <CardDescription className="text-base">
          Informe seu e-mail para receber um link de redefinição
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="seu@email.com" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
          </div>

          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-100 rounded-md dark:bg-red-900/30">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full h-11 text-base font-medium transition-transform hover:scale-[1.02] bg-[var(--accent)] text-white hover:bg-[#D35400]"
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Enviar e-mail de recuperação'}
          </Button>
        </form>
      </CardContent>
      
      <CardFooter className="flex flex-col space-y-4 pt-4 border-t border-border/40">
        <div className="text-sm text-center">
          <Link href="/login" className="font-semibold text-muted-foreground hover:text-foreground inline-flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o Login
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
