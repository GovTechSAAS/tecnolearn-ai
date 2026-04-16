"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Save, BrainCircuit, ShieldAlert, KeyRound, Building2 } from 'lucide-react';

export default function ConfigsPage() {
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">Configurações da Plataforma</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie chaves de API, regras da instituição e limites de plataforma.
        </p>
      </div>

      <div className="grid gap-6">

        {/* IA / OpenRouter */}
        <Card className="border-border/50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="text-[var(--accent)]" />
              Inteligência Artificial (LUMI)
            </CardTitle>
            <CardDescription>Configure os modelos e os provedores de IA (OpenRouter)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openrouter-key">OpenRouter API Key</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <KeyRound size={16} />
                </div>
                <Input id="openrouter-key" type="password" placeholder="sk-or-v1-xxxxxxxxxx" defaultValue="sk-or-v1-abcdef123" className="pl-10 font-mono" />
              </div>
              <p className="text-xs text-muted-foreground">Obtenha sua chave em openrouter.ai/keys</p>
            </div>

            <div className="flex items-center justify-between border border-border p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
              <div>
                <h4 className="font-semibold text-sm">IA Generativa Ativa</h4>
                <p className="text-xs text-muted-foreground">O chat LUMI ficará visível para os alunos</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Instituição */}
        <Card className="border-border/50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="text-[var(--primary)]" />
              Dados da Instituição
            </CardTitle>
            <CardDescription>Personalização Whitelabel da Tecnolearn</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inst-name">Nome da Instituição</Label>
                <Input id="inst-name" defaultValue="Escola Tecnolearn" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inst-domain">Domínio</Label>
                <Input id="inst-domain" defaultValue="learnapp.edu.br" disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Segurança */}
        <Card className="border-border/50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <ShieldAlert />
              Políticas de Segurança
            </CardTitle>
            <CardDescription>Parâmetros biométricos do Face API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border border-border p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
              <div>
                <h4 className="font-semibold text-sm">Bloqueio Automático ao Detectar Blacklist</h4>
                <p className="text-xs text-muted-foreground">Suspende o sistema e notifica supervisores via email</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between border border-border p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
              <div>
                <h4 className="font-semibold text-sm">Chamada Simplificada (Menor Threshold)</h4>
                <p className="text-xs text-muted-foreground">Aumenta a tolerância do reconhecimento (Euclidean Distance &lt; 0.65)</p>
              </div>
              <Switch />
            </div>
          </CardContent>
          <CardFooter className="bg-zinc-50 dark:bg-zinc-900/50 pt-4 border-t border-border mt-4">
            <Button
              onClick={handleSave}
              className="ml-auto bg-[var(--primary)] text-white hover:bg-[#A93226]"
              disabled={saving}
            >
              {saving ? 'Salvando...' : <><Save className="w-4 h-4 mr-2" /> Salvar Configurações</>}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
