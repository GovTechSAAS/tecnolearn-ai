"use client";

import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BookOpen, 
  Target, 
  Clock, 
  Video, 
  BarChart, 
  Camera, 
  Users, 
  ShieldAlert, 
  Settings 
} from 'lucide-react';
import Link from 'next/link';
import { PERMISSIONS } from '@/lib/permissions';

function QuickAccessCard({ title, icon: Icon, href, badge }: { title: string; icon: any; href: string; badge?: string }) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-lg transition-transform hover:-translate-y-1 cursor-pointer border-border/50 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
            <Icon size={18} />
          </div>
        </CardHeader>
        <CardContent>
          {badge && (
            <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)] text-white">
              {badge}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const { profile, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-full">Carregando painel...</div>;
  }

  const role = profile?.role || 'aluno';

  const renderAlunoCards = () => (
    <>
      <QuickAccessCard title="Meus Cursos" icon={BookOpen} href="/trilhas" />
      <QuickAccessCard title="Meu Aprendizado" icon={Target} href="/trilhas" />
      <QuickAccessCard title="Atividades Pendentes" icon={Clock} href="/trilhas" badge="3 pendentes" />
      <QuickAccessCard title="Assistir Aulas" icon={Video} href="/trilhas" />
    </>
  );

  const renderProfessorCards = () => (
    <>
      <QuickAccessCard title="Conteúdos dos Cursos" icon={BookOpen} href="/conteudo/criar" />
      <QuickAccessCard title="Insights de Aprendizado" icon={BarChart} href="/dashboard" />
      <QuickAccessCard title="Chamada Virtual" icon={Camera} href="/chamada" />
      <QuickAccessCard title="Alunos" icon={Users} href="/dashboard" />
    </>
  );

  const renderMonitorCards = () => (
    <>
      <QuickAccessCard title="Chamada Virtual" icon={Camera} href="/chamada" />
      <QuickAccessCard title="Segurança" icon={ShieldAlert} href="/seguranca" />
      <QuickAccessCard title="Alunos" icon={Users} href="/dashboard" />
    </>
  );

  const renderAdminCards = () => (
    <>
      {renderProfessorCards()}
      <QuickAccessCard title="Segurança" icon={ShieldAlert} href="/seguranca" />
      <QuickAccessCard title="Configurações" icon={Settings} href="/admin/configuracoes" />
    </>
  );

  let dashboardCards;
  switch (role) {
    case 'aluno': dashboardCards = renderAlunoCards(); break;
    case 'professor': dashboardCards = renderProfessorCards(); break;
    case 'monitor': dashboardCards = renderMonitorCards(); break;
    case 'admin': dashboardCards = renderAdminCards(); break;
    default: dashboardCards = renderAlunoCards();
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Olá, {profile?.full_name?.split(' ')[0] || 'Visitante'}!</h1>
          <p className="text-muted-foreground mt-1">
            Seja bem-vindo(a) ao seu painel de {role === 'aluno' ? 'estudos' : 'gestão'}.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {dashboardCards}
      </div>

      {role === 'aluno' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Bimestre Placeholder */}
          <Card className="col-span-1 md:col-span-2 shadow-sm border-border/50">
            <CardHeader>
              <CardTitle>Progresso do Bimestre Atual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] w-full bg-zinc-100 dark:bg-zinc-900 rounded-lg flex items-center justify-center border border-dashed border-border text-muted-foreground">
                Módulo de Trilhas integrado em breve
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
