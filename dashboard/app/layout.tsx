import { Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import {
  LayoutDashboard,
  MessageSquare,
  Wrench,
  Activity,
  Package,
  Settings,
} from "lucide-react";
import Link from "next/link";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata = {
  title: "Visible Swarm | AI Control Center",
  description: "Advanced AI Swarm Management Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${outfit.className} bg-background text-foreground antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
        >
          <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/10 bg-black/20 backdrop-blur-xl flex flex-col">
              <div className="p-6">
                <h1 className="text-xl font-bold glow-text tracking-wider uppercase">
                  Visible Swarm
                </h1>
                <p className="text-[10px] text-blue-400 font-medium tracking-[0.2em] mt-1">
                  CONTROL CENTER
                </p>
              </div>

              <nav className="flex-1 px-4 space-y-2 mt-4">
                <Link href="/dashboard" className="sidebar-item-active">
                  <LayoutDashboard size={20} />
                  <span>Dashboard</span>
                </Link>
                <Link href="#" className="sidebar-item">
                  <MessageSquare size={20} />
                  <span>Live Chat</span>
                </Link>
                <Link href="#" className="sidebar-item">
                  <Wrench size={20} />
                  <span>Visible Swarm Tools</span>
                </Link>
                <Link href="#" className="sidebar-item">
                  <Activity size={20} />
                  <span>Agent Status</span>
                </Link>
                <Link href="#" className="sidebar-item">
                  <Settings size={20} />
                  <span>Settings</span>
                </Link>
              </nav>

              <div className="p-4 mt-auto">
                <div className="glass rounded-xl p-4 text-[10px] text-slate-500 uppercase tracking-widest text-center">
                  v2.0.4 - PRODUCTION
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-background to-background">
              <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-black/10 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-tighter">
                    System Online
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <button className="glass px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors">
                    Deploy Update
                  </button>
                  <div className="h-8 w-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs">
                    JS
                  </div>
                </div>
              </header>
              <div className="p-8">{children}</div>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
