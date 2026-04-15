'use client'

import { Shield, CheckCircle2 } from 'lucide-react'
import { PERMISSION_CATEGORIES, PermissionModule } from '@/constants/permissions'

// Categorias movidas para @/constants/permissions.ts

interface PermissionsMatrixProps {
  value: Record<string, string[]>
  onChange: (value: Record<string, string[]>) => void
  disabled?: boolean
}

export default function PermissionsMatrix({ value, onChange, disabled }: PermissionsMatrixProps) {
  const togglePermission = (moduleSlug: string, actionSlug: string) => {
    const currentActions = value[moduleSlug] || []
    let newActions: string[]

    if (currentActions.includes(actionSlug)) {
      newActions = currentActions.filter(a => a !== actionSlug)
    } else {
      newActions = [...currentActions, actionSlug]
    }

    const newValue = { ...value }
    if (newActions.length === 0) {
      delete newValue[moduleSlug]
    } else {
      newValue[moduleSlug] = newActions
    }
    
    onChange(newValue)
  }

  const toggleAllModule = (moduleSlug: string, allActions: string[]) => {
    const currentActions = value[moduleSlug] || []
    const isAllSelected = allActions.every(a => currentActions.includes(a))
    
    const newValue = { ...value }
    if (isAllSelected) {
      delete newValue[moduleSlug]
    } else {
      newValue[moduleSlug] = allActions
    }
    onChange(newValue)
  }

  const toggleAllCategory = (modules: PermissionModule[]) => {
    const allSelected = modules.every(mod => {
      const allSlugs = mod.actions.map(a => a.slug)
      const current = value[mod.slug] || []
      return allSlugs.every(s => current.includes(s))
    })

    const newValue = { ...value }
    if (allSelected) {
      modules.forEach(mod => delete newValue[mod.slug])
    } else {
      modules.forEach(mod => {
        newValue[mod.slug] = mod.actions.map(a => a.slug)
      })
    }
    onChange(newValue)
  }

  return (
    <div className={`space-y-6 ${disabled ? 'opacity-60 pointer-events-none select-none' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-4 h-4 text-[#2BAADF]" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Matriz de Permissões</h3>
      </div>
      
      {PERMISSION_CATEGORIES.map((category) => {
        const allCategorySelected = category.modules.every(mod => {
          const allSlugs = mod.actions.map(a => a.slug)
          const current = value[mod.slug] || []
          return allSlugs.every(s => current.includes(s))
        })
        const anyCategorySelected = category.modules.some(mod => (value[mod.slug] || []).length > 0)

        return (
          <div key={category.label} className="space-y-3">
            {/* Category Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-1 h-4 rounded-full"
                  style={{ background: category.color }}
                />
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: category.color }}>
                  {category.label}
                </span>
                {anyCategorySelected && (
                  <span className="text-[10px] text-gray-500 font-medium">
                    ({category.modules.filter(m => (value[m.slug] || []).length > 0).length}/{category.modules.length} módulos ativos)
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => toggleAllCategory(category.modules)}
                disabled={disabled}
                className={`text-[10px] uppercase font-bold tracking-widest transition-colors ${
                  allCategorySelected 
                    ? 'text-[#2BAADF]' 
                    : 'text-gray-600 hover:text-white'
                } disabled:cursor-not-allowed`}
              >
                {allCategorySelected ? 'Desmarcar Categoria' : 'Marcar Tudo'}
              </button>
            </div>

            {/* Modules in Category */}
            <div className="grid grid-cols-1 gap-3">
              {category.modules.map((module) => {
                const currentActions = value[module.slug] || []
                const allActionSlugs = module.actions.map(a => a.slug)
                const isAllSelected = allActionSlugs.every(a => currentActions.includes(a))

                return (
                  <div
                    key={module.slug}
                    className="bg-[#0A0A0A] border border-[#ffffff0a] rounded-2xl p-4 hover:border-[#ffffff12] transition-all"
                  >
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#ffffff05]">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${currentActions.length > 0 ? 'bg-[#2BAADF]' : 'bg-gray-800'}`} />
                        <span className="text-sm font-semibold text-white">{module.label}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleAllModule(module.slug, allActionSlugs)}
                        disabled={disabled}
                        className={`text-[10px] uppercase font-bold tracking-widest transition-colors ${
                          isAllSelected ? 'text-[#2BAADF]' : 'text-gray-600 hover:text-white'
                        } disabled:cursor-not-allowed`}
                      >
                        {isAllSelected ? 'Desmarcar Tudo' : 'Marcar Tudo'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {module.actions.map((action) => {
                        const isSelected = currentActions.includes(action.slug)
                        return (
                          <button
                            key={action.slug}
                            type="button"
                            onClick={() => togglePermission(module.slug, action.slug)}
                            disabled={disabled}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                              isSelected
                                ? 'bg-[#2BAADF]/10 border-[#2BAADF]/30 text-[#2BAADF] shadow-[0_0_15px_rgba(43,170,223,0.1)]'
                                : 'bg-[#050505] border-[#ffffff0a] text-gray-500 hover:border-[#ffffff14] hover:text-gray-300'
                            } disabled:cursor-not-allowed`}
                          >
                            <action.icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#2BAADF]' : 'text-gray-600'}`} />
                            {action.label}
                            {isSelected && <CheckCircle2 className="w-3 h-3 ml-auto text-[#2BAADF]" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
