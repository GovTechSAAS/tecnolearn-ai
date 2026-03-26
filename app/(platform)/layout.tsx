import { Sidebar } from '@/components/shared/Sidebar';
import { Header } from '@/components/shared/Header';
import { LumiChat } from '@/components/shared/LumiChat';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#F4F4F4] dark:bg-zinc-950 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto p-8 relative">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
        <LumiChat />
      </div>
    </div>
  );
}
