"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Users, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Trash2,
  Pencil,
  ChevronRight,
  Search,
  ArrowLeft,
  UserPlus,
  Settings2,
  GraduationCap,
  Scan
} from 'lucide-react';
import { toast } from 'sonner';
import FaceCamera from '@/components/shared/FaceCamera';

interface Student {
  id?: string;
  name?: string;
  full_name?: string;
  email?: string;
  password?: string;
  role?: string;
  face_descriptor?: number[] | null;
}

interface ClassModel {
  id: string;
  name: string;
  studentCount: number;
}

export default function AdminTurmasPage() {
  const [view, setView] = useState<'import' | 'manage' | 'professors'>('manage');
  const [className, setClassName] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState<{ email: string; status: string; message?: string }[]>([]);

  // Estados para Gestão
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassModel | null>(null);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Professor Management
  const [availableProfessors, setAvailableProfessors] = useState<Student[]>([]);
  const [loadingAvailableRooms, setLoadingAvailableRooms] = useState(false);
  const [professorSearch, setProfessorSearch] = useState('');

  // Estados para Edição
  const [editingItem, setEditingItem] = useState<{ type: 'class' | 'student'; id: string; name: string; email?: string } | null>(null);

  // Estados Biometria
  const [enrollingUser, setEnrollingUser] = useState<Student | null>(null);
  const [isSavingFace, setIsSavingFace] = useState(false);

  // Estados Novo Aluno (Individual)
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [newStudentData, setNewStudentData] = useState({ name: '', email: '', password: '' });
  const [isRegisteringSingle, setIsRegisteringSingle] = useState(false);

  const fetchClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const response = await fetch('/api/admin/manage-classes');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setClasses(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao carregar turmas: ' + msg);
    } finally {
      setLoadingClasses(false);
    }
  }, []);

  const fetchClassStudents = useCallback(async (classId: string) => {
    setLoadingStudents(true);
    try {
      const response = await fetch(`/api/admin/manage-classes?classId=${classId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setClassStudents(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao carregar alunos: ' + msg);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  const fetchAvailableProfessors = useCallback(async () => {
    setLoadingAvailableRooms(true);
    try {
      const response = await fetch('/api/admin/manage-classes?searchRole=professor');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAvailableProfessors(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar professores';
      toast.error(msg);
    } finally {
      setLoadingAvailableRooms(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'manage' && !selectedClass) {
      fetchClasses();
    }
    if (view === 'professors' || (view === 'manage' && selectedClass)) {
        fetchAvailableProfessors();
    }
  }, [view, selectedClass, fetchClasses, fetchAvailableProfessors]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const parsedStudents: Student[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const [name, email, password] = line.split(/[;,]/);
        if (name && email) {
          parsedStudents.push({ 
            name: name.trim(), 
            email: email.trim(), 
            password: password?.trim() || 'tec@123' 
          });
        }
      }
      setStudents(parsedStudents);
      toast.success(`${parsedStudents.length} alunos detectados.`);
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const processRegistration = async () => {
    if (!className) return toast.error('Informe o nome da turma.');
    if (students.length === 0) return toast.error('Nenhum aluno carregado.');

    setIsUploading(true);
    const loadingToast = toast.loading('Processando registro em lote...');

    try {
      const response = await fetch('/api/admin/batch-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ className, students })
      });
      const data = await response.json() as { results?: { email: string; status: string; message?: string }[], error?: string };
      if (!response.ok) throw new Error(data.error || 'Erro desconhecido');
      if (data.results) setResults(data.results);
      toast.success('Concluído!', { id: loadingToast });
      setClassName('');
      setStudents([]);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro interno';
      toast.error(msg, { id: loadingToast });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingItem) return;
    const loadingToast = toast.loading('Salvando alterações...');
    try {
      const response = await fetch('/api/admin/manage-classes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: editingItem.type, 
          id: editingItem.id, 
          data: { 
            full_name: editingItem.type === 'student' ? editingItem.name : undefined,
            name: editingItem.type === 'class' ? editingItem.name : undefined,
            email: editingItem.email
          } 
        })
      });
      if (!response.ok) throw new Error('Erro ao salvar');
      toast.success('Atualizado com sucesso!', { id: loadingToast });
      setEditingItem(null);
      if (selectedClass) fetchClassStudents(selectedClass.id);
      else if (view === 'professors') fetchAvailableProfessors();
      else fetchClasses();
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao atualizar';
      toast.error(msg, { id: loadingToast });
    }
  };

  const enrollProfessor = async (classId: string, userId: string) => {
    const loadingToast = toast.loading('Adicionando professor...');
    try {
      const response = await fetch('/api/admin/manage-classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'enrollment', classId, userId })
      });
      if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Erro ao vincular professor');
      }
      toast.success('Professor vinculado!', { id: loadingToast });
      fetchClassStudents(classId);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao vincular';
        toast.error(msg, { id: loadingToast });
    }
  };

  const handleFaceDetect = async (descriptor: Float32Array) => {
    if (!enrollingUser || isSavingFace) return;
    
    // Convert Float32Array to regular Array for Supabase
    const descriptorArray = Array.from(descriptor);
    setIsSavingFace(true);
    const loadingToast = toast.loading('Salvando biometria no perfil...');

    try {
      const response = await fetch('/api/admin/enroll-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: enrollingUser.id, descriptor: descriptorArray })
      });

      if (!response.ok) throw new Error('Falha ao salvar biometria.');

      toast.success('Biometria cadastrada com sucesso!', { id: loadingToast });
      setEnrollingUser(null);
    } catch (err: unknown) {
      toast.error('Erro ao salvar: ' + (err instanceof Error ? err.message : 'Tente novamente.'), { id: loadingToast });
    } finally {
      setIsSavingFace(false);
    }
  };

  const handleSingleRegister = async () => {
    if (!selectedClass || !newStudentData.name || !newStudentData.email) {
      return toast.error('Preencha os campos obrigatórios.');
    }

    setIsRegisteringSingle(true);
    const loadingToast = toast.loading('Registrando aluno...');

    try {
      const response = await fetch('/api/admin/batch-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          className: selectedClass.name, 
          students: [{ 
            name: newStudentData.name, 
            email: newStudentData.email, 
            password: newStudentData.password || 'tec@123' 
          }] 
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      if (data.results[0].status === 'error') {
        throw new Error(data.results[0].message);
      }

      toast.success('Aluno matriculado com sucesso!', { id: loadingToast });
      setIsAddingStudent(false);
      setNewStudentData({ name: '', email: '', password: '' });
      fetchClassStudents(selectedClass.id);
    } catch (err: unknown) {
      toast.error('Erro: ' + (err instanceof Error ? err.message : 'Falha no registro'), { id: loadingToast });
    } finally {
      setIsRegisteringSingle(false);
    }
  };

  const handleDelete = async (type: 'class' | 'enrollment' | 'student_permanent', id: string, extraId?: string) => {
    if (!confirm('Tem certeza? Esta ação não pode ser desfeita.')) return;
    const loadingToast = toast.loading('Excluindo...');
    try {
      let url = `/api/admin/manage-classes?type=${type}&id=${id}`;
      if (type === 'enrollment') url += `&studentId=${id}&classId=${extraId}`;
      
      const response = await fetch(url, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erro ao excluir');
      toast.success('Excluído com sucesso!', { id: loadingToast });
      if (selectedClass) fetchClassStudents(selectedClass.id);
      else if (view === 'professors') fetchAvailableProfessors();
      else fetchClasses();
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao excluir';
      toast.error(msg, { id: loadingToast });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Gestão Acadêmica</h1>
          <p className="text-muted-foreground mt-1">
            Administre turmas, matricule alunos e gerencie o quadro escolar.
          </p>
        </div>
        <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl w-fit border border-border">
          <Button 
            variant={view === 'manage' ? 'default' : 'ghost'} 
            onClick={() => { setView('manage'); setSelectedClass(null); }}
            className={view === 'manage' ? 'bg-[var(--primary)] text-white shadow-sm' : ''}
          >
            <Settings2 className="w-4 h-4 mr-2" /> Turmas
          </Button>
          <Button 
            variant={view === 'professors' ? 'default' : 'ghost'} 
            onClick={() => { setView('professors'); setSelectedClass(null); }}
            className={view === 'professors' ? 'bg-[var(--primary)] text-white shadow-sm' : ''}
          >
            <GraduationCap className="w-4 h-4 mr-2" /> Professores
          </Button>
          <Button 
            variant={view === 'import' ? 'default' : 'ghost'} 
            onClick={() => setView('import')}
            className={view === 'import' ? 'bg-[var(--primary)] text-white shadow-sm' : ''}
          >
            <UserPlus className="w-4 h-4 mr-2" /> Importar CSV
          </Button>
        </div>
      </div>

      {view === 'professors' && (
          <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
             <Card className="border-0 shadow-xl bg-white dark:bg-zinc-950 overflow-hidden">
                <CardHeader className="border-b border-border flex flex-row items-center justify-between">
                   <div>
                      <CardTitle>Quadro de Professores Cadastrados</CardTitle>
                      <CardDescription>Lista global de todos os docentes registrados no sistema.</CardDescription>
                   </div>
                   <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Buscar professor..." className="pl-9 h-9" value={professorSearch} onChange={e => setProfessorSearch(e.target.value)} />
                   </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-border text-xs uppercase font-bold text-muted-foreground">
                         <tr>
                            <th className="px-6 py-4">Nome</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                         {loadingAvailableRooms ? (
                             <tr><td colSpan={3} className="py-20 text-center"><Loader2 className="animate-spin mx-auto w-8 h-8" /></td></tr>
                         ) : availableProfessors.filter(p => (p.full_name || '').toLowerCase().includes(professorSearch.toLowerCase())).map(p => (
                            <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                               <td className="px-6 py-4 font-medium">{p.full_name}</td>
                               <td className="px-6 py-4">
                                  <Badge className="bg-emerald-500/10 text-emerald-500 border-none">Ativo</Badge>
                                </td>
                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                   <Button 
                                     variant="ghost" 
                                     size="sm" 
                                     className={p.face_descriptor ? "text-amber-500" : "text-emerald-500"} 
                                     onClick={() => {
                                        if (p.face_descriptor && !confirm('Este professor já possui biometria cadastrada. Deseja sobrescrever?')) return;
                                        setEnrollingUser(p);
                                     }}
                                   >
                                      <Scan size={14} className="mr-2" /> 
                                      {p.face_descriptor ? 'Recadastrar' : 'Biometria'}
                                   </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setEditingItem({ type: 'student', id: p.id!, name: p.full_name || 'Sem nome' })}>
                                     <Pencil size={14} className="mr-2" /> Editar
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete('student_permanent', p.id!)}>
                                     <Trash2 size={14} className="mr-2" /> Excluir
                                  </Button>
                               </td>
                            </tr>
                         ))}
                         {availableProfessors.length === 0 && !loadingAvailableRooms && (
                             <tr><td colSpan={3} className="py-20 text-center text-muted-foreground italic">Nenhum professor cadastrado.</td></tr>
                         )}
                      </tbody>
                   </table>
                </CardContent>
             </Card>
          </div>
      )}

      {view === 'import' ? (
        <div className="grid lg:grid-cols-[1fr,400px] gap-8 animate-in slide-in-from-right-4 duration-300">
           <div className="space-y-6">
            <Card className="border-0 shadow-lg bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2 font-bold">
                  <Upload className="w-5 h-5 text-[var(--primary)]" />
                  Nova Turma / Importação em Lote
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Nome da Turma</Label>
                  <Input placeholder="Ex: 3º Ano B" value={className} onChange={e => setClassName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Arquivo CSV</Label>
                  <label className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group">
                    <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                    <FileText className="w-10 h-10 text-muted-foreground mb-3 group-hover:scale-110 transition-transform" />
                    <span className="font-medium">Selecionar arquivo CSV</span>
                  </label>
                </div>
                {students.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-2 text-xs font-bold uppercase border-b border-border">Preview ({students.length} alunos)</div>
                    <div className="max-h-[200px] overflow-y-auto p-2 space-y-1">
                       {students.map((s, i) => (
                         <div key={i} className="flex items-center justify-between text-sm p-2 hover:bg-zinc-100 dark:hover:hover:bg-zinc-800 rounded">
                            <span>{s.name} - <span className="text-muted-foreground">{s.email}</span></span>
                            <button onClick={() => setStudents(prev => prev.filter((_, idx) => idx !== i))}><Trash2 size={14} className="text-red-400" /></button>
                         </div>
                       ))}
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                 <Button onClick={processRegistration} disabled={isUploading || !className || students.length === 0} className="w-full bg-[var(--primary)] text-white h-12 text-lg font-bold">
                    {isUploading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                    Confirmar Importação
                 </Button>
              </CardFooter>
            </Card>
           </div>
           <Card className="border-0 shadow-lg bg-white/80 dark:bg-zinc-950/80">
              <CardHeader><CardTitle className="text-sm uppercase text-muted-foreground">Log de Registro</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                 {results.length === 0 ? <p className="text-xs italic text-muted-foreground text-center py-10">Nenhuma operação realizada ainda.</p> : results.map((r, i) => (
                    <div key={i} className={`p-2 rounded text-xs border flex items-center gap-2 ${r.status === 'success' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                       {r.status === 'success' ? <CheckCircle2 size={12} className="text-emerald-500" /> : <AlertCircle size={12} className="text-red-500" />}
                       <span className="truncate">{r.email}</span>
                    </div>
                 ))}
              </CardContent>
           </Card>
        </div>
      ) : view === 'manage' ? (
        <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
           {!selectedClass ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loadingClasses ? (
                   <div className="col-span-full py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-muted-foreground" /></div>
                ) : classes.map(c => (
                   <Card key={c.id} className="border border-border/60 hover:border-[var(--primary)]/50 transition-colors group cursor-pointer overflow-hidden" onClick={() => { setSelectedClass(c); fetchClassStudents(c.id); }}>
                    <CardHeader className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-border/40">
                       <CardTitle className="text-lg flex items-center justify-between">
                          {c.name}
                          <ChevronRight size={18} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                       <div className="flex items-center gap-4 text-muted-foreground">
                          <div className="flex items-center gap-1"><Users size={16} /> <span className="font-bold text-foreground">{c.studentCount}</span> Alunos</div>
                       </div>
                    </CardContent>
                    <CardFooter className="flex gap-2 justify-end pt-0">
                       <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingItem({ type: 'class', id: c.id, name: c.name }); }}>
                          <Pencil size={14} />
                       </Button>
                       <Button variant="ghost" size="icon" className="text-red-500" onClick={(e) => { e.stopPropagation(); handleDelete('class', c.id); }}>
                          <Trash2 size={14} />
                       </Button>
                    </CardFooter>
                   </Card>
                ))}
             </div>
           ) : (
             <div className="space-y-6">
                <div className="flex items-center gap-4">
                   <Button variant="outline" size="sm" onClick={() => setSelectedClass(null)}><ArrowLeft size={16} className="mr-2" /> Voltar</Button>
                   <h2 className="text-2xl font-bold">{selectedClass.name}</h2>
                   <Badge className="bg-emerald-500/10 text-emerald-500 border-none">{classStudents.length} vinculados</Badge>
                </div>

                <Card className="border-0 shadow-xl bg-white dark:bg-zinc-950 overflow-hidden">
                   <CardHeader className="border-b border-border pb-4 bg-zinc-50/50 dark:bg-zinc-900/30">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                           <CardTitle className="text-sm font-bold uppercase text-[var(--primary)] flex items-center gap-2">
                              <Users size={16} /> Professores da Turma
                           </CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                           <select 
                             className="text-xs border rounded-md p-1.5 bg-white dark:bg-zinc-900 border-border max-w-[200px]"
                             onChange={(e) => {
                               if (e.target.value) {
                                  enrollProfessor(selectedClass.id, e.target.value);
                                  e.target.value = '';
                               }
                             }}
                           >
                             <option value="">+ Adicionar Professor</option>
                             {availableProfessors
                                .filter(p => !classStudents.some(cs => cs.id === p.id))
                                .map(p => (
                                   <option key={p.id} value={p.id}>{p.full_name}</option>
                                ))
                             }
                           </select>
                        </div>
                      </div>
                   </CardHeader>
                   <CardContent className="p-0">
                      <table className="w-full text-left text-sm">
                        <tbody className="divide-y divide-border">
                           {classStudents.filter(s => s.role === 'professor').map(s => (
                              <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                 <td className="px-6 py-3 font-semibold">{s.full_name || s.name}</td>
                                  <td className="px-6 py-4 text-right">
                                     <div className="flex justify-end gap-2">
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className={s.face_descriptor ? "text-amber-500" : "text-emerald-500"} 
                                          onClick={() => {
                                            if (s.face_descriptor && !confirm('Este professor já possui biometria cadastrada. Deseja sobrescrever?')) return;
                                            setEnrollingUser(s);
                                          }}
                                        >
                                           <Scan size={14} className="mr-2" /> {s.face_descriptor ? 'Recadastrar' : 'Biometria'}
                                        </Button>
                                       <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 h-8" onClick={() => handleDelete('enrollment', s.id!, selectedClass.id)}>
                                          Remover da Turma
                                       </Button>
                                    </div>
                                 </td>
                              </tr>
                           ))}
                           {classStudents.filter(s => s.role === 'professor').length === 0 && (
                              <tr><td className="px-6 py-4 text-center text-xs text-muted-foreground italic">Nenhum professor vinculado a esta turma.</td></tr>
                           )}
                        </tbody>
                      </table>
                   </CardContent>
                </Card>

                <Card className="border-0 shadow-xl bg-white dark:bg-zinc-950 overflow-hidden">
                   <CardHeader className="border-b border-border pb-4 flex flex-row items-center justify-between">
                      <CardTitle>Alunos Matriculados</CardTitle>
                      <div className="flex items-center gap-4">
                         <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="Buscar por nome..." className="pl-9 h-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                         </div>
                         <Button size="sm" className="bg-[var(--primary)] text-white" onClick={() => setIsAddingStudent(true)}>
                            <UserPlus className="w-4 h-4 mr-2" /> Novo Aluno
                         </Button>
                      </div>
                   </CardHeader>
                   <CardContent className="p-0 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-border text-xs uppercase font-bold text-muted-foreground">
                           <tr>
                              <th className="px-6 py-4">Nome completo</th>
                              <th className="px-6 py-4">Status / Role</th>
                              <th className="px-6 py-4 text-right">Ações</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                           {loadingStudents ? (
                              <tr><td colSpan={3} className="py-20 text-center"><Loader2 className="animate-spin mx-auto w-8 h-8 text-muted-foreground" /></td></tr>
                           ) : classStudents.filter(s => s.role !== 'professor' && (s.full_name || s.name || '').toLowerCase().includes(searchQuery.toLowerCase())).map(s => (
                              <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                 <td className="px-6 py-4 font-medium">{s.full_name || s.name}</td>
                                 <td className="px-6 py-4 text-xs font-bold uppercase text-emerald-500">{s.role}</td>
                                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                                     <Button 
                                       variant="ghost" 
                                       size="sm" 
                                       className={s.face_descriptor ? "text-amber-500" : "text-emerald-500"} 
                                       onClick={() => {
                                          if (s.face_descriptor && !confirm('Este aluno já possui biometria cadastrada. Deseja sobrescrever?')) return;
                                          setEnrollingUser(s);
                                       }}
                                     >
                                        <Scan size={14} className="mr-2" /> {s.face_descriptor ? 'Recadastrar' : 'Biometria'}
                                     </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setEditingItem({ type: 'student', id: s.id!, name: s.full_name || s.name || 'Sem nome', email: s.email })}>
                                       <Pencil size={14} className="mr-2" /> Editar
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete('enrollment', s.id!, selectedClass.id)}>
                                       <Trash2 size={14} className="mr-2" /> Remover
                                    </Button>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                      </table>
                   </CardContent>
                </Card>
             </div>
           )}
        </div>
      ) : null}

      {/* MODAL DE EDIÇÃO SIMPLES */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
              <CardHeader>
                 <CardTitle>Editar {editingItem.type === 'class' ? 'Turma' : 'Usuário'}</CardTitle>
                 <CardDescription>Altere as informações abaixo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} />
                 </div>
                 {editingItem.type === 'student' && (
                    <div className="space-y-2">
                       <Label>E-mail (Mudanças requerem confirmação)</Label>
                       <Input value={editingItem.email || ''} placeholder="usuario@exemplo.com" onChange={e => setEditingItem({...editingItem, email: e.target.value})} />
                    </div>
                 )}
              </CardContent>
              <CardFooter className="flex justify-end gap-3">
                 <Button variant="outline" onClick={() => setEditingItem(null)}>Cancelar</Button>
                 <Button onClick={handleUpdate} className="bg-[var(--primary)] text-white">Salvar Alterações</Button>
              </CardFooter>
           </Card>
         </div>
      )}

      {/* MODAL DE BIOMETRIA */}
      {enrollingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
           <Card className="w-full max-w-2xl bg-zinc-900 border-zinc-800 text-white shadow-2xl overflow-hidden">
              <CardHeader className="border-b border-zinc-800">
                 <div className="flex items-center justify-between">
                    <div>
                       <CardTitle className="text-xl">Registro Biométrico Facial</CardTitle>
                       <CardDescription className="text-zinc-400">Usuário: {enrollingUser.full_name || enrollingUser.name}</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setEnrollingUser(null)} className="text-zinc-400 hover:text-white">
                       ✕
                    </Button>
                 </div>
              </CardHeader>
              <CardContent className="p-0">
                 <div className="aspect-video relative">
                    <FaceCamera 
                      overlayMode="enroll" 
                      onDetect={handleFaceDetect}
                      isProcessing={isSavingFace}
                    />
                    {isSavingFace && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                         <Loader2 className="w-12 h-12 text-[var(--primary)] animate-spin mb-4" />
                         <p className="font-bold text-lg">Processando biometria...</p>
                      </div>
                    )}
                 </div>
                 <div className="p-6 bg-zinc-950/50">
                    <h4 className="font-bold text-sm uppercase text-zinc-500 mb-4 tracking-widest">Instruções de Captura</h4>
                    <ul className="grid grid-cols-2 gap-3 text-xs text-zinc-400">
                       <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Posicione o rosto no centro do quadro</li>
                       <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Mantenha uma expressão neutra</li>
                       <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Garanta boa iluminação frontal</li>
                       <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Remova óculos escuros ou máscaras</li>
                    </ul>
                 </div>
              </CardContent>
              <CardFooter className="border-t border-zinc-800 p-4 flex justify-between">
                  <p className="text-[10px] text-zinc-500 max-w-[300px]">A biometria é convertida em um vetor matemático irreversível, garantindo a privacidade do usuário conforme a LGPD.</p>
                  <Button variant="outline" onClick={() => setEnrollingUser(null)} className="border-zinc-700 text-zinc-300">
                    Cancelar Registro
                  </Button>
              </CardFooter>
           </Card>
         </div>
      )}

      {/* MODAL ADICIONAR ALUNO INDIVIDUAL */}
      {isAddingStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
              <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                    <UserPlus className="text-[var(--primary)]" />
                    Novo Aluno - {selectedClass?.name}
                 </CardTitle>
                 <CardDescription>O aluno será criado no sistema e matriculado nesta turma.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    <Input 
                      placeholder="Ex: João Silva" 
                      value={newStudentData.name} 
                      onChange={e => setNewStudentData({...newStudentData, name: e.target.value})} 
                    />
                 </div>
                 <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input 
                      type="email" 
                      placeholder="joao@escola.com" 
                      value={newStudentData.email} 
                      onChange={e => setNewStudentData({...newStudentData, email: e.target.value})} 
                    />
                 </div>
                 <div className="space-y-2">
                    <Label>Senha Temporária (Opcional)</Label>
                    <Input 
                      type="password" 
                      placeholder="tec@123" 
                      value={newStudentData.password} 
                      onChange={e => setNewStudentData({...newStudentData, password: e.target.value})} 
                    />
                 </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-3 p-6 bg-zinc-50 dark:bg-zinc-900/50">
                 <Button variant="outline" onClick={() => setIsAddingStudent(false)} disabled={isRegisteringSingle}>Cancelar</Button>
                 <Button 
                   onClick={handleSingleRegister} 
                   className="bg-[var(--primary)] text-white" 
                   disabled={isRegisteringSingle || !newStudentData.name || !newStudentData.email}
                 >
                    {isRegisteringSingle ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                    Confirmar Matrícula
                 </Button>
              </CardFooter>
           </Card>
        </div>
      )}
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${className}`}>{children}</span>
}
