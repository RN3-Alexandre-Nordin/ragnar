'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { CalendarDays, Clock, X } from 'lucide-react'

export default function KanbanFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [prazoDe, setPrazoDe] = useState(searchParams.get('prazo_de') || '')
  const [prazoAte, setPrazoAte] = useState(searchParams.get('prazo_ate') || '')
  const [stageDe, setStageDe] = useState(searchParams.get('stage_de') || '')
  const [stageAte, setStageAte] = useState(searchParams.get('stage_ate') || '')
  const [meusCards, setMeusCards] = useState(searchParams.get('meus_cards') === 'true')
  const [mostrarFinalizados, setMostrarFinalizados] = useState(searchParams.get('finalizados') === 'true')

  const hasFilter = prazoDe || prazoAte || stageDe || stageAte || meusCards || mostrarFinalizados

  const applyFilters = useCallback((overrides: Record<string, string> = {}) => {
    const params = new URLSearchParams()
    const vals = {
      prazo_de: prazoDe,
      prazo_ate: prazoAte,
      stage_de: stageDe,
      stage_ate: stageAte,
      meus_cards: meusCards ? 'true' : '',
      finalizados: mostrarFinalizados ? 'true' : '',
      ...overrides,
    }
    Object.entries(vals).forEach(([k, v]) => { if (v) params.set(k, v) })
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [prazoDe, prazoAte, stageDe, stageAte, meusCards, mostrarFinalizados, router])

  const clearFilters = () => {
    setPrazoDe(''); setPrazoAte(''); setStageDe(''); setStageAte(''); setMeusCards(false); setMostrarFinalizados(false)
    router.replace('?', { scroll: false })
  }

  const inputCls = "bg-[#0A0A0A] border border-[#ffffff12] text-white text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-[#2BAADF]/50 transition-all w-36 [color-scheme:dark]"
  const labelCls = "text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap"

  return (
    <div className="flex flex-wrap items-center gap-4 bg-[#111111] border border-[#ffffff0a] rounded-xl px-4 py-2.5">
      
      {/* Filtro 1: Data de Entrega (data_prazo) */}
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-amber-500 shrink-0" />
        <span className={labelCls}>Prazo:</span>
        <input
          type="date"
          value={prazoDe}
          className={inputCls}
          onChange={e => { setPrazoDe(e.target.value); }}
          onBlur={() => applyFilters({ prazo_de: prazoDe })}
        />
        <span className="text-gray-600 text-xs">até</span>
        <input
          type="date"
          value={prazoAte}
          className={inputCls}
          onChange={e => setPrazoAte(e.target.value)}
          onBlur={() => applyFilters({ prazo_ate: prazoAte })}
        />
      </div>

      <div className="h-5 w-px bg-[#ffffff08]" />

      {/* Filtro 2: Entrou no Estágio (stage_entered_at) */}
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-[#2BAADF] shrink-0" />
        <span className={labelCls}>Entrou no Estágio:</span>
        <input
          type="date"
          value={stageDe}
          className={inputCls}
          onChange={e => setStageDe(e.target.value)}
          onBlur={() => applyFilters({ stage_de: stageDe })}
        />
        <span className="text-gray-600 text-xs">até</span>
        <input
          type="date"
          value={stageAte}
          className={inputCls}
          onChange={e => setStageAte(e.target.value)}
          onBlur={() => applyFilters({ stage_ate: stageAte })}
        />
      </div>

      <div className="h-5 w-px bg-[#ffffff08]" />
      
      {/* Filtro 3: Meus Cards */}
      <button 
        type="button"
        onClick={() => {
          const next = !meusCards;
          setMeusCards(next);
          applyFilters({ meus_cards: next ? 'true' : '' });
        }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all select-none ${
          meusCards 
            ? 'bg-[#2BAADF]/10 border-[#2BAADF]/30 text-[#2BAADF]' 
            : 'bg-[#ffffff03] border-[#ffffff0a] text-gray-500 hover:text-gray-400 hover:bg-[#ffffff05]'
        }`}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${meusCards ? 'bg-[#2BAADF] shadow-[0_0_8px_#2BAADF]' : 'bg-gray-600'}`} />
        <span className="text-[10px] font-black uppercase tracking-widest">Meus Cards</span>
      </button>

      {/* Filtro 4: Ver Finalizados */}
      <button 
        type="button"
        onClick={() => {
          const next = !mostrarFinalizados;
          setMostrarFinalizados(next);
          applyFilters({ finalizados: next ? 'true' : '' });
        }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all select-none ${
          mostrarFinalizados 
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' 
            : 'bg-[#ffffff03] border-[#ffffff0a] text-gray-500 hover:text-gray-400 hover:bg-[#ffffff05]'
        }`}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${mostrarFinalizados ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 'bg-gray-600'}`} />
        <span className="text-[10px] font-black uppercase tracking-widest">Exibir Finalizados</span>
      </button>

      {hasFilter && (
        <>
          <div className="h-5 w-px bg-[#ffffff08]" />
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5"
          >
            <X className="w-3 h-3" />
            Limpar Filtros
          </button>
        </>
      )}
    </div>
  )
}
