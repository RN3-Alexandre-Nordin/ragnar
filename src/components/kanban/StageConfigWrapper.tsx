'use client'

import React, { useState } from 'react'
import StageConfigModal from './StageConfigModal'

interface StageConfigWrapperProps {
  pipelineId: string
  initialStages: any[]
  grupos: any[]
  autoOpen?: boolean
}

export default function StageConfigWrapper({ pipelineId, initialStages, grupos, autoOpen = false }: StageConfigWrapperProps) {
  const [isOpen, setIsOpen] = useState(autoOpen)

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-gradient-to-r from-[#2BAADF]/20 to-[#1A8FBF]/20 border border-[#2BAADF]/50 hover:bg-[#2BAADF] hover:text-white text-[#2BAADF] px-4 py-2 rounded-lg text-sm font-bold shadow-[0_0_15px_rgba(43,170,223,0.3)] hover:shadow-[0_0_25px_rgba(43,170,223,0.6)] transition-all flex items-center gap-2"
      >
        Configurar Estágios
      </button>

      {isOpen && (
        <StageConfigModal 
          onClose={() => setIsOpen(false)}
          pipelineId={pipelineId}
          initialStages={initialStages}
          grupos={grupos}
        />
      )}
    </>
  )
}
