import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'BidEngine | Multi-Tender Command Centre',
  description: 'AI-Powered Tender Management Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey="pk_live_Y2xlcmsuYmlkZW5naW5lLmNvJA">
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
