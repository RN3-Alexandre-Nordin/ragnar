'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'

interface Option {
  id: string
  nome: string
}

interface SearchableSelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  name: string
  required?: boolean
  disabled?: boolean
  icon?: any
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione uma opção...",
  name,
  required = false,
  disabled = false,
  icon: Icon
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.id === value)
  
  const filteredOptions = options.filter(opt =>
    opt.nome.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Hidden input for form submission */}
      <input 
        type="hidden" 
        name={name} 
        value={value} 
        required={required}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-[#0A0A0A] border border-[#ffffff12] focus:border-[#2BAADF] rounded-xl px-4 py-2.5 text-sm text-left flex items-center justify-between transition-all outline-none focus:ring-1 focus:ring-[#2BAADF]/30 shadow-inner group ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {Icon && <Icon className="w-4 h-4 text-gray-500 shrink-0" />}
          <span className={`truncate ${selectedOption ? 'text-white' : 'text-gray-500'}`}>
            {selectedOption ? selectedOption.nome : placeholder}
          </span>
        </div>
        <ChevronsUpDown className="w-4 h-4 text-gray-500 shrink-0 group-hover:text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-[#111111] border border-[#ffffff12] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
          <div className="p-2 border-b border-[#ffffff08] flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-500 shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Pesquisar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-white outline-none placeholder-gray-600 py-1"
            />
            {searchQuery && (
              <button 
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 hover:bg-[#ffffff0a] rounded text-gray-500 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id)
                    setIsOpen(false)
                    setSearchQuery('')
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between hover:bg-[#2BAADF]/10 transition-colors ${value === opt.id ? 'bg-[#2BAADF]/5 text-[#2BAADF]' : 'text-gray-400 hover:text-white'}`}
                >
                  <span className="truncate">{opt.nome}</span>
                  {value === opt.id && <Check className="w-4 h-4" />}
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-gray-500">Nenhum resultado encontrado.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
