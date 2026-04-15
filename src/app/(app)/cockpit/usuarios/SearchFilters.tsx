'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useEffect, useTransition } from 'react'
import { Search, Building2, X } from 'lucide-react'

interface Company {
  id: string
  nome: string
}

interface SearchFiltersProps {
  initialQuery?: string
  initialEmpresa?: string
  companies: Company[]
  showCompanyFilter: boolean
}

export default function SearchFilters({ 
  initialQuery = "", 
  initialEmpresa = "all", 
  companies, 
  showCompanyFilter 
}: SearchFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const [query, setQuery] = useState(initialQuery)
  const [empresa, setEmpresa] = useState(initialEmpresa)

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
    
    params.delete('page')

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const handleEmpresaChange = (newEmpresa: string) => {
    setEmpresa(newEmpresa)
    handleFilterChange('empresa', newEmpresa)
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 items-center">
      {/* Search Input */}
      <div className="relative flex-1 w-full group">
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isPending ? 'text-[#2BAADF] animate-pulse' : 'text-gray-500 group-focus-within:text-[#2BAADF]'}`} />
        <input
          type="text"
          placeholder="Buscar por nome ou e-mail..."
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

      {/* Company Filter (SuperAdmin only) */}
      {showCompanyFilter && (
        <div className="relative w-full md:w-64 group">
          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-[#2BAADF]" />
          <select
            value={empresa}
            onChange={(e) => handleEmpresaChange(e.target.value)}
            className="w-full bg-[#111111] border border-[#ffffff0a] focus:border-[#2BAADF]/50 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="all">Todas as Empresas</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}
