export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 overflow-hidden relative">
      {/* Background with abstract shapes, utilizing the primary gradient variables */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] bg-[var(--primary)] rounded-full mix-blend-multiply blur-[120px] opacity-30 animate-pulse"></div>
        <div className="absolute top-[20%] -right-[10%] w-[40vw] h-[40vw] bg-[var(--secondary)] rounded-full mix-blend-multiply blur-[120px] opacity-30 animate-pulse delay-1000"></div>
        <div className="absolute -bottom-[10%] left-[20%] w-[60vw] h-[60vw] bg-[var(--accent)] rounded-full mix-blend-multiply blur-[120px] opacity-20 animate-pulse delay-2000"></div>
      </div>
      
      <div className="z-10 w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
