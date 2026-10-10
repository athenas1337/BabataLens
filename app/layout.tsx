import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/navigation/Sidebar";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Header } from "@/components/navigation/Header";

export const metadata: Metadata = {
  title: "Babata Lens — Personal AI Crypto Intelligence Workspace",
  description:
    "Calm, intelligent, and responsive crypto, blockchain, market, and wallet research workspace powered by Babata AI.",
  icons: {
    icon: "/babata/avatar.jpeg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#080C15] text-slate-100 min-h-screen flex flex-col md:flex-row antialiased">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          <Header />
          <main className="flex-1 pb-20 md:pb-6 overflow-x-hidden">{children}</main>
          {/* Mobile Bottom Navigation with Drawer */}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
