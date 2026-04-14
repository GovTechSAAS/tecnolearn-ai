"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import {
  LayoutDashboard,
  Map,
  Video,
  Camera,
  ShieldAlert,
  MessageSquare,
  Settings,
  LogOut,
  BrainCircuit,
  X,
  Menu
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const permissions = usePermissions();

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, show: true },
    { name: 'Trilhas', href: '/trilhas', icon: Map, show: true },
    { name: 'Criar Conteúdo', href: '/conteudo/criar', icon: Video, show: permissions.canCreateContent },
    { name: 'Chamada Virtual', href: '/chamada', icon: Camera, show: permissions.canTakeAttendance },
    { name: 'Segurança', href: '/seguranca', icon: ShieldAlert, show: permissions.canManageSecurity },
    { name: 'Chat LUMI', href: '/chat', icon: MessageSquare, show: permissions.canViewChat },
    { name: 'Gestão de Turmas', href: '/admin/turmas', icon: BrainCircuit, show: permissions.canManageClasses },
    { name: 'Configurações', href: '/admin/configuracoes', icon: Settings, show: permissions.canManageConfig },
  ];

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    if (onClose) onClose();
  }, [pathname]); // eslint-disable-line

  const sidebarContent = (
    <aside className="w-64 bg-white dark:bg-zinc-950 border-r border-border flex flex-col h-full shadow-sm">
      <div className="h-16 flex items-center justify-between px-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl tracking-tight text-[var(--primary)] hover:opacity-80 transition-opacity">
          <BrainCircuit size={28} />
          <span>learnapp</span>
        </Link>
        {/* Close button for mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3">
        <nav className="space-y-1">
          {navItems.filter(item => item.show).map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? 'bg-red-50 text-[var(--primary)] dark:bg-red-950/30'
                  : 'text-muted-foreground hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-900'
                }`}
              >
                <item.icon size={20} className={isActive ? 'text-[var(--primary)]' : ''} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-border bg-zinc-50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[var(--primary)] to-[var(--secondary)] text-white flex items-center justify-center font-bold shadow-sm shrink-0">
            {profile?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">{profile?.full_name || 'Carregando...'}</p>
            <p className="text-xs text-muted-foreground capitalize">{profile?.role || ''}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 font-medium rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        >
          <LogOut size={16} />
          Sair da conta
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Drawer */}
          <div className="fixed left-0 top-0 h-full z-50 animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
