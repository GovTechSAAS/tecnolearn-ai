"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, BookOpen, Clock, Loader2, AlertCircle, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Trail = {
  id: string;
  title: string;
  subject: string;
  bimestre: number;
  published: boolean;
  thumbnail_url?: string;
  progress?: number;
};

export default function TrilhasPage() {
  const permissions = usePermissions();
  const { profile, loading: authLoading } = useAuth();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrails() {
      if (authLoading) return;

      setLoading(true);
      try {
        const supabase = createClient();

        // Puxa as trilhas criadas
        const { data: trailsData, error: trailsError } = await supabase
          .from('learning_trails')
          .select('*')
          .order('bimestre', { ascending: true })
          .order('created_at', { ascending: false });

        if (trailsError) throw trailsError;

        // Se o usuário não for professor/admin, mostrar apenas as publicadas
        let filteredTrails = trailsData || [];
        if (!permissions.canCreateTrails) {
          filteredTrails = filteredTrails.filter(t => t.published);
        }

        // 2. Buscar todos os nós das trilhas (para contar o total)
        const { data: nodesData } = await supabase
          .from('trail_nodes')
          .select('id, trail_id');

        // 3. Buscar o progresso do aluno
        let completedNodeIds = new Set<string>();
        if (profile?.id) {
          const { data: progressData } = await supabase
            .from('student_progress')
            .select('node_id, status')
            .eq('student_id', profile.id)
            .eq('status', 'completed');

          completedNodeIds = new Set((progressData || []).map(p => p.node_id));
        }

        const mappedTrails = filteredTrails.map(t => {
          const trailNodes = (nodesData || []).filter(n => n.trail_id === t.id);
          const totalNodes = trailNodes.length;
          const completedNodes = trailNodes.filter(n => completedNodeIds.has(n.id)).length;

          const progress = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;

          return {
            ...t,
            progress
          };
        });

        setTrails(mappedTrails);
      } catch (err: any) {
        console.error('Erro ao buscar trilhas:', err);
        setError('Não foi possível carregar as trilhas no momento.');
      } finally {
        setLoading(false);
      }
    }

    fetchTrails();
  }, [authLoading, profile, permissions.canCreateTrails]);

  const handleDeleteTrail = async (id: string, title: string) => {
    if (!confirm(`Tem certeza que deseja excluir a trilha "${title}"? Todos os nós e progresso dos alunos serão removidos.`)) {
      return;
    }

    try {
      const supabase = createClient();
      console.log('Tentando excluir trilha:', id);
      const { error } = await supabase.from('learning_trails').delete().eq('id', id);

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      // No Supabase, se o delete não afetar nada (RLS), ele não retorna erro mas também não deleta.
      // Uma forma de validar é buscar se ainda existe ou assumir sucesso se não houver erro.
      toast.success('Comando enviado. Verifique se a trilha sumiu (pode exigir permissão de RLS no Banco).');
      setTrails(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      console.error(err);
      toast.error('Erro na exclusão: ' + (err.message || 'Verifique o Console'));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Trilhas de Aprendizagem</h1>
          <p className="text-muted-foreground mt-1">
            Explore os mapas de conteúdo e avance em sua jornada.
          </p>
        </div>
        {permissions.canCreateTrails && (
          <Link href="/trilhas/criar">
            <Button className="bg-[var(--accent)] text-white hover:bg-[#D35400] shadow-md">
              <Plus className="mr-2 h-4 w-4" />
              Nova Trilha
            </Button>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-[var(--primary)]" />
          <p>Carregando trilhas de aprendizagem...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-red-500 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900 border-dashed">
          <AlertCircle className="w-10 h-10 mb-2" />
          <p className="font-semibold">{error}</p>
        </div>
      ) : trails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-border text-center px-4">
          <BookOpen className="w-12 h-12 mb-4 opacity-20" />
          <h3 className="text-xl font-bold text-foreground">Nenhuma Trilha Encontrada</h3>
          <p className="mt-2 max-w-sm">
            Ainda não há trilhas de aprendizado cadastradas para o seu perfil.
            {permissions.canCreateTrails && ' Crie a primeira trilha para seus alunos explorarem.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {trails.map((trail) => (
            <Card key={trail.id} className="group hover:shadow-xl transition-all duration-300 border-border/50 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md overflow-hidden flex flex-col">
              {trail.thumbnail_url ? (
                <div className="relative h-36 w-full overflow-hidden border-b border-border/50">
                  <img
                    src={trail.thumbnail_url}
                    alt={`Capa da trilha ${trail.title}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                </div>
              ) : (
                <div className="h-2 w-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] opacity-80 group-hover:opacity-100 transition-opacity" />
              )}

              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${trail.published ? 'bg-[var(--primary)] text-white border-transparent' : 'bg-secondary text-secondary-foreground border-transparent'}`}>
                    {trail.published ? 'Publicada' : 'Rascunho'}
                  </span>
                  <div className="flex items-center text-xs text-muted-foreground font-medium bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                    <Clock className="w-3 h-3 mr-1" />
                    Bimestre {trail.bimestre}
                  </div>
                </div>
                <CardTitle className="text-xl group-hover:text-[var(--primary)] transition-colors">{trail.title}</CardTitle>
                <CardDescription className="flex items-center mt-2">
                  <BookOpen className="w-4 h-4 mr-1.5" />
                  {trail.subject}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-medium">Seu progresso</span>
                    <span className="font-bold text-[var(--accent)]">{trail.progress}%</span>
                  </div>
                  <div className="relative w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-[var(--accent)] rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${trail.progress}%` }}
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-4 border-t border-border/40 gap-2">
                <div className="flex-1">
                  <Link href={`/trilhas/${trail.id}`} className="w-full block">
                    <Button variant="outline" className="w-full group-hover:bg-[var(--primary)] group-hover:text-white group-hover:border-[var(--primary)] transition-colors">
                      Acessar Mapa
                    </Button>
                  </Link>
                </div>
                {permissions.canCreateTrails && (
                  <div className="flex gap-2">
                    <Link href={`/trilhas/editar/${trail.id}`}>
                      <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteTrail(trail.id, trail.title)}
                      className="text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
