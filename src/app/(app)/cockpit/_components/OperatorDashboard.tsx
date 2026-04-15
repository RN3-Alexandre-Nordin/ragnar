"use client";

import { MessageCircle, Clock, CalendarDays, TrendingUp, AlertTriangle, Activity, ArrowUpRight, X } from "lucide-react"
import Link from "next/link"
import { useCockpitRealtime } from "@/hooks/useCockpitRealtime"
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getCockpitMetrics } from "../actions"
import ActivityFeed from "./ActivityFeed"
import ProductivityModal from "./ProductivityModal"
import BottleneckModal from "./BottleneckModal"

export default function OperatorDashboard({ userName, userId }: { userName: string, userId: string }) {
  const { lastEvent } = useCockpitRealtime(userId, userName);
  const [highlightChat, setHighlightChat] = useState(false);
  const [highlightCRM, setHighlightCRM] = useState(false);

  const { data: metricsResult } = useQuery({
    queryKey: ["cockpit-metrics", userId],
    queryFn: () => getCockpitMetrics(userId),
    refetchInterval: 30000, // Sync cada 30 segundos (heartbeat SaaS)
  });

  const metrics = metricsResult?.data || { atrasados: 0, hoje: 0, movimentacoes: 0, gargalo: 'Fluindo', chats: 0 };
  const [isProductivityModalOpen, setIsProductivityModalOpen] = useState(false);
  const [isBottleneckModalOpen, setIsBottleneckModalOpen] = useState(false);

  useEffect(() => {
    if (lastEvent?.type === "message") {
      setHighlightChat(true);
      const timer = setTimeout(() => setHighlightChat(false), 2000);
      return () => clearTimeout(timer);
    }
    if (lastEvent?.type === "card") {
      setHighlightCRM(true);
      const timer = setTimeout(() => setHighlightCRM(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastEvent]);

  return (
    <div className="h-full flex flex-col min-h-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
      {/* Top Banner & Greetings (Fixed) */}
      <div className="flex-shrink-0 flex flex-col gap-2">
        <h2 className="text-3xl font-black tracking-tight text-white drop-shadow-sm flex items-center gap-3 italic uppercase">
          Cockpit do Operador
          <span className="text-[10px] font-black py-1 px-3 bg-orange-500/10 text-orange-500 rounded-full border border-orange-500/20 tracking-widest">
            LIVE ⚡
          </span>
        </h2>
        <p className="text-sm text-gray-400 font-medium">
          Olá, <span className="text-orange-500 font-bold">{userName}</span>. Sua central de comando está monitorando todas as atividades em tempo real.
        </p>
      </div>

      {/* Action Metrics Cards (Fixed) */}
      <div className="flex-shrink-0 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        
        {/* Widget 1: Produtividade (Ciano) */}
        <div 
          onClick={() => setIsProductivityModalOpen(true)}
          className="rounded-2xl border border-[#ffffff0a] bg-[#111111] p-5 shadow-sm relative overflow-hidden group hover:border-cyan-500/30 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-md flex items-center gap-1">
              Produtividade <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
          <div>
            <p className="text-3xl font-black text-white">{metrics.movimentacoes || 0}</p>
            <p className="text-sm font-medium text-gray-500 mt-1">Movimentações Hoje</p>
          </div>
        </div>

        {/* Widget 2: Atrasados (Vermelho) */}
        <div className="rounded-2xl border border-[#ffffff0a] bg-[#111111] p-5 shadow-sm relative overflow-hidden group hover:border-red-500/30 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-red-500 bg-red-500/10 px-2 py-1 rounded-md">Urgência</span>
          </div>
          <div>
            <p className="text-3xl font-black text-white">{metrics.atrasados || 0}</p>
            <p className="text-sm font-medium text-gray-500 mt-1">Cards Atrasados</p>
          </div>
        </div>

        {/* Widget 3: Para Hoje (Laranja) */}
        <div className="rounded-2xl border border-[#ffffff0a] bg-[#111111] p-5 shadow-sm relative overflow-hidden group hover:border-orange-500/30 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
              <CalendarDays className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-orange-500 bg-orange-500/10 px-2 py-1 rounded-md">Hoje</span>
          </div>
          <div>
            <p className="text-3xl font-black text-white">{metrics.hoje || 0}</p>
            <p className="text-sm font-medium text-gray-500 mt-1">Atividades para Hoje</p>
          </div>
        </div>

        {/* Widget 4: Gargalo Atual (Vermelho Urgência) */}
        <div 
          onClick={() => setIsBottleneckModalOpen(true)}
          className="rounded-2xl border border-[#ffffff0a] bg-[#111111] p-5 shadow-sm relative overflow-hidden group hover:border-red-500/30 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-red-500 bg-red-500/10 px-2 py-1 rounded-md">Gargalo</span>
          </div>
          <div>
            <p className="text-xl font-black text-white truncate">{metrics.gargalo || 'Fluindo'}</p>
            <p className="text-sm font-medium text-gray-500 mt-1">Maior Acúmulo</p>
          </div>
        </div>

      </div>

      {/* Main Interactive Grid (Fluid/Scrolling) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6 pb-2">
        
        {/* Fila de Atendimento Rápida */}
        <div className={`flex flex-col bg-[#111111] border border-[#ffffff0a] rounded-2xl p-6 relative overflow-hidden transition-all ${highlightChat ? 'realtime-glow scale-[1.01]' : ''}`}>
          <div className="flex-shrink-0 flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-orange-500" />
              Fila de Atendimento (WhatsApp)
            </h3>
            <Link href="/cockpit/chat" className="text-xs text-orange-500 hover:underline font-medium">Ver Todos</Link>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar-sidebar pr-1">
            {[
              { name: "Carlos Eduardo", time: "Há 2 min", msg: "Olá, gostaria de saber o valor do plano...", unread: true },
              { name: "Bruno Oliveira", time: "Há 15 min", msg: "Beleza, vou mandar o comprovante.", unread: false },
              { name: "Maria Fernanda", time: "Há 40 min", msg: "Vocês conseguem instalar na segunda?", unread: false },
            ].map((cht, i) => (
              <div key={i} className="flex items-start gap-4 p-3 rounded-xl hover:bg-[#ffffff05] transition-colors border border-transparent hover:border-[#ffffff0a] cursor-pointer">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500/20 to-orange-500/40 flex items-center justify-center text-white font-black text-sm">
                    {cht.name.substring(0, 2).toUpperCase()}
                  </div>
                  {cht.unread && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-[#111111] rounded-full" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <p className={`text-sm truncate ${cht.unread ? 'font-bold text-white' : 'font-medium text-gray-300'}`}>{cht.name}</p>
                    <span className="text-[10px] text-gray-500">{cht.time}</span>
                  </div>
                  <p className={`text-xs truncate ${cht.unread ? 'text-gray-300' : 'text-gray-500'}`}>{cht.msg}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Atividades (Motor de Workflow) */}
        <div className={`flex flex-col bg-[#111111] border border-[#ffffff0a] rounded-2xl p-6 relative overflow-hidden transition-all ${highlightCRM ? 'realtime-glow scale-[1.01]' : ''}`}>
          <div className="flex-shrink-0 flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-500" />
              Atividades
            </h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 bg-[#ffffff05] px-2 py-1 rounded border border-[#ffffff0a]">
               Monitoramento Ativo
            </span>
          </div>
          
          <div className="flex-1 min-h-0">
            <ActivityFeed userId={userId} />
          </div>
        </div>

      </div>

      <ProductivityModal 
        isOpen={isProductivityModalOpen} 
        onClose={() => setIsProductivityModalOpen(false)} 
        userId={userId}
      />
      <BottleneckModal
        isOpen={isBottleneckModalOpen}
        onClose={() => setIsBottleneckModalOpen(false)}
        userId={userId}
      />
    </div>
  )
}
