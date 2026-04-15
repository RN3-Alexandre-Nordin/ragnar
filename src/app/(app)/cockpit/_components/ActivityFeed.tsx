"use client";

import { Clock, AlertTriangle, Edit2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useWorkflowActivity } from "@/hooks/useWorkflowActivity";
import { formatDistanceToNow, isPast, isToday, parseISO, isBefore, startOfToday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ActivityFeedProps {
  userId: string;
}

export default function ActivityFeed({ userId }: ActivityFeedProps) {
  const { activities, isLoading, isSynced } = useWorkflowActivity(userId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
        <div className="space-y-4">
           {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-[#ffffff05] rounded-2xl border border-[#ffffff0a]" />)}
        </div>
        <div className="space-y-4">
           {[1, 2].map((i) => <div key={i} className="h-20 bg-[#ffffff05] rounded-2xl border border-[#ffffff0a]" />)}
        </div>
      </div>
    );
  }

  // 🔥 Lógica de Filtro Sincronizada com SQL (data_prazo < current_date)
  // Utilizamos a comparação de objetos Date Locais para respeitar o fuso brasileiro.
  const todayAtMidnight = startOfToday();

  const overdue = activities
    .filter((a) => {
      if (!a.data_prazo) return false;
      const deadline = parseISO(a.data_prazo);
      return isBefore(deadline, todayAtMidnight);
    })

    .sort((a, b) => new Date(a.data_prazo).getTime() - new Date(b.data_prazo).getTime());

  const today = activities
    .filter((a) => {
      if (!a.data_prazo) return false;
      return isToday(parseISO(a.data_prazo));
    })
    .sort((a, b) => new Date(a.data_prazo).getTime() - new Date(b.data_prazo).getTime());





  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-[#ffffff02] border border-dashed border-[#ffffff0a] rounded-3xl">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mb-6 border border-green-500/20 shadow-lg shadow-green-500/5">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <p className="text-base font-black text-white uppercase tracking-tighter">Fluxo totalmente limpo</p>
        <p className="text-[11px] text-gray-500 mt-2 font-medium">Você concluiu todas as pendências para este período!</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 space-y-6">
      {/* 🟢 Status Bar / Header (Fixo) */}
      <div className="flex-shrink-0 flex items-center justify-between px-1 bg-[#111111] z-10 pb-2">
         <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isSynced ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-600'}`} />
            <span className="text-[9px] font-black uppercase text-gray-500 tracking-[0.2em]">
               {isSynced ? 'Sincronizado em Tempo Real' : 'Conectando ao Channel...'}
            </span>
         </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* 🔴 COLUNA 1: ATRASADOS */}
        <div className="h-full flex flex-col min-h-0">
           {/* Header da Coluna (Sticky) */}
           <div className="flex-shrink-0 flex items-center justify-between pb-3 border-b border-[#ffffff0a] mb-4 bg-[#111111] sticky top-0 z-20">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]" />
                 <h4 className="text-[11px] font-black uppercase tracking-widest text-red-500">🔴 Atrasados</h4>
              </div>
              <span className="text-[10px] font-bold text-gray-600 bg-[#ffffff05] px-2 py-0.5 rounded-full">{overdue.length}</span>
           </div>
           
           {/* Container de Scroll Localizado (Expansível) */}
           <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar-activity scrollbar-thin scrollbar-thumb-red-500/50 scrollbar-track-transparent">
             {overdue.length > 0 ? (
                overdue.map((card) => <ActivityRow key={card.id} card={card} isOverdue={true} />)
             ) : (
                <div className="py-12 border border-dashed border-[#ffffff05] rounded-3xl flex flex-col items-center justify-center opacity-30 grayscale shrink-0">
                   <CheckCircle2 className="w-8 h-8 mb-2" />
                   <p className="text-[10px] uppercase font-black">Sem atrasos críticos</p>
                </div>
             )}
           </div>
        </div>

        {/* 🟠 COLUNA 2: ATIVIDADES DO DIA */}
        <div className="h-full flex flex-col min-h-0">
           {/* Header da Coluna (Sticky) */}
           <div className="flex-shrink-0 flex items-center justify-between pb-3 border-b border-[#ffffff0a] mb-4 bg-[#111111] sticky top-0 z-20">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]" />
                 <h4 className="text-[11px] font-black uppercase tracking-widest text-orange-500">🟠 Hoje</h4>
              </div>
              <span className="text-[10px] font-bold text-gray-600 bg-[#ffffff05] px-2 py-0.5 rounded-full">{today.length}</span>
           </div>

           {/* Container de Scroll Localizado (Expansível) */}
           <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar-activity scrollbar-thin scrollbar-thumb-orange-500/50 scrollbar-track-transparent">
             {today.length > 0 ? (
                today.map((card) => <ActivityRow key={card.id} card={card} isOverdue={false} />)
             ) : (
                <div className="py-12 border border-dashed border-[#ffffff05] rounded-3xl flex flex-col items-center justify-center opacity-30 grayscale shrink-0">
                   <Clock className="w-8 h-8 mb-2" />
                   <p className="text-[10px] uppercase font-black">Agenda do dia limpa</p>
                </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ card, isOverdue }: { card: any, isOverdue: boolean }) {
  const deadline = parseISO(card.data_prazo);
  const isActuallyPast = isPast(deadline);
  
  // Texto amigável de tempo
  const timeText = isOverdue 
    ? `Atrasado há ${formatDistanceToNow(deadline, { locale: ptBR })}`
    : `Vence Hoje • ${deadline.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ${isActuallyPast ? '(Vencido)' : ''}`;

  return (
    <div className="shrink-0 group relative flex items-center justify-between p-4 rounded-2xl bg-[#ffffff03] hover:bg-[#ffffff08] border border-[#ffffff05] hover:border-[#2BAADF]/30 transition-all duration-300">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-1.5 flex items-center gap-1.5">
           <span className="truncate max-w-[100px] inline-block">{card.pipelines?.nome || 'Operação'}</span>
           <span className="text-gray-800">›</span> 
           <span className="text-gray-500 truncate max-w-[120px] inline-block">{card.pipeline_stages?.nome || 'Etapa'}</span>
        </p>
        
        <h5 className="text-[13px] font-bold text-white truncate group-hover:text-[#2BAADF] transition-colors leading-snug">
          {card.titulo}
        </h5>
        
        <div className="flex items-center gap-3 mt-2.5">
           <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-tighter border ${isOverdue ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}`}>
              {timeText}
           </span>
           <span className="text-[9px] text-gray-700 font-bold uppercase tracking-widest">Workflow Ativo</span>
        </div>
      </div>

      <Link 
        href={`/cockpit/crm/funis/${card.pipeline_id}?cardId=${card.id}`}
        className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#ffffff05] hover:bg-[#2BAADF] text-gray-500 hover:text-white border border-[#ffffff10] hover:border-[#2BAADF] transition-all shadow-lg active:scale-95 group/btn"
        title="Visualizar Card"
      >
        <Edit2 className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
      </Link>
    </div>
  );
}
