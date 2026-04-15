'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { X, Plus, Trash2, Check, Shield, ChevronUp, ChevronDown } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { saveStageConfig } from '@/app/(app)/cockpit/crm/actions'

interface Stage {
  id?: string
  nome: string
  cor: string
  ordem: number
  sla_dias?: number | null
  tempKey?: string
}

interface Group {
  id: string
  nome: string
}

export default function StageConfigModal({ onClose, pipelineId, initialStages, grupos }: { onClose: () => void, pipelineId: string, initialStages: Stage[], grupos: Group[] }) {
  const [stages, setStages] = useState<Stage[]>([])
  const [stageGroupMap, setStageGroupMap] = useState<Record<string, string[]>>({})
  const [loadingMap, setLoadingMap] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Load standard groups of stages
  useEffect(() => {
    // initialize local states
    const localStages = initialStages.map(s => ({...s}))
    if (localStages.length === 0) {
       localStages.push({ nome: 'NOVA COLUNA', cor: '#ffffff', ordem: 0 })
    }
    setStages(localStages)

    async function loadGroupsMap() {
       const supabase = createClient()
       const { data } = await supabase.from('pipeline_stage_grupo_acesso').select('stage_id, grupo_id')
       if (data) {
          const mapping: Record<string, string[]> = {}
          data.forEach(row => {
             if (!mapping[row.stage_id]) mapping[row.stage_id] = []
             mapping[row.stage_id].push(row.grupo_id)
          })
          setStageGroupMap(mapping)
       }
       setLoadingMap(false)
    }
    loadGroupsMap()
  }, [initialStages])

  const addStage = () => {
    const tempKey = `new_${Date.now()}` // Stable temporary key
    const firstStageKey = stages.length > 0 ? (stages[0].id || stages[0].tempKey) : null
    const inheritedGroups = firstStageKey ? (stageGroupMap[firstStageKey!] || []) : []
    
    setStageGroupMap(prev => ({ ...prev, [tempKey]: [...inheritedGroups] }))
    setStages([...stages, { nome: 'NOVO ESTÁGIO', cor: '#2BAADF', ordem: stages.length, tempKey }])
  }

  const reorderStages = (list: Stage[]) => {
    return list.map((s, i) => ({ ...s, ordem: i }))
  }

  const removeStage = (index: number) => {
    const list = [...stages]
    list.splice(index, 1)
    setStages(reorderStages(list))
  }

  const moveStage = (index: number, direction: 'up' | 'down') => {
    const newList = [...stages]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    
    if (targetIndex < 0 || targetIndex >= newList.length) return

    const [removed] = newList.splice(index, 1)
    newList.splice(targetIndex, 0, removed)
    
    setStages(reorderStages(newList))
  }

  const handleUpdate = (index: number, field: keyof Stage, val: any) => {
    const list = [...stages]
    list[index] = { ...list[index], [field]: val }
    setStages(list)
  }

  const toggleGroup = (stageId: string | undefined, index: number, grupoId: string) => {
    const key = stageId || `new_${index}` // temporary key if stage is new
    const current = stageGroupMap[key] || []
    
    const nextMap = { ...stageGroupMap }
    if (current.includes(grupoId)) {
       nextMap[key] = current.filter(id => id !== grupoId)
    } else {
       nextMap[key] = [...current, grupoId]
    }
    setStageGroupMap(nextMap)
  }

  const handleSave = () => {
    startTransition(async () => {
       await saveStageConfig(pipelineId, stages, stageGroupMap)
       onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111111] border border-[#ffffff10] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#ffffff05] shrink-0">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
               Configurar Colunas e Herdamento de Permissões
            </h3>
            <p className="text-sm text-gray-400 mt-1">Defina a ordem, cores e grupos. O campo <span className="text-[#2BAADF] font-semibold">Dias</span> define o SLA do estágio — prazo automático calculado ao criar/mover um card.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#ffffff05] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
           {loadingMap ? (
              <div className="text-center text-gray-400 py-10">Montando matriz de segurança...</div>
           ) : (
              <div className="space-y-4">
                  {stages.map((stage, i) => {
                    const tempKey = stage.id || stage.tempKey || `legacy_${i}`
                    const allowedGroups = stageGroupMap[tempKey] || []

                    return (
                      <div key={tempKey} className="bg-[#0A0A0A] border border-[#ffffff10] rounded-xl p-4 space-y-4 relative group">
                        <div className="flex items-center gap-3">
                           {/* Controles de Ordem */}
                           <div className="flex flex-col gap-1 shrink-0">
                             <button 
                               onClick={() => moveStage(i, 'up')}
                               disabled={i === 0}
                               className="p-1 hover:bg-[#ffffff10] rounded disabled:opacity-20 text-gray-400 transition-colors"
                             >
                               <ChevronUp className="w-4 h-4" />
                             </button>
                             <button 
                               onClick={() => moveStage(i, 'down')}
                               disabled={i === stages.length - 1}
                               className="p-1 hover:bg-[#ffffff10] rounded disabled:opacity-20 text-gray-400 transition-colors"
                             >
                               <ChevronDown className="w-4 h-4" />
                             </button>
                           </div>

                           <input 
                             type="color" 
                             value={stage.cor}
                             onChange={(e) => handleUpdate(i, 'cor', e.target.value)}
                             className="w-8 h-8 rounded shrink-0 cursor-pointer bg-transparent border-0 p-0"
                           />
                           <input
                             type="text"
                             value={stage.nome}
                             onChange={(e) => handleUpdate(i, 'nome', e.target.value)}
                             className="bg-transparent border-b border-[#ffffff20] text-white font-bold w-full focus:border-[#2BAADF] outline-none py-1"
                             placeholder="Nome da etapa"
                           />
                           <div className="flex items-center gap-1.5 shrink-0" title="SLA: dias para concluir tasks neste estágio">
                             <input
                               type="number"
                               min="0"
                               max="365"
                               value={stage.sla_dias ?? ''}
                               onChange={(e) => handleUpdate(i, 'sla_dias', e.target.value === '' ? null : Number(e.target.value))}
                               className="w-16 bg-transparent border-b border-[#ffffff20] text-[#2BAADF] font-bold focus:border-[#2BAADF] outline-none py-1 text-center text-sm"
                               placeholder="—"
                             />
                             <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">dias</span>
                           </div>
                           <button onClick={() => removeStage(i)} className="p-2 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                        
                        {/* Grupos Vinculados Exclusivamente a este Bucket */}
                        <div className="pl-11 pr-2">
                           <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                              <Shield className="w-3.5 h-3.5 text-[#2BAADF]" /> Grupos de Acesso
                           </div>
                           <div className="flex flex-wrap gap-2">
                              {grupos.map(g => {
                                 const isAllowed = allowedGroups.includes(g.id)
                                 return (
                                    <button
                                      key={g.id}
                                      onClick={() => toggleGroup(stage.id || stage.tempKey, i, g.id)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
                                        isAllowed 
                                          ? 'bg-[#2BAADF]/10 border-[#2BAADF]/30 text-[#2BAADF]' 
                                          : 'bg-transparent border-[#ffffff10] text-gray-500 hover:text-gray-300'
                                      }`}
                                    >
                                      {isAllowed && <Check className="w-3 h-3" />}
                                      {g.nome}
                                    </button>
                                 )
                              })}
                           </div>
                           {allowedGroups.length === 0 && (
                              <p className="text-[10px] text-orange-500/80 mt-2">Atenção: Apenas Superadmins e Admins poderão ver este estágio.</p>
                           )}
                        </div>
                      </div>
                    )
                 })}

                 <button onClick={addStage} className="w-full py-3 border border-dashed border-[#ffffff20] hover:border-[#2BAADF]/50 text-gray-400 hover:text-[#2BAADF] rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all">
                    <Plus className="w-4 h-4" /> Adicionar Estágio
                 </button>
              </div>
           )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#ffffff05] bg-[#0A0A0A] shrink-0 flex justify-end gap-3">
           <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-300 hover:text-white transition-colors">Cancelar</button>
           <button 
             onClick={handleSave} 
             disabled={isPending}
             className="px-6 py-2.5 bg-gradient-to-r from-[#2BAADF] to-[#1A8FBF] hover:shadow-[0_4px_24px_rgba(43,170,223,0.35)] text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
           >
             {isPending ? 'Salvando matriz...' : 'Salvar Alterações'}
           </button>
        </div>
      </div>
    </div>
  )
}
