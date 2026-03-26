# Tecnolearn EAD Platform (Next.js 14)

Tecnolearn é uma plataforma de ensino a distância (EAD) moderna, desenvolvida com a stack mais recente do ecossistema React. Idealizada como um SaaS de alto desempenho, ela integra as mais avançadas bibliotecas de UI/UX, Inteligência Artificial genertiva e Reconhecimento Facial em tempo real no próprio navegador (Client-side).

## 🚀 Tecnologias e Stack
- **Framework Core**: [Next.js 14+](https://nextjs.org/) (App Router)
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com/)
- **Cores**: Identidade visual com Primary `#C0392B`, Secondary `#6C3483` e Accent `#E67E22`.
- **Baas / DB / Auth**: [Supabase](https://supabase.com/) com rotas protegidas por Next.js Middleware.
- **Biometria & Câmera**: `face-api.js` local (Machine Learning on Browser) + MediaRecorder API
- **IA Generativa**: OpenRouter API (`google/gemini-2.5-flash-pro` ou similares configuráveis)

## 📦 Estrutura de Diretórios
- `/app/(auth)`: Rotas de onboarding (Login, Register, Forgot Password) contendo guardas publicos.
- `/app/(platform)`: Todas as views modulares da plataforma ativadas após login.
   - `/dashboard`: Painel interativo responsivo ao Perfil (Aluno, Professor, etc).
   - `/trilhas`: Mapas curvos de aprendizado 100% visuais em SVG e CSS.
   - `/conteudo`: Criação ativa de conteúdo com gravação de webcam `useMediaRecorder`.
   - `/chamada`: Painel de monitoramento de Turmas utilizando Face API para dar presente/ausente.
   - `/seguranca`: Alertas Blacklist com tracking biométrico.
   - `/admin`: Control Panel para Chaves de IA Institucionais.
- `/components`: 
   - `/ui`: Instâncias puras do shadcn (Buttons, Cards, Inputs).
   - `/shared`: Componentes universais complexos (`Sidebar`, `Header`, `FaceCamera`, `LumiChat`, `RoleGuard`).
- `/hooks`: Utilitários reativos (`useAuth`, `usePermissions`, `useMediaRecorder`, `useFaceApi`).
- `/lib`: Clientes centralizados (`supabase.ts`, `faceapi.ts`).

## ⚙️ Como Executar Localmente

1. **Instalar Dependências**
```bash
npm install
```

2. **Configuração Supabase & Envs**
Preencha seu `.env.local` na raiz:
```env
NEXT_PUBLIC_SUPABASE_URL=sua-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
OPENROUTER_API_KEY=sua-chave-ia
```

3. **Iniciando o Servidor**
```bash
npm run dev
```
Acesse `http://localhost:3000`. O middleware automaticamente enviará visitantes para `/login` e usuários autenticados para `/dashboard`.

## 🛡️ Modelos de Face API (Machine Learning)
Os modelos pesos para a detecção `.json/shard` estão estáticos na pasta `/public/models/`. Foram processados via `download-models.js`. Não os remova ou a câmera `<FaceCamera>` falhará a inicialização. A execução é restrita ao browser do usuário garantindo total privacidade biométrica (Zero Server-Side Storage para os feeds de vídeo).

## 👨‍💻 Políticas de Permissão (RBAC)
O roteamento da Sidebar e do `RoleGuard` processa os seguintes perfis:
- **Aluno**: Foco em consumir Trilhas e conversar com LUMI.
- **Professor**: Foco em Gravação de Tela/Vídeo e Dar Presenças em Chamadas.
- **Monitor**: Foco exclusivo em Câmeras e Segurança (Blacklist).
- **Admin**: Acesso Global.
