import "./globals.css";

export const metadata = {
  title: "Dashboard de Hábitos — Reto de 6 meses",
  description: "Seguimiento de hábitos por 6 meses en 4 áreas de vida",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
