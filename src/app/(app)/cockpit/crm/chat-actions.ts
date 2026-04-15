'use server'

import { createClient } from '@/utils/supabase/server'
import { getMyProfile } from '@/app/(app)/cockpit/actions'
import { hasPermission } from '@/utils/permissions'
import { revalidatePath } from 'next/cache'

export async function sendChatMessage(content: string, context_type: 'global' | 'card' | 'direct', context_id?: string, related_card_id?: string) {
  const me = await getMyProfile()
  if (!me) return { error: 'Não autenticado' }
  
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('chat_messages')
    .insert([{
      empresa_id: me.empresa_id,
      sender_id: me.id,
      content,
      context_type,
      context_id: context_id || null,
      related_card_id: related_card_id || null
    }])
    .select('*, usuarios(nome_completo)')
    .single()

  if (error) return { error: error.message }
  
  return { data }
}

export async function getChatMessages(context_type: 'global' | 'card' | 'direct', context_id?: string, related_card_id?: string) {
  const me = await getMyProfile()
  if (!me) return { error: 'Não autenticado' }
  
  const supabase = await createClient()

  let query = supabase
    .from('chat_messages')
    .select(`
      *,
      usuarios (
        id,
        nome_completo
      ),
      crm_cards (
        id,
        titulo
      )
    `)
    .eq('empresa_id', me.empresa_id)
    .order('created_at', { ascending: true })

  if (context_type === 'direct' && context_id) {
    // Busca mensagens trocadas entre os dois participantes
    query = query
      .eq('context_type', 'direct')
      .or(`and(sender_id.eq.${me.id},context_id.eq.${context_id}),and(sender_id.eq.${context_id},context_id.eq.${me.id})`)
    
    if (related_card_id) {
      query = query.eq('related_card_id', related_card_id)
    }
  } else if (context_type === 'global') {
    // No contexto global, mostramos mensagens globais E as de contexto de card da empresa
    query = query.in('context_type', ['global', 'card'])
  } else {
    query = query.eq('context_type', context_type)
    if (context_id) {
      query = query.eq('context_id', context_id)
    }
  }

  const { data, error } = await query

  if (error) return { error: error.message }
  return { data }
}

/**
 * Busca o feed global de chat, incluindo mensagens globais 
 * e menções/mensagens de cards relevantes.
 */
export async function getGlobalChatFeed() {
  const me = await getMyProfile()
  if (!me) return { error: 'Não autenticado' }
  
  const supabase = await createClient()

  // Para o feed global, buscamos mensagens 'global' 
  // Opcionalmente podemos buscar onde o usuário foi mencionado (futura feature)
  const { data, error } = await supabase
    .from('chat_messages')
    .select(`
      *,
      usuarios!inner(id, nome_completo)
    `)
    .eq('empresa_id', me.empresa_id)
    // Mostramos Global OU Card (se quiser feed unificado)
    // Seguindo o pedido: "No Chat Principal: Mostre todas as mensagens 'global' e as mensagens de 'card' onde o usuário foi mencionado"
    // Por enquanto, traremos Global e Card context para visualização unificada
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) return { error: error.message }
  return { data }
}

export async function getRecentConversations() {
  const me = await getMyProfile()
  if (!me) return { error: 'Não autenticado' }
  
  const supabase = await createClient()

  // 1. Buscar TODOS os usuários da empresa (DMs em potencial)
  const { data: companyUsers } = await supabase
    .from('usuarios')
    .select('id, nome_completo')
    .eq('empresa_id', me.empresa_id)
    .neq('id', me.id)
  
  const convMap = new Map<string, any>()

  companyUsers?.forEach(user => {
    convMap.set(`direct:${user.id}`, {
      type: 'direct',
      id: user.id,
      name: user.nome_completo,
      lastMessage: '',
      lastMessageAt: new Date(0).toISOString(),
      unreadCount: 0
    })
  })

  // 2. Buscar marcadores de leitura
  const { data: markers } = await supabase
    .from('chat_read_markers')
    .select('*')
    .eq('usuario_id', me.id)

  const markerMap = new Map(markers?.map(m => [`${m.context_type}:${m.context_id}`, new Date(m.last_read_at).getTime()]) || [])

  // 3. Buscar TODAS as mensagens para identificar relevância
  const { data: rawMessages, error: msgError } = await supabase
    .from('chat_messages')
    .select(`
      id,
      content,
      created_at,
      context_type,
      context_id,
      sender_id,
      usuarios(nome_completo)
    `)
    .eq('empresa_id', me.empresa_id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (msgError) return { error: msgError.message }

  const myMentionText = `[${me.nome_completo}]`
  const relevantCardIds = new Set<string>()

  // Identificar cards relevantes
  rawMessages?.forEach(msg => {
    if (msg.context_type === 'card' && msg.context_id) {
       const isParticipant = msg.sender_id === me.id
       const isMentioned = msg.content.includes(myMentionText)
       if (isParticipant || isMentioned) {
          relevantCardIds.add(msg.context_id)
       }
    }
  })

  // 4. Buscar os títulos dos cards relevantes para garantir o nome correto
  const { data: cardTitles } = await supabase
    .from('crm_cards')
    .select('id, titulo')
    .in('id', Array.from(relevantCardIds))

  const cardTitleMap = new Map(cardTitles?.map(c => [c.id, c.titulo]) || [])

  // 5. Montar o convMap final
  rawMessages?.forEach(msg => {
    let cid = msg.context_id
    if (msg.context_type === 'direct') {
       cid = msg.sender_id === me.id ? msg.context_id : msg.sender_id
    }
    
    if (!cid || msg.context_type === 'global') return

    const key = `${msg.context_type}:${cid}`
    
    // Validar Relevância
    let isRelevant = msg.context_type === 'direct'
    if (msg.context_type === 'card') {
       isRelevant = relevantCardIds.has(cid)
    }

    if (isRelevant) {
       if (!convMap.has(key)) {
          convMap.set(key, {
            type: msg.context_type,
            id: cid,
            name: msg.context_type === 'card' ? cardTitleMap.get(cid) : (msg.usuarios as any)?.nome_completo,
            lastMessage: msg.content,
            lastMessageAt: msg.created_at,
            unreadCount: 0
          })
       } else {
          const conv = convMap.get(key)
          // Se for um card pré-existente sem título, colocar o título agora
          if (msg.context_type === 'card' && !conv.name) {
             conv.name = cardTitleMap.get(cid)
          }
          if (new Date(msg.created_at) > new Date(conv.lastMessageAt)) {
             conv.lastMessage = msg.content
             conv.lastMessageAt = msg.created_at
          }
       }

       // Unread Count
       const lastRead = markerMap.get(key) || 0
       if (new Date(msg.created_at).getTime() > lastRead && msg.sender_id !== me.id) {
          convMap.get(key).unreadCount++
       }
    }
  })

  // Ordenar e retornar
  const sorted = Array.from(convMap.values())
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())

  return { data: sorted }
}

export async function searchAllConversations(query: string) {
  const me = await getMyProfile()
  if (!me) return { error: 'Não autenticado' }
  
  const supabase = await createClient()
  const q = query.toLowerCase()

  // Buscar Usuários
  const { data: users } = await supabase
    .from('usuarios')
    .select('id, nome_completo, email')
    .eq('empresa_id', me.empresa_id)
    .neq('id', me.id)
    .or(`nome_completo.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(5)

  // Buscar Cards
  const { data: cards } = await supabase
    .from('crm_cards')
    .select('id, titulo')
    .eq('empresa_id', me.empresa_id)
    .ilike('titulo', `%${q}%`)
    .limit(10)

  const results: any[] = [
    ...(users?.map(u => ({ type: 'direct', id: u.id, name: u.nome_completo, lastMessage: u.email })) || []),
    ...(cards?.map(c => ({ type: 'card', id: c.id, name: c.titulo, lastMessage: 'Card do CRM' })) || [])
  ]

  return { data: results }
}

export async function markChatAsRead(contextType: string, contextId: string) {
  const me = await getMyProfile()
  if (!me) return { error: 'Não autenticado' }
  
  const supabase = await createClient()
  const cid = contextId || 'global'

  const { error } = await supabase
    .from('chat_read_markers')
    .upsert({
      usuario_id: me.id,
      context_type: contextType,
      context_id: cid,
      last_read_at: new Date().toISOString()
    }, { onConflict: 'usuario_id,context_type,context_id' })

  if (error) return { error: error.message }
  return { success: true }
}

export async function getCompanyUsers() {
  const me = await getMyProfile()
  if (!me) return { error: 'Não autenticado' }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome_completo, email')
    .eq('empresa_id', me.empresa_id)
    .order('nome_completo')

  if (error) return { error: error.message }
  return { data }
}
