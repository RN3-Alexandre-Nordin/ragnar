import Link from "next/link";
import { Building2, LayoutDashboard, Target, Users, ShieldCheck, LayoutTemplate, Inbox, Share2, Columns, MessageSquare, BookOpen } from "lucide-react";
import Image from "next/image";
import { logout } from "@/app/actions";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getMyProfile } from "@/app/(app)/cockpit/actions";
import GlobalChatSidebar from "@/components/chat/GlobalChatSidebar";
import Providers from "@/components/Providers";
import CockpitRealtimeManager from "./CockpitRealtimeManager";

export default async function CockpitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getMyProfile();
  const userName = me?.nome_completo || "Usuário";
  const userEmail = me?.email || "";
  const userId = me?.id || "";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const navigation = [
    { name: "Cockpit", href: "/cockpit", icon: LayoutDashboard },
    { name: "CRM Workspace", href: "/cockpit/crm", icon: LayoutTemplate },
    { name: "Funis", href: "/cockpit/crm/funis", icon: Columns },
    { name: "Base de Leads", href: "/cockpit/crm/leads", icon: Inbox },
    { name: "Chat Omnichannel", href: "/cockpit/crm/chat", icon: MessageSquare },
    { name: "Canais Inbound", href: "/cockpit/configuracoes/canais", icon: Share2 },
    { name: "Simulador de Chat", href: "/cockpit/crm/simulador", icon: MessageSquare },
    { name: "Base de Conhecimento", href: "/cockpit/crm/conhecimento", icon: BookOpen },
    { name: "Empresas", href: "/cockpit/empresas", icon: Building2 },
    { name: "Departamentos", href: "/cockpit/departamentos", icon: Target },
    { name: "Grupos de Acesso", href: "/cockpit/grupos", icon: ShieldCheck },
    { name: "Usuários", href: "/cockpit/usuarios", icon: Users },
  ];

  return (
    <Providers>
      <CockpitRealtimeManager userId={userId} userName={userName} />
      <div className="h-screen flex bg-[#0A0A0A] text-gray-100 font-sans font-medium overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 flex flex-col border-r border-[#ffffff0a] bg-[#0F0F0F] relative z-20">
          <div className="h-20 flex items-center px-6 border-b border-[#ffffff0a]">
            <Image
              src="/logotipo.png"
              alt="Ragnar"
              width={120}
              height={60}
              style={{ filter: "brightness(0) invert(1) opacity(0.9)" }}
            />
          </div>

          <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar-sidebar">
            {navigation.map((item) => {
              const isActive = false; // We would compute this with usePathname()
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-black tracking-tight transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-orange-500/20 to-orange-500/5 text-orange-500 border border-orange-500/20 shadow-[0_0_15px_-5px_orange]"
                      : "text-gray-400 hover:text-white hover:bg-[#ffffff0a] hover:translate-x-1"
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-[#ffffff0a]">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#ffffff03] border border-[#ffffff05] group hover:bg-[#ffffff08] transition-all">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-orange-500/10 group-hover:scale-105 transition-transform">
                {userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate leading-tight group-hover:text-orange-500 transition-colors">
                  {userName}
                </p>
                <p className="text-[10px] text-gray-500 truncate font-medium mt-0.5">{userEmail}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Glow effect matching login */}
          <div
            className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.03] pointer-events-none"
            style={{
              background: "radial-gradient(circle, #f97316 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />

          {/* Top Header */}
          <header className="h-20 flex-shrink-0 flex items-center justify-between px-8 border-b border-[#ffffff0a] bg-[#0A0A0A]/50 backdrop-blur-md sticky top-0 z-10">
            <h1 className="text-xl font-bold tracking-tight text-white/90 italic uppercase">
              Cockpit de Operações
            </h1>
            <div className="flex items-center gap-4">
              <LanguageSwitcher />

              <div className="h-5 w-px bg-[#ffffff1a]"></div>
              <form action={logout}>
                <button type="submit" className="text-sm font-bold text-red-400/80 hover:text-red-400 transition-colors uppercase tracking-widest text-[9px] cursor-pointer">
                  Encerrar Sessão
                </button>
              </form>
            </div>
          </header>

          {/* Page Content */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-8">{children}</div>
          
          {/* Global Chat Sidebar (Floating Drawer) */}
          <GlobalChatSidebar />
        </main>
      </div>
    </Providers>
  );
}
