'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/utils/permissions'
import { getMyProfile } from '@/app/(app)/cockpit/actions'

export async function createLead(formData: FormData) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'leads', 'create')) {
    return { error: 'Sem permissão para criar leads.' }
  }

  const nome = formData.get('nome') as string
  const telefone = formData.get('telefone') as string || null
  const whatsapp = formData.get('whatsapp') as string || null
  const email = formData.get('email') as string || null
  const documento = formData.get('documento') as string || null
  const cargo = formData.get('cargo') as string || null
  const empresa_cliente = formData.get('empresa_cliente') as string || null
  const canal_idInput = formData.get('canal_id') as string
  const canal_id = canal_idInput ? canal_idInput : null
  
  const supabase = await createClient()
  const empresaId = me?.role_global === 'superadmin' ? formData.get('empresa_id') as string : me?.empresa_id ?? ''

  const { error } = await supabase.from('crm_leads').insert([{
    nome, telefone, whatsapp, email, documento, cargo, empresa_cliente, canal_id, 
    empresa_id: empresaId
  }])

  if (error) return { error: error.message }
  
  revalidatePath('/cockpit/crm/leads')
  redirect('/cockpit/crm/leads')
}

export async function updateLead(id: string, formData: FormData) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'leads', 'edit')) {
    return { error: 'Sem permissão para editar leads.' }
  }

  const nome = formData.get('nome') as string
  const telefone = formData.get('telefone') as string || null
  const whatsapp = formData.get('whatsapp') as string || null
  const email = formData.get('email') as string || null
  const documento = formData.get('documento') as string || null
  const cargo = formData.get('cargo') as string || null
  const empresa_cliente = formData.get('empresa_cliente') as string || null
  const canal_idInput = formData.get('canal_id') as string
  const canal_id = canal_idInput ? canal_idInput : null
  
  const supabase = await createClient()

  let query = supabase.from('crm_leads').update({
    nome, telefone, whatsapp, email, documento, cargo, empresa_cliente, canal_id
  }).eq('id', id)

  if (me?.role_global !== 'superadmin') {
    query = query.eq('empresa_id', me?.empresa_id ?? '')
  }

  const { error } = await query

  if (error) return { error: error.message }
  
  revalidatePath('/cockpit/crm/leads')
  redirect('/cockpit/crm/leads')
}

export async function deleteLead(formData: FormData) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'leads', 'delete')) {
    console.error('Ação negada: Sem permissão para excluir leads.');
    return;
  }

  const id = formData.get('id') as string
  const supabase = await createClient()
  
  let query = supabase.from('crm_leads').delete().eq('id', id)
  if (me?.role_global !== 'superadmin') {
    query = query.eq('empresa_id', me?.empresa_id ?? '')
  }

  const { error } = await query
  if (error) {
    console.error('Erro ao excluir lead:', error.message);
    return;
  }

  // Cleanup revalidations
  revalidatePath('/cockpit/crm/leads')
  redirect('/cockpit/crm/leads')
}
