import './globals.css';
import React from 'react';
import { AuthProvider } from '../components/AuthProvider';
import QueryProvider from '../components/QueryProvider';

export const metadata = {
  title: 'ClinIQ Lite',
  description: 'Minimal appointment scheduling + daily queue management for very small clinics (1-2 doctors, 1-2 staff). NOT an EMR. No medical reports, prescriptions, clinical notes, billing, or insurance.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-gray-900 font-sans">
        <QueryProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
