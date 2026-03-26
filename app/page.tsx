import { redirect } from 'next/navigation';

export default function HomePage() {
  // O middleware fará o redirect automaticamente. 
  // Colocamos isso aqui por via das dúvidas.
  redirect('/login');
}
