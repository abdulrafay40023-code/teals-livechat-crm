import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Teals CRM - LiveChat & Visitor Intelligence Suite',
  description: 'Real-time AI customer support, live visitor tracking, and hybrid human handoff SaaS platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-dark-bg text-dark-text antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
