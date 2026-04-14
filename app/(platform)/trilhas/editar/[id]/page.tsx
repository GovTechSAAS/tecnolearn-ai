"use client";

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Plus, MoveUp, MoveDown, Trash2, Save, Loader2, Monitor, Video, Camera, Pause, Play, Square, Download, Image as ImageIcon, FileText } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ScreenRecorder } from '@/components/shared/ScreenRecorder';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import { RichTextEditor } from '@/components/shared/RichTextEditor';

type Node = {
  id: string;
  title: string;
  type: string;
  description?: string;
  content_url?: string;
  file?: File | null;
  thumbnailFile?: File | null;
  pdfFile?: File | null;
};

export default function EditarTrilhaPage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const searchParams = useSearchParams();
  const routeId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const id = routeId ?? searchParams.get('id');
  const { profile } = useAuth();
  
  // Trail state
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [bimestre, setBimestre] = useState('1');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  
  // Nodes state
  const [nodes, setNodes] = useState<Node[]>([]);
  const [contentModalNodeId, setContentModalNodeId] = useState<string | null>(null);
  const [studioMode, setStudioMode] = useState<'camera' | 'screen'>('camera');
  const lastActiveNodeIdRef = useRef<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const {
    state,
    duration,
    videoBlob,
    previewUrl,
    stream,
    requestCamera,
    releaseCamera,
    start,
    pause,
    resume,
    stop,
    reset,
    setExternalVideo,
    downloadVideo
  } = useMediaRecorder();
  const liveVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    async function fetchTrailData() {
      if (!id) {
        setError('ID da trilha inválido.');
        setLoading(false);
        return;
      }

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
          description: n.description || '',
          content_url: n.content_url
        })));

      } catch (err: any) {
        console.error(err);
        setError('Erro ao carregar dados da trilha.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchTrailData();
  }, [id]);

  const addNode = () => {
    setNodes([...nodes, { id: Date.now().toString(), title: '', type: 'video', description: '' }]);
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

  const uploadToCourseContents = async (
    supabase: ReturnType<typeof createClient>,
    folder: 'thumbnails' | 'nodes',
    file: File
  ) => {
    const ext = file.name.split('.').pop() || (file.type.includes('video') ? 'webm' : 'bin');
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `${folder}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('course-contents')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        throw new Error(uploadError.message || 'Falha no upload para o Storage.');
      }

      const { data } = supabase.storage.from('course-contents').getPublicUrl(filePath);
      if (!data?.publicUrl) {
        throw new Error('Nao foi possivel gerar URL publica do arquivo.');
      }

      return data.publicUrl;
    } catch (uploadErr: any) {
      if (uploadErr?.message?.toLowerCase?.().includes('failed to fetch')) {
        throw new Error('Falha de rede durante o upload. Verifique conexao e tente novamente.');
      }
      throw uploadErr;
    }
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
         currentThumbnailUrl = await uploadToCourseContents(supabase, 'thumbnails', thumbnail);
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
           contentUrl = await uploadToCourseContents(supabase, 'nodes', node.file);
        } else if (node.pdfFile) {
           contentUrl = await uploadToCourseContents(supabase, 'nodes', node.pdfFile);
        } else if (node.thumbnailFile) {
           contentUrl = await uploadToCourseContents(supabase, 'nodes', node.thumbnailFile);
        }

        return {
          trail_id: id,
          title: node.title,
          type: node.type,
          description: node.description || '',
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

  const selectedNode = nodes.find((node) => node.id === contentModalNodeId) || null;

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  useEffect(() => {
    if (contentModalNodeId) {
      lastActiveNodeIdRef.current = contentModalNodeId;
    }
  }, [contentModalNodeId]);

  useEffect(() => {
    if (liveVideoRef.current && stream) {
      liveVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (!videoBlob) return;
    const targetNodeId = contentModalNodeId ?? lastActiveNodeIdRef.current;
    if (!targetNodeId) return;
    const file = new File([videoBlob], `video-${Date.now()}.webm`, { type: videoBlob.type || 'video/webm' });
    updateNode(targetNodeId, 'file', file);
  }, [videoBlob, contentModalNodeId]);

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
                
                <div className="space-y-3 bg-zinc-100 dark:bg-zinc-800/50 p-3 rounded-lg border border-border/50">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      O conteudo deste topico deve ser configurado no studio.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[var(--accent)] text-white hover:bg-[#D35400]"
                      onClick={() => setContentModalNodeId(node.id)}
                    >
                      Inserir conteudo do topico
                    </Button>
                  </div>
                  {(node.file || node.content_url || node.pdfFile || node.thumbnailFile) && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Conteudo configurado para este topico.
                    </p>
                  )}
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
      <Dialog open={!!contentModalNodeId} onOpenChange={(open) => !open && setContentModalNodeId(null)}>
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Inserir conteudo do topico</DialogTitle>
            <DialogDescription>Use o studio de criacao para anexar ou gravar o conteudo deste topico.</DialogDescription>
          </DialogHeader>

          {selectedNode && (
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-xl bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md overflow-hidden">
                <CardHeader className="bg-[var(--primary)] text-white px-6 py-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Video className="w-5 h-5" /> Estudio de Gravacao
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <div className="flex bg-white/20 rounded-lg p-0.5 gap-0.5">
                        <button
                          type="button"
                          onClick={() => setStudioMode('camera')}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                            studioMode === 'camera' ? 'bg-white text-[var(--primary)]' : 'text-white/80 hover:text-white'
                          }`}
                        >
                          <Camera className="w-3 h-3" /> Camera
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudioMode('screen')}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                            studioMode === 'screen' ? 'bg-white text-[var(--primary)]' : 'text-white/80 hover:text-white'
                          }`}
                        >
                          <Monitor className="w-3 h-3" /> Tela
                        </button>
                      </div>
                      {(state === 'recording' || state === 'paused') && studioMode === 'camera' && (
                        <span className="text-sm font-bold tracking-wider">{formatDuration(duration)}</span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {studioMode === 'screen' ? (
                    <div className="p-4">
                      <ScreenRecorder
                        onVideoReady={(blob) => {
                          const file = new File([blob], `tela-${Date.now()}.webm`, { type: blob.type });
                          updateNode(selectedNode.id, 'file', file);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="relative aspect-video bg-zinc-900 flex items-center justify-center overflow-hidden">
                      {(state === 'ready' || state === 'recording' || state === 'paused' || (state === 'stopped' && !previewUrl)) && (
                        <video ref={liveVideoRef} autoPlay muted playsInline className="w-full h-full object-cover transform -scale-x-100" />
                      )}
                      {state === 'stopped' && previewUrl && (
                        <video src={previewUrl} controls className="w-full h-full object-contain bg-black" />
                      )}
                      {state === 'idle' && (
                        <div className="text-center p-6 text-zinc-400">
                          <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p className="mb-4">Sua camera esta desativada</p>
                          <Button onClick={requestCamera} className="bg-[var(--accent)] hover:bg-[#D35400] text-white">
                            Permitir acesso a camera
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
                {studioMode === 'camera' && (
                  <CardFooter className="p-4 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center gap-4">
                    {state === 'ready' && (
                      <>
                        <Button onClick={start} className="bg-red-600 hover:bg-red-700 text-white rounded-full px-6">Iniciar gravacao</Button>
                        <label className="flex items-center justify-center px-6 py-2 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-full cursor-pointer hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all text-sm font-medium">
                          <Download className="w-4 h-4 mr-2" /> Upload de video
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setExternalVideo(file);
                                updateNode(selectedNode.id, 'file', file);
                              }
                            }}
                          />
                        </label>
                      </>
                    )}
                    {state === 'recording' && (
                      <>
                        <Button onClick={pause} variant="outline"><Pause className="w-4 h-4 mr-2" /> Pausar</Button>
                        <Button onClick={stop} className="bg-zinc-900 hover:bg-zinc-800 text-white"><Square className="w-4 h-4 mr-2 fill-current" /> Parar</Button>
                      </>
                    )}
                    {state === 'paused' && (
                      <>
                        <Button onClick={resume} className="bg-[var(--primary)] hover:bg-[#A93226] text-white"><Play className="w-4 h-4 mr-2" /> Retomar</Button>
                        <Button onClick={stop} className="bg-zinc-900 text-white"><Square className="w-4 h-4 mr-2 fill-current" /> Parar</Button>
                      </>
                    )}
                    {state === 'stopped' && (
                      <>
                        <Button onClick={downloadVideo} className="bg-[var(--accent)] hover:bg-[#D35400] text-white"><Download className="w-4 h-4 mr-2" /> Baixar</Button>
                        <Button onClick={reset} variant="outline">Nova gravacao</Button>
                      </>
                    )}
                  </CardFooter>
                )}
              </Card>

              <Card className="border-0 shadow-xl bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
                <CardHeader>
                  <CardTitle>Detalhes do Conteudo</CardTitle>
                  <CardDescription>Mesmo formulario da pagina de criacao de conteudo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`content-title-${selectedNode.id}`}>Titulo da Aula / Material</Label>
                    <Input
                      id={`content-title-${selectedNode.id}`}
                      value={selectedNode.title}
                      onChange={(e) => updateNode(selectedNode.id, 'title', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`content-desc-${selectedNode.id}`}>Descricao / Ementa</Label>
                    <RichTextEditor
                      value={selectedNode.description || ''}
                      placeholder="Descreva brevemente o conteudo desta aula..."
                      onChange={(html) => updateNode(selectedNode.id, 'description', html)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Upload Auxiliar</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="border border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group relative">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => updateNode(selectedNode.id, 'thumbnailFile', e.target.files?.[0] || null)} />
                        <ImageIcon className={`w-8 h-8 mb-2 ${selectedNode.thumbnailFile ? 'text-[var(--primary)]' : 'text-muted-foreground group-hover:text-[var(--primary)]'}`} />
                        <span className="text-sm font-medium line-clamp-1">{selectedNode.thumbnailFile ? selectedNode.thumbnailFile.name : 'Thumbnail da Aula'}</span>
                      </label>
                      <label className="border border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group relative">
                        <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" className="hidden" onChange={(e) => updateNode(selectedNode.id, 'pdfFile', e.target.files?.[0] || null)} />
                        <FileText className={`w-8 h-8 mb-2 ${selectedNode.pdfFile ? 'text-[var(--accent)]' : 'text-muted-foreground group-hover:text-[var(--accent)]'}`} />
                        <span className="text-sm font-medium line-clamp-1">{selectedNode.pdfFile ? selectedNode.pdfFile.name : 'PDF e E-books'}</span>
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { releaseCamera(); setContentModalNodeId(null); }}>
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
