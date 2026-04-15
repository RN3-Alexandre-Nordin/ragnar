'use server'

import { createClient } from '@/utils/supabase/server'
import { getMyProfile } from '@/app/(app)/cockpit/actions'
import { EvolutionProvider } from '@/lib/omnichannel/providers/EvolutionProvider'
import { ProviderConfig } from '@/types/omnichannel'

export async function sendOmniMessage(conversaId: string, content: string) {
  try {
    const me = await getMyProfile()
    if (!me) throw new Error('Usuário não autenticado')

    const supabase = await createClient()

    // 1. Buscar Detalhes da Conversa, Canal e Lead
    const { data: conversa, error: convError } = await supabase
      .from('crm_conversas')
      .select(`
        *,
        crm_canais (*),
        crm_leads (*)
      `)
      .eq('id', conversaId)
      .single()

    if (convError || !conversa) throw new Error('Conversa não encontrada')
    if (!conversa.crm_canais) throw new Error('Canal de comunicação não configurado')
    if (!conversa.crm_leads) throw new Error('Lead não identificado na conversa')

    const canal = conversa.crm_canais
    const lead = conversa.crm_leads
    const provider = new EvolutionProvider()

    const config: ProviderConfig = {
      provider: canal.provider || 'evolution',
      provider_id: canal.provider_id,
      provider_token: canal.token,
      settings: canal.settings as any
    }

    console.log(`[Omni] Iniciando processo para Conversa: ${conversaId}`)

    // 2. Salvar Interação no Banco (Prioridade 1)
    console.log(`[Omni] Salvando no Supabase: Empresa=${me.empresa_id}, Lead=${lead.id}, Conversa=${conversaId}`)
    
    const { data: insertedMsg, error: insertError } = await supabase
      .from('crm_interacoes')
      .insert({
        empresa_id: me.empresa_id,
        conversa_id: conversaId,
        lead_id: lead.id,
        user_id: me.id,
        contact_phone: lead.telefone,
        contact_name: lead.nome || 'Cliente WhatsApp',
        content: content,
        role: 'assistant',
        metadata: {
          sent_by: me.id,
          status: 'sent_manual'
        }
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Omni] ERRO NO INSERT:', JSON.stringify(insertError, null, 2))
      return { success: false, error: `Erro no Banco (RLS ou Schema): ${insertError.message}` }
    }
    console.log('[Omni] Sucesso: Mensagem gravada no banco (ID:', insertedMsg.id, ')')

    // 3. Atualizar Estado da Conversa e Pausar IA (Prioridade 2)
    const { error: updateError } = await supabase
      .from('crm_conversas')
      .update({
        status: 'human',
        last_message: content,
        last_human_interaction: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversaId)

    if (updateError) console.error('[Omni] Erro ao atualizar conversa:', updateError)

    // 4. Disparar via Provider (WhatsApp)
    console.log(`[Omni] Tentando envio via WhatsApp para: ${conversa.external_id}`)
    const result = await provider.sendMessage(conversa.external_id, content, config)

    if (result.success) {
      // Atualiza o registro com o ID da mensagem do WhatsApp
      await supabase
        .from('crm_interacoes')
        .update({ 
          metadata: { 
            ...insertedMsg.metadata, 
            provider_message_id: result.messageId,
            status: 'sent' 
          } 
        })
        .eq('id', insertedMsg.id)
      
      console.log('[Omni] Sucesso total: Banco e WhatsApp OK')
      return { success: true, messageId: result.messageId }
    } else {
      console.error('[Omni] Erro no WhatsApp, mas banco está OK:', result.error)
      // Marca a mensagem no banco como falha de envio
      await supabase
        .from('crm_interacoes')
        .update({ metadata: { ...insertedMsg.metadata, status: 'error', provider_error: result.error } })
        .eq('id', insertedMsg.id)
        
      return { success: false, error: 'Gravado no banco, mas falhou ao enviar para o WhatsApp: ' + JSON.stringify(result.error) }
    }

  } catch (error: any) {
    console.error('[OmniActions] Erro ao enviar mensagem:', error)
    return { success: false, error: error.message }
  }
}
