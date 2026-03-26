"use client";

import { useEffect, useRef, useState } from 'react';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Video, Play, Square, Pause, Download, Camera, ArrowLeft, Image as ImageIcon, FileText, Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function CriarConteudoPage() {
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [trails, setTrails] = useState<{ id: string, title: string }[]>([]);
  const [selectedTrailId, setSelectedTrailId] = useState<string>('');
  const [loadingTrails, setLoadingTrails] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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
    if (liveVideoRef.current && stream) {
      liveVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Carregar trilhas ao montar
  useEffect(() => {
    async function fetchTrails() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('learning_trails')
          .select('id, title')
          .order('title');

        if (error) throw error;
        setTrails(data || []);
      } catch (err) {
        console.error('Erro ao buscar trilhas:', err);
      } finally {
        setLoadingTrails(false);
      }
    }
    fetchTrails();
  }, []);

  // Limpa a câmera ao sair da página
  useEffect(() => {
    return () => {
      releaseCamera();
    };
  }, [releaseCamera]);

  const handleSaveContent = async () => {
    if (!title) {
        toast.error("Por favor, insira um título para o conteúdo.");
        return;
    }

    if (!previewUrl && !thumbnailFile && !pdfFile) {
        toast.warning("Nenhum conteúdo (Vídeo, PNG ou PDF) foi anexado.");
        return;
    }
    
    setIsSaving(true);
    const id = toast.loading("Enviando conteúdo para o servidor...");

    try {
        const supabase = createClient();
        let videoUrl = null;
        let thumbnailUrl = null;
        let pdfUrl = null;

        // 1. Upload Video
        if (videoBlob) {
            const fileName = `video_${Date.now()}.${videoBlob.type.includes('mp4') ? 'mp4' : 'webm'}`;
            const { error: uploadError } = await supabase.storage
              .from('course-contents')
              .upload(`videos/${fileName}`, videoBlob, {
                cacheControl: '3600',
                upsert: false
              });
              
            if (uploadError) {
                console.error("Supabase Storage Error:", uploadError);
                throw new Error(`Erro no Storage: ${uploadError.message} (Verifique o limite de tamanho no Supabase)`);
            }
            
            const { data } = supabase.storage.from('course-contents').getPublicUrl(`videos/${fileName}`);
            videoUrl = data.publicUrl;
        } else if (previewUrl) {
            // Fallback para caso antigo ou URLs externas, mas videoBlob deve estar presente
            const response = await fetch(previewUrl);
            const blob = await response.blob();
            const fileName = `video_${Date.now()}.webm`;
            const { error: uploadError } = await supabase.storage.from('course-contents').upload(`videos/${fileName}`, blob);
            if (uploadError) throw new Error("Erro ao subir vídeo: " + uploadError.message);
            
            const { data } = supabase.storage.from('course-contents').getPublicUrl(`videos/${fileName}`);
            videoUrl = data.publicUrl;
        }

        // 2. Upload Thumbnail
        if (thumbnailFile) {
            const ext = thumbnailFile.name.split('.').pop();
            const fileName = `thumb_${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage.from('course-contents').upload(`thumbnails/${fileName}`, thumbnailFile);
            if (uploadError) throw new Error("Erro ao subir thumbnail: " + uploadError.message);

            const { data } = supabase.storage.from('course-contents').getPublicUrl(`thumbnails/${fileName}`);
            thumbnailUrl = data.publicUrl;
        }

        // 3. Upload PDF
        if (pdfFile) {
            const ext = pdfFile.name.split('.').pop();
            const fileName = `doc_${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage.from('course-contents').upload(`docs/${fileName}`, pdfFile);
            if (uploadError) throw new Error("Erro ao subir documento: " + uploadError.message);

            const { data } = supabase.storage.from('course-contents').getPublicUrl(`docs/${fileName}`);
            pdfUrl = data.publicUrl;
        }

        // 4. Se houver trilha selecionada, criar nó na trilha
        if (selectedTrailId && selectedTrailId !== 'none') {
            const { data: lastNode } = await supabase
                .from('trail_nodes')
                .select('order_index')
                .eq('trail_id', selectedTrailId)
                .order('order_index', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            const nextIndex = (lastNode?.order_index ?? -1) + 1;

            const { error: nodeError } = await supabase
                .from('trail_nodes')
                .insert({
                    trail_id: selectedTrailId,
                    title: title,
                    type: videoUrl ? 'video' : (pdfUrl ? 'texto' : 'atividade'),
                    content_url: videoUrl || pdfUrl || thumbnailUrl,
                    order_index: nextIndex,
                    duration: duration > 0 ? `${Math.ceil(duration / 60)} min` : '10 min'
                });

            if (nodeError) throw nodeError;
        }

        toast.success("Conteúdo salvo com sucesso!", { id });
        
        // Limpar formulário
        setTitle('');
        setDescription('');
        setThumbnailFile(null);
        setPdfFile(null);
        setSelectedTrailId('none');
        releaseCamera();
        
    } catch (err: any) {
        console.error(err);
        toast.error("Erro ao salvar: " + err.message, { id });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Criação de Conteúdo</h1>
          <p className="text-muted-foreground mt-1">
            Grave vídeo-aulas ou faça upload de materiais ricos para seus alunos.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        
        {/* Lado Esquerdo: Gravação */}
        <div className="space-y-6">
          <Card className="border-0 shadow-xl bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md overflow-hidden">
            <CardHeader className="bg-[var(--primary)] text-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-5 h-5" /> Estúdio de Gravação
                  </CardTitle>
                </div>
                {state === 'recording' && (
                  <div className="flex items-center gap-2 animate-pulse">
                    <span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
                    <span className="text-sm font-bold tracking-wider">{formatDuration(duration)}</span>
                  </div>
                )}
                {state === 'paused' && (
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                    <span className="text-sm font-bold tracking-wider">{formatDuration(duration)}</span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative aspect-video bg-zinc-900 flex items-center justify-center overflow-hidden">
                {state === 'idle' && (
                  <div className="text-center p-6 text-zinc-400">
                    <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="mb-4">Sua câmera está desativada</p>
                    <Button onClick={requestCamera} className="bg-[var(--accent)] hover:bg-[#D35400] text-white">
                      Permitir Acesso à Câmera
                    </Button>
                    <div className="mt-4">
                      <label className="text-sm text-zinc-500 cursor-pointer hover:text-[var(--primary)] transition-colors underline">
                        ou clique aqui para fazer upload de um vídeo
                        <input 
                          type="file" 
                          accept="video/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setExternalVideo(file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {state === 'requesting' && (
                  <div className="text-zinc-400 flex flex-col items-center">
                    <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
                    Aguardando permissão da câmera...
                  </div>
                )}

                {(state === 'ready' || state === 'recording' || state === 'paused' || (state === 'stopped' && !previewUrl)) && (
                  <video 
                    ref={liveVideoRef}
                    autoPlay 
                    muted 
                    playsInline
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                )}

                {state === 'stopped' && previewUrl && (
                   <video 
                     src={previewUrl}
                     controls
                     className="w-full h-full object-contain bg-black"
                   />
                )}
              </div>
            </CardContent>
            
            <CardFooter className="p-4 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center gap-4">
                {state === 'ready' && (
                  <div className="flex gap-4">
                    <Button onClick={start} className="bg-red-600 hover:bg-red-700 text-white rounded-full px-6">
                      <div className="w-3 h-3 rounded-full bg-white mr-2"></div>
                      Iniciar Gravação
                    </Button>
                    <label className="flex items-center justify-center px-6 py-2 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-full cursor-pointer hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all text-sm font-medium">
                        <Download className="w-4 h-4 mr-2" /> Fazer Upload de Vídeo
                        <input 
                          type="file" 
                          accept="video/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setExternalVideo(file);
                          }}
                        />
                    </label>
                  </div>
                )}
              
              {state === 'recording' && (
                <>
                  <Button onClick={pause} variant="outline" className="text-zinc-700 border-zinc-300">
                    <Pause className="w-4 h-4 mr-2" /> Pausar
                  </Button>
                  <Button onClick={stop} className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-200 dark:hover:bg-zinc-300 dark:text-black">
                    <Square className="w-4 h-4 mr-2 fill-current" /> Parar Gravação
                  </Button>
                </>
              )}

              {state === 'paused' && (
                <>
                  <Button onClick={resume} className="bg-[var(--primary)] hover:bg-[#A93226] text-white">
                    <Play className="w-4 h-4 mr-2" /> Retomar
                  </Button>
                  <Button onClick={stop} className="bg-zinc-900 text-white">
                    <Square className="w-4 h-4 mr-2 fill-current" /> Parar Gravação
                  </Button>
                </>
              )}

              {state === 'stopped' && (
                <>
                  <Button onClick={downloadVideo} className="bg-[var(--accent)] hover:bg-[#D35400] text-white flex-1">
                    <Download className="w-4 h-4 mr-2" /> Baixar Aula (.webm/.mp4)
                  </Button>
                  <Button onClick={reset} variant="outline">
                    Nova Gravação
                  </Button>
                </>
              )}
            </CardFooter>
          </Card>
        </div>

        {/* Lado Direito: Metadados e Upload Adicional */}
        <div className="space-y-6">
          <Card className="border-0 shadow-xl bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
            <CardHeader>
              <CardTitle>Detalhes do Conteúdo</CardTitle>
              <CardDescription>
                Forneça informações sobre o material que você está publicando.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="content-title">Título da Aula / Material</Label>
                <Input 
                  id="content-title" 
                  placeholder="Ex: Introdução a Hooks" 
                  className="bg-white dark:bg-zinc-900" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="desc">Descrição / Ementa</Label>
                <textarea 
                  id="desc"
                  rows={3} 
                  className="flex w-full rounded-md border border-input bg-white dark:bg-zinc-900 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Descreva brevemente o conteúdo desta aula..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                ></textarea>
              </div>

              <div className="space-y-2">
                <Label>Upload Auxiliar</Label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="border border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group relative">
                     <input 
                       type="file" 
                       accept="image/*" 
                       className="hidden" 
                       onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)} 
                     />
                     <ImageIcon className={`w-8 h-8 mb-2 ${thumbnailFile ? 'text-[var(--primary)]' : 'text-muted-foreground group-hover:text-[var(--primary)]'}`} />
                     <span className="text-sm font-medium line-clamp-1">{thumbnailFile ? thumbnailFile.name : 'Thumbnail da Aula'}</span>
                  </label>
                  <label className="border border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group relative">
                     <input 
                       type="file" 
                       accept=".pdf,.doc,.docx,.ppt,.pptx" 
                       className="hidden" 
                       onChange={(e) => setPdfFile(e.target.files?.[0] || null)} 
                     />
                     <FileText className={`w-8 h-8 mb-2 ${pdfFile ? 'text-[var(--accent)]' : 'text-muted-foreground group-hover:text-[var(--accent)]'}`} />
                     <span className="text-sm font-medium line-clamp-1">{pdfFile ? pdfFile.name : 'PDF e E-books'}</span>
                  </label>
                </div>
              </div>

            </CardContent>
            <CardFooter className="bg-zinc-50/50 dark:bg-zinc-900/20 pt-4 flex-col items-start gap-4 border-t border-border/40">
              <div className="w-full space-y-2">
                <Label>Associar à Trilha Existente (Opcional)</Label>
                <Select value={selectedTrailId} onValueChange={(val) => setSelectedTrailId(val || '')}>
                  <SelectTrigger className="bg-white dark:bg-zinc-900 w-full">
                    <SelectValue placeholder={loadingTrails ? "Carregando trilhas..." : "Selecione uma trilha para vincular"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma trilha (Apenas gravar)</SelectItem>
                    {trails.map(trail => (
                      <SelectItem key={trail.id} value={trail.id}>{trail.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleSaveContent}
                disabled={isSaving}
                className="w-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white shadow-lg shadow-[var(--primary)]/20 hover:shadow-xl transition-shadow text-lg h-12"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {isSaving ? "Salvando..." : "Salvar Conteúdo"}
              </Button>
            </CardFooter>
          </Card>
        </div>

      </div>
    </div>
  );
}
