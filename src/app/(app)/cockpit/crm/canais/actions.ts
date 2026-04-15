'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/utils/permissions'
import { getMyProfile } from '@/app/(app)/cockpit/actions'

export async function createCanal(formData: FormData) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'canais', 'create')) {
    return { error: 'Sem permissão para criar canais.' }
  }

  const nome = formData.get('nome') as string
  const tipo = formData.get('tipo') as string
  const instancia_nome = formData.get('instancia_nome') as string
  
  // Extração de configurações específicas
  const config = {
    evolution: {
      url: formData.get('evolution_url') as string,
      apikey: formData.get('evolution_apikey') as string,
    },
    meta: {
      token: formData.get('meta_token') as string,
      business_id: formData.get('meta_business_id') as string,
      phone_id: formData.get('meta_phone_id') as string,
      verify_token: formData.get('meta_verify_token') as string,
    }
  }

  const supabase = await createClient()
  const empresaId = me?.role_global === 'superadmin' ? formData.get('empresa_id') as string : me?.empresa_id ?? ''

  const { error } = await supabase.from('crm_canais').insert([{
    nome, 
    tipo, 
    instancia_nome,
    configuracoes: config,
    empresa_id: empresaId,
    status: 'inactive'
  }])

  if (error) return { error: error.message }
  
  revalidatePath('/cockpit/crm/canais')
  redirect('/cockpit/crm/canais')
}

export async function updateCanal(id: string, formData: FormData) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'canais', 'edit')) {
    return { error: 'Sem permissão para editar canais.' }
  }

  const nome = formData.get('nome') as string
  const tipo = formData.get('tipo') as string
  const instancia_nome = formData.get('instancia_nome') as string

  const config = {
    evolution: {
      url: formData.get('evolution_url') as string,
      apikey: formData.get('evolution_apikey') as string,
    },
    meta: {
      token: formData.get('meta_token') as string,
      business_id: formData.get('meta_business_id') as string,
      phone_id: formData.get('meta_phone_id') as string,
      verify_token: formData.get('meta_verify_token') as string,
    }
  }
  
  const supabase = await createClient()
  let builder = supabase.from('crm_canais').update({ 
    nome, 
    tipo, 
    instancia_nome,
    configuracoes: config 
  }).eq('id', id)

  if (me?.role_global !== 'superadmin') {
    builder = builder.eq('empresa_id', me?.empresa_id ?? '')
  }

  const { error } = await builder

  if (error) return { error: error.message }
  
  revalidatePath('/cockpit/crm/canais')
  redirect('/cockpit/crm/canais')
}

export async function getWhatsAppQRCode(canalId: string) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'canais', 'view')) {
    return { error: 'Sem permissão para visualizar QR Code de canais.' }
  }

  const supabase = await createClient()
  let builder = supabase.from('crm_canais').select('*').eq('id', canalId)
  
  if (me?.role_global !== 'superadmin') {
    builder = builder.eq('empresa_id', me?.empresa_id ?? '')
  }

  const { data: canal, error: dbError } = await builder.single()

  if (dbError || !canal || canal.tipo !== 'whatsapp' || !canal.configuracoes?.evolution?.url) {
    return { error: 'Configuração Evolution não encontrada ou acesso negado' }
  }

  const { url, apikey } = canal.configuracoes.evolution
  const instancia = canal.instancia_nome

  try {
    const response = await fetch(`${url}/instance/connect/${instancia}`, {
      headers: { 'apikey': apikey }
    })
    const data = await response.json()
    // A Evolution API costuma retornar o base64 do QR code
    return { qrcode: data.base64 || data.code || null }
  } catch (err) {
    return { error: 'Falha ao conectar com a API Evolution' }
  }
}

export async function deleteCanal(formData: FormData) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'canais', 'delete')) {
    console.error('Ação negada: Sem permissão para excluir canais.');
    return;
  }

  const id = formData.get('id') as string
  const supabase = await createClient()
  
  let builder = supabase.from('crm_canais').delete().eq('id', id)
  if (me?.role_global !== 'superadmin') {
    builder = builder.eq('empresa_id', me?.empresa_id ?? '')
  }

  const { error } = await builder
  if (error) {
    console.error('Erro ao excluir canal:', error.message);
    return;
  }
  
  revalidatePath('/cockpit/crm/canais')
  redirect('/cockpit/crm/canais')
}
