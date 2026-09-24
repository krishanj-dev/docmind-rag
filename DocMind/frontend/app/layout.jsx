import './globals.css';

export const metadata = {
  title: 'DocMind — Ask your documents',
  description: 'Upload PDFs and get answers grounded in your documents.',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
