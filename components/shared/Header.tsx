"use client";

import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header() {
  const pathname = usePathname();
  
  // Format the current date in pt-BR
  const currentDate = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  // Generate page title based on pathname
  let pageTitle = "Dashboard";
  if (pathname.includes('/trilhas')) pageTitle = "Trilhas de Aprendizagem";
  if (pathname.includes('/conteudo')) pageTitle = "Criar Conteúdo";
  if (pathname.includes('/chamada')) pageTitle = "Chamada Virtual";
  if (pathname.includes('/seguranca')) pageTitle = "Segurança Central";
  if (pathname.includes('/chat')) pageTitle = "LUMI IA";
  if (pathname.includes('/admin')) pageTitle = "Administração";

  return (
    <header className="h-16 px-8 flex items-center justify-between bg-white dark:bg-zinc-950 border-b border-border sticky top-0 z-30 shadow-sm">
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground">{pageTitle}</h1>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="hidden md:block text-sm text-muted-foreground capitalize">
          {currentDate}
        </div>
        
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell size={20} />
          <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-[var(--accent)] border-2 border-white dark:border-zinc-950"></span>
        </Button>
      </div>
    </header>
  );
}
