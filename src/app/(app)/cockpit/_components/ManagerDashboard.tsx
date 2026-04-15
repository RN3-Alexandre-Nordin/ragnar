"use client";

import { BarChart3, Users, Target, Building2, TrendingUp, Wallet, ArrowUpRight, MessageSquare, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useCockpitRealtime } from "@/hooks/useCockpitRealtime"
import { useEffect, useState } from "react"

export default function ManagerDashboard({ userName, userId }: { userName: string, userId: string }) {
  const { lastEvent } = useCockpitRealtime(userId, userName);
  const [highlightStats, setHighlightStats] = useState(false);

  useEffect(() => {
    if (lastEvent) {
      setHighlightStats(true);
      const timer = setTimeout(() => setHighlightStats(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastEvent]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black tracking-tight text-white drop-shadow-sm flex items-center gap-3 italic uppercase text-orange-500">
          Cockpit do Gestor
          <span className="text-[10px] font-black py-1 px-3 bg-orange-500/10 text-orange-500 rounded-full border border-orange-500/20 tracking-widest">
            CONTROL CENTER
          </span>
        </h2>
        <p className="text-sm text-gray-400 font-medium">
          Olá, <span className="text-white font-bold">{userName}</span>. Veja abaixo a performance da sua empresa e operações em andamento.
        </p>
      </div>

      <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 transition-all ${highlightStats ? 'scale-[1.01]' : ''}`}>
        <div className="rounded-2xl border border-[#ffffff0a] bg-[#111111] p-5 shadow-sm relative overflow-hidden group hover:border-orange-500/30 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-[#80B828] bg-[#80B828]/10 px-2 py-1 rounded">MÊS ATUAL</span>
          </div>
          <p className="text-3xl font-black text-white">R$ 45.280</p>
          <p className="text-sm font-medium text-gray-500 mt-1">Vendas Concluídas</p>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-[#80B828]">
            <ArrowUpRight className="w-3 h-3" />
            +12.5% vs mês anterior
          </div>
        </div>

        <div className="rounded-2xl border border-[#ffffff0a] bg-[#111111] p-5 shadow-sm relative overflow-hidden group hover:border-orange-500/30 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
              <Target className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-white">85</p>
          <p className="text-sm font-medium text-gray-500 mt-1">Leads no Funil</p>
          <Link href="/cockpit/crm" className="absolute inset-0 z-10" />
        </div>

        <div className="rounded-2xl border border-[#ffffff0a] bg-[#111111] p-5 shadow-sm relative overflow-hidden group hover:border-orange-500/30 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-white">24</p>
          <p className="text-sm font-medium text-gray-500 mt-1">Chats Operacionais</p>
          <Link href="/cockpit/chat" className="absolute inset-0 z-10" />
        </div>

        <div className="rounded-2xl border border-[#ffffff0a] bg-[#111111] p-5 shadow-sm relative overflow-hidden group hover:border-red-500/30 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-white">7</p>
          <p className="text-sm font-medium text-gray-500 mt-1">Gargalos no Processo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
        {/* Performance Overview */}
        <div className="bg-[#111111] border border-[#ffffff0a] rounded-2xl p-6 relative overflow-hidden">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-orange-500" />
            Visão Geral de Conversão
          </h3>
          <div className="h-48 flex items-end justify-between gap-1.5 px-2">
            {[40, 65, 45, 90, 55, 75, 60, 85, 50, 95, 70, 80].map((h, i) => (
              <div 
                key={i} 
                className="flex-1 bg-gradient-to-t from-orange-500/10 to-orange-500/40 rounded-t-md transition-all hover:to-orange-500 hover:scale-x-105"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-4 px-2 text-[10px] text-gray-600 font-bold uppercase tracking-wider">
            <span>Jan</span>
            <span>Jun</span>
            <span>Dez</span>
          </div>
        </div>

        {/* Quick Admin Navigation */}
        <div className="bg-[#111111] border border-[#ffffff0a] rounded-2xl p-6 relative overflow-hidden">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
             <Settings className="w-5 h-5 text-gray-400" />
             Administração do Cockpit
          </h3>
          <div className="grid grid-cols-2 gap-4">
             <Link href="/cockpit/usuarios" className="p-4 rounded-xl bg-[#ffffff03] border border-[#ffffff0a] hover:bg-orange-500/10 hover:border-orange-500/30 transition-all flex flex-col gap-3 group">
                <Users className="w-6 h-6 text-gray-500 group-hover:text-orange-500" />
                <span className="text-sm font-bold text-gray-300">Gestão de Equipe</span>
             </Link>
             <Link href="/cockpit/departamentos" className="p-4 rounded-xl bg-[#ffffff03] border border-[#ffffff0a] hover:bg-[#2BAADF]/10 hover:border-[#2BAADF]/30 transition-all flex flex-col gap-3 group">
                <Target className="w-6 h-6 text-gray-500 group-hover:text-[#2BAADF]" />
                <span className="text-sm font-bold text-gray-300">Estrutura Interna</span>
             </Link>
             <Link href="/cockpit/grupos" className="p-4 rounded-xl bg-[#ffffff03] border border-[#ffffff0a] hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all flex flex-col gap-3 group">
                <Wallet className="w-6 h-6 text-gray-500 group-hover:text-indigo-500" />
                <span className="text-sm font-bold text-gray-300">Níveis de Acesso</span>
             </Link>
             <Link href="/cockpit/empresas" className="p-4 rounded-xl bg-[#ffffff03] border border-[#ffffff0a] hover:bg-[#80B828]/10 hover:border-[#80B828]/30 transition-all flex flex-col gap-3 group">
                <Building2 className="w-6 h-6 text-gray-500 group-hover:text-[#80B828]" />
                <span className="text-sm font-bold text-gray-300">Dados da Conta</span>
             </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// Support for Settings icon in the above code
import { Settings } from "lucide-react"
