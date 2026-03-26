"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BrainCircuit, Loader2 } from 'lucide-react';
import type { UserRole } from '@/types';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('aluno');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: role,
        }
      }
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Supabase Edge Functions or Triggers usually handle inserting into public.profiles
      // But if we do it here:
      const { error: profileError } = await supabase.from('profiles').insert([
        { id: data.user.id, full_name: name, role: role }
      ]);
      
      if (profileError) {
        console.error("Profile creation error:", profileError);
        // Não quebramos o fluxo aqui, mas é bom registrar
      }
      
      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 2000);
    } else {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-xl dark:bg-zinc-950/80 text-center py-10">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Cadastro Realizado!</CardTitle>
          <CardDescription className="text-base mt-2">
            Sua conta foi criada com sucesso. Redirecionando para a plataforma...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-xl dark:bg-zinc-950/80 my-8">
      <CardHeader className="space-y-3 pb-6 text-center">
        <div className="flex justify-center mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#C0392B] to-[#6C3483] flex items-center justify-center shadow-md">
            <BrainCircuit className="text-white" size={24} />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">Criar nova conta</CardTitle>
        <CardDescription className="text-base">
          Junte-se à revolução do aprendizado tech
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome Completo</Label>
            <Input 
              id="name" 
              placeholder="Seu nome" 
              required 
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="seu@email.com" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Perfil de Acesso</Label>
            <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um perfil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aluno">Aluno</SelectItem>
                <SelectItem value="professor">Professor</SelectItem>
                <SelectItem value="monitor">Monitor Educacional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                required 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-100 rounded-md dark:bg-red-900/30">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full h-11 text-base font-medium shadow-md transition-transform hover:scale-[1.02] bg-[var(--accent)] text-white hover:bg-[#D35400]"
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Criar Conta'}
          </Button>
        </form>
      </CardContent>
      
      <CardFooter className="flex flex-col space-y-4 pt-4 border-t border-border/40">
        <div className="text-sm text-center text-muted-foreground">
          Já possui conta?{' '}
          <Link href="/login" className="font-semibold text-foreground hover:underline">
            Faça login aqui
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
