"use client";

import { useEffect, useState, use, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, Lock, PlayCircle, FileText, ArrowLeft, Trophy, Star, Clock, Loader2, AlertCircle, MessageSquareText, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type TrailNode = {
  id: string;
  title: string;
  type: string;
  duration?: string;
  status?: string;
  content_url?: string;
};

type Trail = {
  id: string;
  title: string;
};

export default function TrilhaMapPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;

  const [selectedNode, setSelectedNode] = useState<TrailNode | null>(null);
  const [trail, setTrail] = useState<Trail | null>(null);
  const [nodes, setNodes] = useState<TrailNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);
  const { profile, loading: authLoading } = useAuth();

  const fetchData = useCallback(async () => {
    if (authLoading || !profile) return;
    
    try {
      const supabase = createClient();
      
      // 1. Get Trail Details
      const { data: trailData, error: trailError } = await supabase
        .from('learning_trails')
        .select('id, title')
        .eq('id', id)
        .single();
        
      if (trailError) throw trailError;
      setTrail(trailData);

      // 2. Get Nodes
      const { data: nodesData, error: nodesError } = await supabase
        .from('trail_nodes')
        .select('*')
        .eq('trail_id', id)
        .order('order_index', { ascending: true });
        
      if (nodesError) throw nodesError;

      // 3. Get Student Progress
      const nodeIds = (nodesData || []).map(n => n.id);
      const { data: progressData } = await supabase
        .from('student_progress')
        .select('*')
        .eq('student_id', profile.id)
        .in('node_id', nodeIds);

      const progressMap = new Map((progressData || []).map(p => [p.node_id, p.status]));

      // 4. Map statuses
      let lastCompleted = true; // First node is always unlocked if previous (none) is "completed"
      const mappedNodes = (nodesData || []).map((n, i) => {
        const dbStatus = progressMap.get(n.id);
        let status = 'locked';

        if (dbStatus === 'completed') {
          status = 'completed';
          lastCompleted = true;
        } else if (lastCompleted) {
          status = 'in-progress';
          lastCompleted = false; // Next one will be locked
        } else {
          status = 'locked';
        }
        
        return { ...n, status };
      });
      
      setNodes(mappedNodes);
    } catch (err: any) {
       console.error(err);
       setError('Erro ao carregar os dados da trilha.');
    } finally {
       setLoading(false);
    }
  }, [id, authLoading, profile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleCompletion = async (nodeId: string) => {
    if (isFinishing || !profile) return;
    setIsFinishing(true);

    try {
      console.log('Iniciando upsert de progresso:', { student_id: profile.id, node_id: nodeId });
      const supabase = createClient();
      const { error } = await supabase
        .from('student_progress')
        .upsert({
          student_id: profile.id,
          node_id: nodeId,
          status: 'completed',
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Erro retornado pelo Supabase:', error);
        throw error;
      }

      toast.success('Módulo concluído!');
      setSelectedNode(null);
      fetchData(); // Refresh UI
    } catch (err: any) {
      const errorMsg = err.message || JSON.stringify(err);
      console.error('Erro detalhado capturado:', {
        fullError: err,
        message: err.message,
        code: err.code,
        status: err.status
      });
      toast.error('Erro ao salvar progresso: ' + errorMsg);
    } finally {
      setIsFinishing(false);
    }
  };

  const renderIcon = (type: string, status: string) => {
    if (status === 'locked') return <Lock className="w-6 h-6 text-zinc-400" />;
    if (status === 'completed') return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;

    switch (type) {
      case 'video': return <PlayCircle className="w-6 h-6 text-white" />;
      case 'texto': return <FileText className="w-6 h-6 text-white" />;
      case 'atividade': return <Star className="w-6 h-6 text-white" />;
      default: return <PlayCircle className="w-6 h-6 text-white" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 border-emerald-500 text-emerald-800 dark:bg-emerald-950/30';
      case 'in-progress': return 'bg-[var(--accent)] border-[var(--primary)] text-white shadow-lg shadow-[var(--accent)]/30 scale-110';
      case 'locked': return 'bg-zinc-100 border-zinc-300 text-zinc-500 dark:bg-zinc-900 border-zinc-800';
      default: return 'bg-zinc-100 border-zinc-300';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-[var(--primary)]" />
        <p>Construindo mapa da trilha...</p>
      </div>
    );
  }

  if (error || !trail) {
     return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-red-500">
           <AlertCircle className="w-10 h-10 mb-2" />
           <p className="font-semibold">{error || 'Trilha não encontrada'}</p>
           <Link href="/trilhas">
              <Button variant="outline" className="mt-4">Voltar para Trilhas</Button>
           </Link>
        </div>
     );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex items-center gap-4">
        <Link href="/trilhas">
          <Button variant="outline" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">{trail.title}</h1>
          <p className="text-[var(--accent)] font-medium mt-1">
            Mapeamento Interativo
          </p>
        </div>
      </div>

      <div className="relative max-w-3xl mx-auto py-12 mt-10">
        {/* SVG Path line bridging nodes */}
        <div className="absolute left-1/2 top-4 bottom-4 w-1 -translate-x-1/2 bg-zinc-200 dark:bg-zinc-800 rounded-full z-0" />
        <div
          className="absolute left-1/2 top-4 w-1 -translate-x-1/2 bg-gradient-to-b from-[var(--primary)] to-[var(--accent)] rounded-full z-0 transition-all duration-1000"
          style={{ height: '40%' }} // Mock progress line
        />

        <div className="space-y-16 relative z-10">
          {nodes.map((node, index) => {
            const isLeft = index % 2 === 0;
            const isLocked = node.status === 'locked';

            return (
              <div key={node.id} className={`flex items-center justify-between gap-8 ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>

                {/* Visual Card (Left or Right) */}
                <div className={`w-1/2 ${isLeft ? 'text-right pr-8' : 'text-left pl-8'}`}>
                  <div
                    onClick={() => !isLocked && setSelectedNode(node)}
                    className={`inline-block p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer ${isLocked ? 'opacity-70 cursor-not-allowed bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800'
                        : 'bg-white dark:bg-zinc-950 border-transparent hover:border-[var(--accent)] shadow-xl hover:shadow-[var(--accent)]/20 hover:-translate-y-1'
                      }`}
                  >
                    <h3 className={`font-bold text-lg ${isLocked ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {node.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center justify-end gap-1" style={{ justifyContent: isLeft ? 'flex-end' : 'flex-start' }}>
                      <Clock className="w-3 h-3" /> {node.duration || '00 min'}
                    </p>
                  </div>
                </div>

                {/* Central Node Circle */}
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
                  <div className={`w-14 h-14 rounded-full border-4 flex items-center justify-center transition-all duration-500 z-10 ${getStatusColor(node.status || 'locked')}`}>
                    {renderIcon(node.type, node.status || 'locked')}
                  </div>
                </div>

                {/* Empty Space for layout balance */}
                <div className="w-1/2"></div>
              </div>
            );
          })}

          {/* Trophy End */}
          <div className="absolute bottom-[-60px] left-1/2 -translate-x-1/2 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-center shadow-lg">
              <Trophy className="w-8 h-8 text-zinc-400" />
            </div>
          </div>

        </div>
      </div>

      <Dialog open={!!selectedNode} onOpenChange={(open) => !open && setSelectedNode(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              {selectedNode?.type === 'video' ? <PlayCircle className="text-[var(--primary)]" /> : <FileText className="text-[var(--primary)]" />}
              {selectedNode?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedNode?.type === 'video' ? 'Vídeo Aula' : 'Material de Apoio'} • Duração: {selectedNode?.duration || '00 min'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-[1fr,300px] gap-6 mt-4">
            {/* Visualização de Conteúdo */}
            <div className="space-y-4">
               {selectedNode?.type === 'video' && selectedNode?.content_url ? (
                  <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-zinc-800">
                     <video 
                       src={selectedNode.content_url} 
                       controls 
                       className="w-full h-full"
                       autoPlay
                     />
                  </div>
               ) : (
                  <div className="aspect-video flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-800 p-8 text-center">
                    <div className="w-20 h-20 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center mb-4">
                      {selectedNode?.type === 'video' ? <PlayCircle size={40} /> : <FileText size={40} />}
                    </div>
                    <p className="text-muted-foreground font-medium">
                      Este módulo é um material de leitura ou atividade.
                    </p>
                    {selectedNode?.content_url && (
                       <Button 
                         onClick={() => window.open(selectedNode?.content_url, '_blank')}
                         className="mt-4 bg-[var(--accent)] hover:bg-[#D35400] text-white"
                       >
                         <ExternalLink className="w-4 h-4 mr-2" />
                         Abrir Material Original
                       </Button>
                    )}
                  </div>
               )}

               {/* Seção de Transcrição (Futura) */}
               {selectedNode?.type === 'video' && (
                 <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-border/60">
                    <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-[var(--primary)]">
                       <MessageSquareText size={18} />
                       Transcrição por IA (LUMI)
                    </div>
                    <div className="space-y-2">
                       <p className="text-sm text-muted-foreground italic">
                         "A transcrição automática para este vídeo está sendo gerada e estará disponível em breve. Você poderá pesquisar por termos específicos dentro do vídeo através do LUMI."
                       </p>
                    </div>
                 </div>
               )}
            </div>

            {/* Sidebar do Modal (Destaques/Info) */}
            <div className="space-y-4">
               <div className="p-4 bg-[var(--primary)]/5 rounded-xl border border-[var(--primary)]/10">
                  <h4 className="font-bold text-sm mb-2">Objetivos de Aprendizagem</h4>
                  <ul className="text-xs space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                       <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                       Compreender os conceitos base do módulo.
                    </li>
                    <li className="flex items-start gap-2">
                       <CheckCircle2 size={12} className="text-zinc-300 mt-0.5 shrink-0" />
                       Aplicar técnicas em exercícios práticos.
                    </li>
                  </ul>
               </div>

               <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-border">
                  <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                     <Star size={14} className="text-yellow-500" />
                     Dica do LUMI
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Assista ao vídeo e anote as dúvidas para perguntar ao chat LUMI após a aula!
                  </p>
               </div>
            </div>
          </div>

          <DialogFooter className="sm:justify-between items-center mt-6 pt-6 border-t border-border/40">
            <Button variant="outline" onClick={() => setSelectedNode(null)}>
              Fechar Módulo
            </Button>
            <Button 
              className="bg-[var(--primary)] text-white hover:bg-[#A93226]"
              onClick={() => selectedNode && handleToggleCompletion(selectedNode.id)}
              disabled={isFinishing || selectedNode?.status === 'completed'}
            >
              {isFinishing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {selectedNode?.status === 'completed' ? 'Já Concluído' : 'Marcar como Concluído'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
