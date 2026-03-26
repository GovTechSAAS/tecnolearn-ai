"use client";

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, UserX, AlertTriangle, List, Eye, Loader2, CheckCircle2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useFaceApi } from '@/hooks/useFaceApi';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// lazy load due to face-api.js browser deps
const FaceCamera = dynamic(() => import('@/components/shared/FaceCamera'), { ssr: false });

type BlacklistData = {
  id: string;
  name: string;
  reason: string;
  face_descriptor: number[] | null;
  created_at: string;
};

export default function SegurancaPage() {
  const [activeTab, setActiveTab] = useState<'monitoramento' | 'blacklist'>('monitoramento');
  const [blacklist, setBlacklist] = useState<BlacklistData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { compareFaces } = useFaceApi();
  const [lastDetectedId, setLastDetectedId] = useState<string | null>(null);

  // Estados Registro
  const [isRegistering, setIsRegistering] = useState(false);
  const [newName, setNewName] = useState('');
  const [newReason, setNewReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchBlacklist = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('security_blacklist').select('*').order('created_at', { ascending: false });
    setBlacklist(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBlacklist();
  }, [fetchBlacklist]);

  const handleDetect = useCallback((detectedDescriptor: Float32Array) => {
    if (!detectedDescriptor || blacklist.length === 0) return;

    // Scan the blacklist
    for (const bPerson of blacklist) {
      if (!bPerson.face_descriptor) continue;
      
      const bDescFloat = new Float32Array(bPerson.face_descriptor);
      const isMatch = compareFaces(bDescFloat, detectedDescriptor);
      
      if (isMatch) {
         if (lastDetectedId !== bPerson.id) {
            setLastDetectedId(bPerson.id);
            // Mostrar Toast Vermelho para o operador
            toast.error(`ALERTA: Indivíduo da Blacklist Detectado!`, {
               description: `Nome: ${bPerson.name}. Motivo: ${bPerson.reason}`,
               duration: 8000,
               icon: <AlertTriangle className="text-red-500" />
            });
         }
         return;
      }
    }
  }, [blacklist, compareFaces, lastDetectedId]);

  const handleRegisterFace = async (descriptor: Float32Array) => {
     if (!newName || isSaving) return;

     setIsSaving(true);
     const loadingToast = toast.loading('Registrando Biometria na Blacklist...');

     try {
        const response = await fetch('/api/admin/blacklist-register', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ 
              name: newName, 
              reason: newReason, 
              descriptor: Array.from(descriptor) 
           })
        });

        if (!response.ok) throw new Error('Erro ao salvar no banco');

        toast.success('Pessoa restrita cadastrada!', { id: loadingToast });
        setIsRegistering(false);
        setNewName('');
        setNewReason('');
        fetchBlacklist();
     } catch (err: unknown) {
        toast.error('Erro no registro: ' + (err instanceof Error ? err.message : 'Tente novamente.'), { id: loadingToast });
     } finally {
        setIsSaving(false);
     }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-red-600 dark:text-red-500">
            Segurança Central
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitoramento em tempo real com alertas visuais da Blacklist e Whitelist.
          </p>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg w-fit">
        <button 
          onClick={() => setActiveTab('monitoramento')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'monitoramento' ? 'bg-white dark:bg-zinc-800 shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800/50'
          }`}
        >
          <Eye size={16} /> Câmera ao Vivo
        </button>
        <button 
          onClick={() => setActiveTab('blacklist')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'blacklist' ? 'bg-white dark:bg-zinc-800 shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800/50'
          }`}
        >
          <List size={16} /> Registros e Blacklist
        </button>
      </div>

      {activeTab === 'monitoramento' && (
        <Card className="border-red-500/30 shadow-2xl shadow-red-500/5 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md overflow-hidden">
          <CardHeader className="bg-red-50 dark:bg-red-950/20 pb-4 border-b border-red-500/20">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5" /> 
                  Supervisão Biométrica Ativa
                </CardTitle>
                <CardDescription className="text-red-900/60 dark:text-red-200/50">
                  O sistema soará um alarme e enviará notificações caso um rosto da blacklist seja detectado na imagem.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                 <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800 animate-pulse">
                    Scanner IA Ligado
                 </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 bg-zinc-950">
            <FaceCamera overlayMode="security" onDetect={handleDetect} />
          </CardContent>
        </Card>
      )}

      {activeTab === 'blacklist' && (
        <Card className="border-0 shadow-xl bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Base de Dados Restrita (Blacklist)</CardTitle>
                <CardDescription>Pessoas não autorizadas a acessar as dependências.</CardDescription>
              </div>
              <Button variant="destructive" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setIsRegistering(true)}>
                <UserX className="w-4 h-4 mr-2" />
                Cadastrar Pessoa Restrita
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
               <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-border text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Nome / Identificação</th>
                        <th className="px-6 py-4 font-semibold">Motivo</th>
                        <th className="px-6 py-4 font-semibold">Data do Registro</th>
                        <th className="px-6 py-4 font-semibold text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {blacklist.map(item => (
                        <tr key={item.id} className="bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group">
                          <td className="px-6 py-4 font-medium flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 flex items-center justify-center">
                              <AlertTriangle className="w-4 h-4" />
                            </div>
                            {item.name}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {item.reason}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button variant="ghost" size="sm" className="text-[var(--primary)] font-medium">Editar</Button>
                          </td>
                        </tr>
                      ))}
                      {blacklist.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                            Nenhum registro encontrado na blacklist biométrica de segurança.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* MODAL DE REGISTRO NA BLACKLIST */}
      {isRegistering && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
           <Card className="w-full max-w-4xl bg-zinc-950 border-red-500/20 text-white shadow-2xl overflow-hidden grid lg:grid-cols-2">
              <div className="p-8 border-r border-zinc-900 flex flex-col justify-between">
                 <div className="space-y-6">
                    <div className="flex items-center justify-between">
                       <CardTitle className="text-2xl text-red-500 font-bold">Registro de Alerta</CardTitle>
                       <Button variant="ghost" size="icon" onClick={() => setIsRegistering(false)} className="text-zinc-500 hover:text-white">
                          <X size={20} />
                       </Button>
                    </div>
                    
                    <div className="space-y-4 pt-4">
                       <div className="space-y-2">
                          <Label className="text-zinc-400">Identificação (Nome ou codinome)</Label>
                          <Input 
                            placeholder="Ex: Suspeito A, Nome do Indivíduo..." 
                            className="bg-zinc-900 border-zinc-800 text-white" 
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                          />
                       </div>
                       <div className="space-y-2">
                          <Label className="text-zinc-400">Motivo da Restrição</Label>
                          <Input 
                            placeholder="Ex: Tentativa de invasão, Comportamento agressivo..." 
                            className="bg-zinc-900 border-zinc-800 text-white" 
                            value={newReason}
                            onChange={e => setNewReason(e.target.value)}
                          />
                       </div>
                    </div>

                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                       <p className="text-xs text-red-400 leading-relaxed">
                          Ao registrar uma pessoa na Blacklist, o sistema emitirá alertas visuais e sonoros sempre que o rosto for detectado nas câmeras de monitoramento.
                       </p>
                    </div>
                 </div>

                 <div className="space-y-3 pt-6">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Requisitos de Captura</h4>
                    <div className="grid grid-cols-1 gap-2">
                       <div className="flex items-center gap-2 text-xs text-zinc-400"><CheckCircle2 size={12} className="text-red-500" /> Iluminação suficiente no rosto</div>
                       <div className="flex items-center gap-2 text-xs text-zinc-400"><CheckCircle2 size={12} className="text-red-500" /> Ausência de óculos escuros ou gorros</div>
                    </div>
                 </div>
              </div>

              <div className="bg-zinc-900 relative">
                 <div className="absolute top-4 left-4 z-10">
                    <Badge className="bg-red-600 text-white border-0">ESCANEAMENTO AO VIVO</Badge>
                 </div>
                 
                 <div className="h-full flex flex-col items-center justify-center p-4">
                    <div className="w-full aspect-square max-w-[400px] border-2 border-dashed border-red-500/30 rounded-full overflow-hidden relative">
                       <FaceCamera 
                         overlayMode="enroll" 
                         onDetect={handleRegisterFace} 
                         isProcessing={isSaving}
                       />
                       {isSaving && (
                          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                             <Loader2 size={40} className="animate-spin text-red-500 mb-2" />
                             <span className="text-sm font-bold">Processando Biometria...</span>
                          </div>
                       )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-6 text-center italic">
                       Aguarde o sistema reconhecer o rosto automaticamente para capturar o descritor.
                    </p>
                 </div>
              </div>
           </Card>
        </div>
      )}
    </div>
  );
}
