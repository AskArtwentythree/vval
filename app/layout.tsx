import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'http://localhost:3000',
  ),
  title: 'Validate — Know who’s really there',
  description:
    'Verify a person once and collect fresh evidence that the same live person remains present.',
  openGraph: {
    title: 'Validate — Know who’s really there',
    description: 'Verified identity for live sessions.',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Validate — Know who’s really there. Verified identity for live sessions.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Validate — Know who’s really there',
    description: 'Verified identity for live sessions.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
