"use client";

import { usePathname } from 'next/navigation';
import { Bell, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname();

  const currentDate = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  let pageTitle = "Dashboard";
  if (pathname.includes('/trilhas')) pageTitle = "Trilhas de Aprendizagem";
  if (pathname.includes('/conteudo')) pageTitle = "Criar Conteúdo";
  if (pathname.includes('/chamada')) pageTitle = "Chamada Virtual";
  if (pathname.includes('/seguranca')) pageTitle = "Segurança Central";
  if (pathname.includes('/chat')) pageTitle = "LUMI IA";
  if (pathname.includes('/admin')) pageTitle = "Administração";

  return (
    <header className="h-16 px-4 md:px-8 flex items-center justify-between bg-white dark:bg-zinc-950 border-b border-border sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Abrir menu"
        >
          <Menu size={22} />
        </button>
        <h1 className="text-lg md:text-xl font-heading font-bold text-foreground truncate">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
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
