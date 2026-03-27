"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, UserCheck, XCircle, AlertCircle, Save, Loader2, Users, Calendar, History, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useFaceApi } from '@/hooks/useFaceApi';
import { createClient } from '@/lib/supabase';
import { toast } from 'sonner';

// lazy load due to face-api.js browser deps
const FaceCamera = dynamic(() => import('@/components/shared/FaceCamera'), { ssr: false });

type ClassRoom = { id: string; name: string };
type StudentProfile = { id: string; full_name: string; face_descriptor: number[] | null; role: string };

type StudentState = {
  profile: StudentProfile;
  status: 'presente' | 'ausente' | 'pendente';
  descriptorFloat32: Float32Array | null;
};

export default function ChamadaPage() {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');

  const [students, setStudents] = useState<StudentState[]>([]);
  const [isCalling, setIsCalling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados do Histórico
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [viewingRecord, setViewingRecord] = useState<any | null>(null);

  const { compareFaces } = useFaceApi();
  const { profile, loading: authLoading } = useAuth();

  // 1. Fetch Classes when Auth is ready
  useEffect(() => {
    async function fetchClasses() {
      if (authLoading) return;

      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('classes')
          .select('id, name')
          .order('created_at', { ascending: false });

        if (error) {
          console.error("Classes load error:", error);
          // No Toast aqui para evitar spam no loading inicial se for apenas falta de auth
        }
        setClasses(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchClasses();
  }, [authLoading, profile]);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    const supabase = createClient();
    try {
      const year = parseInt(selectedMonth.split('-')[0]);
      const month = parseInt(selectedMonth.split('-')[1]);
      const startDate = `${selectedMonth}-01`;

      // Obter o último dia do mês corretamente
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${selectedMonth}-${lastDay}`;

      console.log('Fetching history range:', startDate, 'to', endDate);

      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          id,
          date,
          class:classes!attendance_records_class_id_fkey(name),
          entries:attendance_entries(
            record_id,
            student_id,
            status, 
            student:profiles!attendance_entries_student_id_fkey(full_name)
          )
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) {
        console.error('Supabase Query Error:', error.message, error.details, error.hint);
        throw error;
      }
      setHistoryRecords(data || []);
    } catch (err: any) {
      console.error('Detailed History Fetch Error:', err);
      toast.error('Erro ao carregar histórico: ' + (err.message || 'Verifique o console'));
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  // 2. Fetch Students when Class changes
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }

    async function fetchStudents() {
      setLoading(true);
      const supabase = createClient();

      // Get enrollments joined with profiles
      const { data, error } = await supabase
        .from('class_enrollments')
        .select(`
          profile:profiles ( id, full_name, face_descriptor, role )
        `)
        .eq('class_id', selectedClassId);

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      // Format to state array
      const mapped = (data || []).map((x: any) => {
        const p = x.profile as StudentProfile;
        const descriptorArray = p.face_descriptor ? new Float32Array(p.face_descriptor) : null;

        return {
          profile: p,
          status: 'pendente' as const,
          descriptorFloat32: descriptorArray
        };
      });

      setStudents(mapped);
      setLoading(false);
    }

    fetchStudents();
  }, [selectedClassId]);

  const toggleStatus = (id: string, newStatus: 'presente' | 'ausente' | 'pendente') => {
    setStudents(prev => prev.map(s => s.profile.id === id ? { ...s, status: newStatus } : s));
  };

  const handleDetect = useCallback((detectedDescriptor: Float32Array) => {
    if (!detectedDescriptor) return;

    setStudents(prevStudents => {
      let matchedStudent = null;

      // Encontrar o primeiro aluno pendente que bate com a biometria
      for (const student of prevStudents) {
        if (student.status === 'presente' || !student.descriptorFloat32) continue;

        const isMatch = compareFaces(student.descriptorFloat32, detectedDescriptor);
        if (isMatch) {
          matchedStudent = student;
          break;
        }
      }

      if (matchedStudent) {
        toast.success(`Presença confirmada: ${matchedStudent.profile.full_name}`, {
          icon: '✅',
          duration: 3000
        });

        return prevStudents.map(s =>
          s.profile.id === matchedStudent!.profile.id
            ? { ...s, status: 'presente' as const }
            : s
        );
      }

      return prevStudents;
    });
  }, [compareFaces]);

  const handleSaveAttendance = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Create a Record
      const { data: recordData, error: recordError } = await supabase
        .from('attendance_records')
        .insert({
          class_id: selectedClassId,
          recorded_by: user?.id,
          date: new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local
        })
        .select()
        .single();

      if (recordError) throw recordError;

      // 2. Insert Entries
      const entries = students.map(s => ({
        record_id: recordData.id,
        student_id: s.profile.id,
        status: s.status
      }));

      const { error: entriesError } = await supabase
        .from('attendance_entries')
        .insert(entries);

      if (entriesError) throw entriesError;

      alert('Chamada salva com sucesso!');
      setIsCalling(false);

    } catch (err) {
      console.error(err);
      alert('Erro ao salvar chamada.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEntryStatus = async (recordId: string, studentId: string, newStatus: string) => {
    if (profile?.role !== 'admin' && profile?.role !== 'professor') return;
    
    const justification = window.prompt("Justificativa da alteração:");
    if (!justification) {
      toast.error("A justificativa é obrigatória para registrar a alteração.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      
      // 1. Encontrar o status antigo (opcional, para o log)
      const oldStatus = viewingRecord?.entries.find((e: any) => e.student_id === studentId)?.status;

      // 2. Atualizar a entrada (chave composta)
      const { error: updateError } = await supabase
        .from('attendance_entries')
        .update({ status: newStatus })
        .eq('record_id', recordId)
        .eq('student_id', studentId);

      if (updateError) throw updateError;
      
      // 3. Registrar Log (Auditoria)
      const { error: logError } = await supabase
        .from('attendance_change_logs')
        .insert({
          record_id: recordId,
          student_id: studentId,
          changed_by: profile.id,
          old_status: oldStatus,
          new_status: newStatus,
          justification
        });

      if (logError) {
        console.warn('Erro ao salvar log de auditoria, mas a chamada foi atualizada:', logError);
      }

      // Update local state for the modal
      setViewingRecord((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          entries: prev.entries.map((e: any) => 
            (e.record_id === recordId && e.student_id === studentId) ? { ...e, status: newStatus } : e
          )
        };
      });
      
      // Refresh history list parent
      setHistoryRecords(prev => prev.map(r => {
        if (r.id === recordId) {
          return {
            ...r,
            entries: r.entries.map((e: any) => 
              (e.record_id === recordId && e.student_id === studentId) ? { ...e, status: newStatus } : e
            )
          };
        }
        return r;
      }));
      
      toast.success('Status atualizado e registrado em log');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar status');
    } finally {
      setSaving(false);
    }
  };

  const relatorio = {
    presentes: students.filter(s => s.status === 'presente').length,
    ausentes: students.filter(s => s.status === 'ausente').length,
    pendentes: students.filter(s => s.status === 'pendente').length,
    total: students.length
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Chamada Virtual</h1>
          <p className="text-muted-foreground mt-1">
            Controle de presença automatizado por Reconhecimento Facial IA.
          </p>
        </div>
      </div>

      <div className="w-full">
        <div className="flex w-full max-w-md bg-zinc-100 dark:bg-zinc-900 mb-6 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('current')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'current' ? 'bg-white dark:bg-zinc-800 shadow-sm text-[var(--primary)]' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <UserCheck size={16} /> Chamada Hoje
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'history' ? 'bg-white dark:bg-zinc-800 shadow-sm text-[var(--primary)]' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <History size={16} /> Histórico Anterior
          </button>
        </div>

        {activeTab === 'current' && (
          <div className="grid lg:grid-cols-[1fr,400px] gap-8 animate-in fade-in duration-300">

            {/* Painel da Câmera (Esquerda) */}
            <div className="space-y-6">
              <Card className="border-0 shadow-xl bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between bg-zinc-50 dark:bg-zinc-900 border-b border-border/40">
                  <div className="space-y-1">
                    <CardTitle>Reconhecimento Biométrico</CardTitle>
                    <CardDescription>A câmera rastreará e computará os alunos matriculados nesta turma.</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <Select value={selectedClassId} onValueChange={(val) => setSelectedClassId(val || '')}>
                      <SelectTrigger className="w-[200px] bg-white dark:bg-zinc-950">
                        <SelectValue placeholder="Selecione a Turma" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        {classes.length === 0 && <SelectItem value="disabled" disabled>Nenhuma turma</SelectItem>}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => setIsCalling(!isCalling)}
                      variant={isCalling ? 'destructive' : 'default'}
                      className={!isCalling ? 'bg-[var(--primary)] text-white hover:bg-[#A93226]' : ''}
                      disabled={!selectedClassId || loading}
                    >
                      {isCalling ? 'Encerrar Câmera' : 'Iniciar Escaneamento'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0 bg-zinc-950 min-h-[350px] flex flex-col justify-center">
                  {isCalling ? (
                    <FaceCamera overlayMode="attendance" onDetect={handleDetect} />
                  ) : (
                    <div className="aspect-video w-full flex flex-col items-center justify-center text-zinc-500 bg-zinc-900 border-y border-zinc-800 p-6 text-center">
                      <UserCheck className="w-16 h-16 mb-4 opacity-50 text-[var(--primary)]" />
                      <p className="font-medium">Selecione uma turma e inicie o escaneamento.</p>
                      <p className="text-sm mt-2 opacity-75 max-w-sm">O modelo de Inteligência Artificial comparará os rastros biométricos localmente com as fotos cadastradas dos alunos.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Lista de Alunos (Direita) */}
            <div className="space-y-6 h-full flex flex-col">
              <Card className="border-0 shadow-xl bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md flex flex-col h-full flex-1">
                <CardHeader className="pb-4 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <CardTitle>Diário de Classe</CardTitle>
                    <Badge variant="outline" className="bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20">
                      Data: {new Date().toLocaleDateString('pt-BR')}
                    </Badge>
                  </div>

                  {/* Progress Bar of Attendance */}
                  <div className="mt-6">
                    <div className="flex justify-between text-xs font-medium mb-2 uppercase text-muted-foreground tracking-wider">
                      <span className="text-emerald-600 dark:text-emerald-400">{relatorio.presentes} Presentes</span>
                      <span className="text-red-600 dark:text-red-400">{relatorio.ausentes} Ausentes</span>
                    </div>
                    <div className="flex h-2 w-full rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                      <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${relatorio.total === 0 ? 0 : (relatorio.presentes / relatorio.total) * 100}%` }} />
                      <div className="bg-zinc-400 dark:bg-zinc-600 transition-all duration-500" style={{ width: `${relatorio.total === 0 ? 0 : (relatorio.pendentes / relatorio.total) * 100}%` }} />
                      <div className="bg-red-500 transition-all duration-500" style={{ width: `${relatorio.total === 0 ? 0 : (relatorio.ausentes / relatorio.total) * 100}%` }} />
                    </div>
                  </div>

                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px]">
                  <div className="divide-y divide-border/40">
                    {loading && selectedClassId && (
                      <div className="flex justify-center p-8 text-muted-foreground"><Loader2 className="animate-spin w-8 h-8" /></div>
                    )}

                    {!loading && students.length === 0 && selectedClassId && (
                      <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                        <Users className="w-8 h-8 opacity-20 mb-2" />
                        <p>Nenhum aluno matriculado nesta turma.</p>
                      </div>
                    )}

                    {!loading && !selectedClassId && (
                      <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                        <UserCheck className="w-8 h-8 opacity-20 mb-2" />
                        <p>Selecione uma turma para carregar os alunos.</p>
                      </div>
                    )}

                    {students.map(aluno => (
                      <div key={aluno.profile.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--primary)] to-[var(--secondary)] text-white text-xs font-bold flex items-center justify-center relative">
                            {aluno.profile.full_name.charAt(0)}
                            {/* Dot indicator if face descriptor is missing */}
                            {!aluno.descriptorFloat32 && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900" title="Sem biometria facial cadastrada"></span>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium leading-tight">{aluno.profile.full_name}</span>
                              <Badge variant="outline" className={`text-[9px] h-4 px-1 ${aluno.profile.role === 'professor' ? 'border-amber-500 text-amber-500' : 'border-zinc-300'}`}>
                                {aluno.profile.role === 'professor' ? 'Prof.' : 'Aluno'}
                              </Badge>
                            </div>
                            {!aluno.descriptorFloat32 && <span className="text-[10px] text-red-500 font-bold">⚠️ Sem Biometria</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`h-8 w-8 rounded-full ${aluno.status === 'presente' ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 hover:text-emerald-700' : 'text-zinc-400'}`}
                            onClick={() => toggleStatus(aluno.profile.id, 'presente')}
                          >
                            <CheckCircle2 size={18} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`h-8 w-8 rounded-full ${aluno.status === 'ausente' ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-950/50 dark:text-red-400 hover:text-red-700' : 'text-zinc-400'}`}
                            onClick={() => toggleStatus(aluno.profile.id, 'ausente')}
                          >
                            <XCircle size={18} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`h-8 w-8 rounded-full ${aluno.status === 'pendente' ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 hover:text-zinc-700' : 'text-zinc-400'}`}
                            onClick={() => toggleStatus(aluno.profile.id, 'pendente')}
                          >
                            <AlertCircle size={18} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-border/40">
                  <Button
                    className="w-full bg-[var(--primary)] text-white hover:bg-[#A93226] shadow-md shadow-[var(--primary)]/20"
                    disabled={!selectedClassId || students.length === 0 || saving}
                    onClick={handleSaveAttendance}
                  >
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Finalizar Chamada do Dia
                  </Button>
                </CardFooter>
              </Card>
            </div>

          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between bg-white dark:bg-zinc-950 p-4 rounded-xl border border-border shadow-sm">
              <div className="flex items-center gap-4">
                <Calendar className="text-[var(--primary)]" />
                <div>
                  <h3 className="font-bold">Filtrar por Período</h3>
                  <p className="text-xs text-muted-foreground">Selecione o mês para visualizar registros anteriores</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => {
                  const d = new Date(selectedMonth + '-02');
                  d.setMonth(d.getMonth() - 1);
                  setSelectedMonth(d.toISOString().substring(0, 7));
                }}>
                  <ChevronLeft size={16} />
                </Button>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-40 h-10"
                />
                <Button variant="outline" size="icon" onClick={() => {
                  const d = new Date(selectedMonth + '-02');
                  d.setMonth(d.getMonth() + 1);
                  setSelectedMonth(d.toISOString().substring(0, 7));
                }}>
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loadingHistory ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-40 bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-xl" />
                ))
              ) : historyRecords.length === 0 ? (
                <div className="col-span-full py-20 text-center text-muted-foreground flex flex-col items-center">
                  <History size={48} className="opacity-10 mb-4" />
                  <p>Nenhuma chamada encontrada para este período.</p>
                </div>
              ) : (
                historyRecords.map(record => {
                  const stats = {
                    presentes: record.entries.filter((e: any) => e.status === 'presente').length,
                    total: record.entries.length
                  };

                  console.log("RECORD", record);
                  return (
                    <Card key={record.id} className="hover:shadow-lg transition-all border-border/40 group overflow-hidden">
                      <CardHeader className="p-4 bg-zinc-50 dark:bg-zinc-900/40 border-b border-border/20">
                        <div className="flex justify-between items-start">
                          <Badge variant="outline" className="text-[10px] mb-2">{record.class?.name || 'Turma Removida'}</Badge>
                          <span className="text-[10px] font-bold text-muted-foreground">
                            {(() => {
                              const [y, m, d] = record.date.split('-').map(Number);
                              return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
                            })()}
                          </span>
                        </div>
                        <CardTitle className="text-lg flex items-center justify-between">
                          Chamada Realizada
                          <span className="text-sm font-normal text-emerald-500 font-mono">{stats.presentes}/{stats.total}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="flex h-1 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full mb-4">
                          <div className="bg-emerald-500 h-full" style={{ width: `${(stats.presentes / stats.total) * 100}%` }} />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-muted-foreground group-hover:text-[var(--primary)] transition-colors"
                          onClick={() => setViewingRecord(record)}
                        >
                          <Eye size={14} className="mr-2" /> Ver Detalhes
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETALHES DO HISTÓRICO */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-black/60 shadow-2xl backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <CardHeader className="bg-zinc-50 dark:bg-zinc-900 border-b border-border">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl">Detalhes da Chamada</CardTitle>
                  <CardDescription>
                    {viewingRecord.class?.name} - {(() => {
                      const [y, m, d] = viewingRecord.date.split('-').map(Number);
                      return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
                    })()}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setViewingRecord(null)}>
                  <XCircle className="w-6 h-6 text-muted-foreground" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3">Nome do Aluno</th>
                    <th className="px-6 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {viewingRecord.entries.sort((a: any, b: any) => a.student?.full_name?.localeCompare(b.student?.full_name)).map((entry: any, i: number) => (
                    <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                      <td className="px-6 py-4 text-sm font-medium">{entry.student?.full_name || 'Usuário Removido'}</td>
                      <td className="px-6 py-4 text-right">
                        {(profile?.role === 'admin' || profile?.role === 'professor') ? (
                          <div className="flex justify-end gap-1">
                             <Button 
                               size="sm" 
                               variant={entry.status === 'presente' ? 'default' : 'ghost'}
                               className={entry.status === 'presente' ? 'bg-emerald-500 hover:bg-emerald-600' : 'text-zinc-400'}
                               onClick={() => handleUpdateEntryStatus(viewingRecord.id, entry.student_id, 'presente')}
                             >
                               P
                             </Button>
                             <Button 
                               size="sm" 
                               variant={entry.status === 'ausente' ? 'destructive' : 'ghost'}
                               className={entry.status === 'ausente' ? '' : 'text-zinc-400'}
                               onClick={() => handleUpdateEntryStatus(viewingRecord.id, entry.student_id, 'ausente')}
                             >
                               A
                             </Button>
                             <Button 
                               size="sm" 
                               variant={entry.status === 'pendente' ? 'secondary' : 'ghost'}
                               className={entry.status === 'pendente' ? '' : 'text-zinc-400'}
                               onClick={() => handleUpdateEntryStatus(viewingRecord.id, entry.student_id, 'pendente')}
                             >
                               ?
                             </Button>
                          </div>
                        ) : (
                          <Badge className={
                            entry.status === 'presente' ? "bg-emerald-500/10 text-emerald-500 border-none" :
                              entry.status === 'ausente' ? "bg-red-500/10 text-red-500 border-none" :
                                "bg-zinc-500/10 text-zinc-500 border-none"
                          }>
                            {entry.status.toUpperCase()}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
            <CardFooter className="bg-zinc-50 dark:bg-zinc-900 border-t border-border p-4 flex justify-between items-center">
                 <div className="flex gap-4 text-[10px] uppercase font-bold text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Presente</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Ausente</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-400"></span> Pendente</span>
                 </div>
                 <div className="flex items-center gap-3">
                    <p className="text-[10px] text-muted-foreground font-mono">ID: {viewingRecord.id.substring(0,8)}</p>
                    <Button onClick={() => setViewingRecord(null)}>Fechar</Button>
                 </div>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
