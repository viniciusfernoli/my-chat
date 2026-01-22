import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'SecureChat - Chat Criptografado',
  description: 'Chat seguro com criptografia end-to-end',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="font-sans bg-dark-950 text-white antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
