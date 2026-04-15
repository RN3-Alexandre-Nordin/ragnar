'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useEffect, useTransition } from 'react'
import { Search, Filter, X, Check } from 'lucide-react'

interface SearchFiltersProps {
  initialQuery?: string
  initialStatus?: string
}

export default function SearchFilters({ initialQuery = "", initialStatus = "all" }: SearchFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState(initialStatus)

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query !== initialQuery) {
        handleFilterChange('q', query)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [query])

  const handleFilterChange = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set(name, value)
    } else {
      params.delete(name)
    }
    
    // Reset page if we had pagination (optional, but good practice)
    params.delete('page')

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus)
    handleFilterChange('status', newStatus)
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 items-center">
      {/* Search Input */}
      <div className="relative flex-1 w-full group">
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isPending ? 'text-[#2BAADF] animate-pulse' : 'text-gray-500 group-focus-within:text-[#2BAADF]'}`} />
        <input
          type="text"
          placeholder="Buscar por nome ou CNPJ..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-[#111111] border border-[#ffffff0a] focus:border-[#2BAADF]/50 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-[#2BAADF]/20"
        />
        {query && (
          <button 
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-[#ffffff0a] text-gray-500 transition-all"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Status Filter */}
      <div className="flex items-center bg-[#111111] border border-[#ffffff0a] rounded-xl p-1 w-full md:w-auto self-stretch">
        {[
          { id: 'all', label: 'Todos' },
          { id: 'ativo', label: 'Ativos' },
          { id: 'suspenso', label: 'Suspensos' },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => handleStatusChange(s.id)}
            className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              status === s.id 
                ? 'bg-[#2BAADF]/10 border-[#2BAADF]/30 text-[#2BAADF]' 
                : 'bg-transparent border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
