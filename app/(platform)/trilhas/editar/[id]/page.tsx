"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, MoveUp, MoveDown, Trash2, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Node = {
  id: string;
  title: string;
  type: string;
  content_url?: string;
  file?: File | null;
};

export default function EditarTrilhaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { profile } = useAuth();
  
  // Trail state
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [bimestre, setBimestre] = useState('1');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  
  // Nodes state
  const [nodes, setNodes] = useState<Node[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchTrailData() {
      try {
        const supabase = createClient();
        
        // 1. Fetch Trail
        const { data: trail, error: trailError } = await supabase
          .from('learning_trails')
          .select('*')
          .eq('id', id)
          .single();
          
        if (trailError) throw trailError;
        
        setTitle(trail.title);
        setSubject(trail.subject);
        setBimestre(trail.bimestre.toString());
        setThumbnailUrl(trail.thumbnail_url || null);
        
        // 2. Fetch Nodes
        const { data: nodesData, error: nodesError } = await supabase
          .from('trail_nodes')
          .select('*')
          .eq('trail_id', id)
          .order('order_index', { ascending: true });
          
        if (nodesError) throw nodesError;
        
        setNodes(nodesData.map(n => ({
          id: n.id,
          title: n.title,
          type: n.type,
          content_url: n.content_url
        })));

      } catch (err: any) {
        console.error(err);
        setError('Erro ao carregar dados da trilha.');
      } finally {
        setLoading(false);
      }
    }
    
    if (id) fetchTrailData();
  }, [id]);

  const addNode = () => {
    setNodes([...nodes, { id: Date.now().toString(), title: '', type: 'video' }]);
  };

  const removeNode = (nodeId: string) => {
    setNodes(nodes.filter(n => n.id !== nodeId));
  };

  const updateNode = (nodeId: string, field: string, value: any) => {
    setNodes(nodes.map(n => n.id === nodeId ? { ...n, [field]: value } : n));
  };

  const moveNode = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === nodes.length - 1) return;
    
    const newNodes = [...nodes];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newNodes[index], newNodes[swapIndex]] = [newNodes[swapIndex], newNodes[index]];
    setNodes(newNodes);
  };

  const handleSave = async (published: boolean) => {
    if (!title || !subject) {
      setError('Preencha o título e a disciplina da trilha.');
      return;
    }
    
    if (nodes.some(n => !n.title)) {
      setError('Todos os tópicos da trilha devem ter um título.');
      return;
    }

    setSaving(true);
    setError('');
    
    try {
      const supabase = createClient();
      
      // Upload Thumbnail (Optional)
      let currentThumbnailUrl = thumbnailUrl;
      if (thumbnail) {
         const fileExt = thumbnail.name.split('.').pop();
         const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
         const { error: uploadError } = await supabase.storage.from('course-contents').upload(`thumbnails/${fileName}`, thumbnail);
         if (!uploadError) {
            const { data } = supabase.storage.from('course-contents').getPublicUrl(`thumbnails/${fileName}`);
            currentThumbnailUrl = data.publicUrl;
         }
      }
      
      // 1. Update Trail
      const trailPayload: any = {
          title,
          subject,
          bimestre: parseInt(bimestre),
          published,
      };
      
      if (currentThumbnailUrl) trailPayload.thumbnail_url = currentThumbnailUrl;

      const { error: trailError } = await supabase
        .from('learning_trails')
        .update(trailPayload)
        .eq('id', id);
        
      if (trailError) throw trailError;
      
      // 2. Sync Nodes (Delete all and Re-insert is the safest way to maintain order/integrity)
      console.log('Sincronizando nós para trilha:', id);
      const { error: deleteNodesError } = await supabase.from('trail_nodes').delete().eq('trail_id', id);
      
      if (deleteNodesError) {
        console.error('Erro ao limpar nós antigos:', deleteNodesError);
        throw new Error('Não foi possível limpar os tópicos antigos. Verifique as permissões de DELETE no Supabase.');
      }

      const nodesToInsert = await Promise.all(nodes.map(async (node, index) => {
        let contentUrl = node.content_url || null;
        
        if (node.file) {
           const fileExt = node.file.name.split('.').pop();
           const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
           const { error: uploadError } = await supabase.storage.from('course-contents').upload(`nodes/${fileName}`, node.file);
           if (!uploadError) {
              const { data } = supabase.storage.from('course-contents').getPublicUrl(`nodes/${fileName}`);
              contentUrl = data.publicUrl;
           }
        }

        return {
          trail_id: id,
          title: node.title,
          type: node.type,
          order_index: index,
          duration: '10 min',
          content_url: contentUrl
        };
      }));
      
      const { error: nodesError } = await supabase
        .from('trail_nodes')
        .insert(nodesToInsert);
        
      if (nodesError) throw nodesError;
      
      toast.success('Trilha atualizada com sucesso!');
      router.push('/trilhas');
      router.refresh();
      
    } catch (err: any) {
      console.error('Erro detalhado no salvamento:', err);
      setError('Ocorreu um erro ao salvar a trilha. Mensagem: ' + (err.message || 'Verifique o Console do Desenvolvedor'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--primary)]" />
        <p className="mt-4 text-muted-foreground">Carregando dados da trilha...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/trilhas">
            <Button variant="outline" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight">Editar Trilha</h1>
            <p className="text-muted-foreground mt-1">
              Modifique a estrutura ou os metadados desta trilha de aprendizagem.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
            Salvar Rascunho
          </Button>
          <Button 
            onClick={() => handleSave(true)} 
            disabled={saving}
            className="bg-[var(--primary)] text-white hover:bg-[#A93226]"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar e Publicar
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg">
          {error}
        </div>
      )}

      <Card className="border-0 shadow-xl bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Informações Gerais</CardTitle>
          <CardDescription>Defina os metadados principais da trilha de aprendizagem.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr,300px] gap-6">
            <div className="space-y-2">
              <Label htmlFor="title">Título da Trilha</Label>
              <Input 
                id="title" 
                placeholder="Ex: Fundamentos de React" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="thumbnail">Thumbnail (Capa da Trilha)</Label>
              <div className="flex items-center gap-2">
                {thumbnailUrl && !thumbnail && (
                  <div className="w-10 h-10 rounded bg-zinc-200 overflow-hidden border">
                    <img src={thumbnailUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <Input 
                  id="thumbnail" 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setThumbnail(e.target.files?.[0] || null)}
                  className="cursor-pointer flex-1"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Disciplina</Label>
              <Select value={subject} onValueChange={(val) => setSubject(val || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a disciplina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Desenvolvimento Frontend">Desenvolvimento Frontend</SelectItem>
                  <SelectItem value="Desenvolvimento Backend">Desenvolvimento Backend</SelectItem>
                  <SelectItem value="Design de Interfaces">Design de Interfaces</SelectItem>
                  <SelectItem value="Engenharia de Software">Engenharia de Software</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bimestre">Bimestre</Label>
              <Select value={bimestre} onValueChange={(val) => setBimestre(val || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o bimestre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1º Bimestre</SelectItem>
                  <SelectItem value="2">2º Bimestre</SelectItem>
                  <SelectItem value="3">3º Bimestre</SelectItem>
                  <SelectItem value="4">4º Bimestre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-xl bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle>Mapa de Tópicos (Nós)</CardTitle>
            <CardDescription className="mt-1.5">Adicione os conteúdos na ordem de aprendizado.</CardDescription>
          </div>
          <Button onClick={addNode} variant="outline" size="sm" className="bg-[var(--accent)] text-white border-transparent hover:bg-[#D35400] hover:text-white">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Tópico
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {nodes.map((node, index) => (
            <div key={node.id} className="flex items-start gap-4 p-4 border border-border/60 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 relative group transition-all hover:border-[var(--primary)]/50">
              <div className="flex flex-col gap-1 mt-1">
                <Button 
                  onClick={() => moveNode(index, 'up')}
                  disabled={index === 0}
                  variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                >
                  <MoveUp className="w-4 h-4" />
                </Button>
                <Button 
                  onClick={() => moveNode(index, 'down')}
                  disabled={index === nodes.length - 1}
                  variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                >
                  <MoveDown className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  <Label className="font-semibold text-base">Configuração do Tópico</Label>
                </div>
                
                <div className="grid md:grid-cols-[1fr,200px] gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`title-${node.id}`} className="text-xs">Título do Conteúdo</Label>
                    <Input 
                      id={`title-${node.id}`} 
                      placeholder="Nome deste passo na trilha" 
                      value={node.title} 
                      onChange={(e) => updateNode(node.id, 'title', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`type-${node.id}`} className="text-xs">Tipo de Conteúdo</Label>
                    <Select value={node.type} onValueChange={(val) => updateNode(node.id, 'type', val || '')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="video">Aulas em Vídeo</SelectItem>
                        <SelectItem value="texto">Material Escrito / PDF</SelectItem>
                        <SelectItem value="atividade">Atividade / Quiz</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2 bg-zinc-100 dark:bg-zinc-800/50 p-3 rounded-lg border border-border/50">
                   <Label htmlFor={`file-${node.id}`} className="text-xs font-semibold text-[var(--accent)]">
                     Anexo (PDF, Vídeo ou Imagem) {node.content_url && !node.file && <span className="text-zinc-500 font-normal ml-2">(Já possui arquivo)</span>}
                   </Label>
                   <Input 
                     id={`file-${node.id}`} 
                     type="file" 
                     className="bg-white dark:bg-zinc-950 cursor-pointer text-xs"
                     onChange={(e) => updateNode(node.id, 'file', e.target.files?.[0] || null)}
                   />
                </div>
              </div>

              <div className="ml-2">
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950" 
                   onClick={() => removeNode(node.id)}
                   disabled={nodes.length === 1}
                 >
                   <Trash2 className="w-4 h-4" />
                 </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
