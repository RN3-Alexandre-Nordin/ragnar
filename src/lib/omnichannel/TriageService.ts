import { createClient } from '@/utils/supabase/server';
import { RagnarMessage } from '@/types/omnichannel';

export class TriageService {
  /**
   * Decide se a IA deve responder a uma mensagem recebida.
   * Regra: Status deve ser 'ai' e não houve intervenção humana recente (timeout configurável).
   */
  static async shouldAiRespond(message: RagnarMessage, canalId: string, supabase: any): Promise<boolean> {
    const { data: conversa, error } = await supabase
      .from('crm_conversas')
      .select(`
        status, 
        last_human_interaction, 
        last_message,
        empresas (
          ia_silence_timeout
        )
      `)
      .eq('empresa_id', message.empresa_id)
      .eq('canal_id', canalId) 
      .eq('external_id', message.sender_id)
      .single();

    if (error || !conversa) {
      // Se a conversa não existe, por padrão a IA pode iniciar (primeiro contato)
      return true;
    }

    // 2. Se o status for 'human', a IA não deve interferir
    if (conversa.status === 'human') {
      return false;
    }

    // 3. Se o status for 'closed', a IA pode reabrir
    if (conversa.status === 'closed') {
      return true;
    }

    // 4. Verificação de Time-out de Silêncio IA (Trava Automática)
    // Se houve interação humana, respeitamos o timeout da empresa (default 60min)
    if (conversa.last_human_interaction) {
      const lastInteraction = new Date(conversa.last_human_interaction).getTime();
      const now = Date.now();
      const diffInMinutes = (now - lastInteraction) / (1000 * 60);

      // Usamos o timeout da empresa ou fallback para 60
      const timeout = (conversa.empresas as any)?.ia_silence_timeout ?? 60;

      if (diffInMinutes < timeout) {
        console.log(`[Triage] Silêncio IA ativo: ${diffInMinutes.toFixed(1)}m / ${timeout}m`);
        return false;
      }
    }
    
    return conversa.status === 'ai';
  }

  static async updateConversaState(message: RagnarMessage, canalId: string, supabase: any, leadId?: string): Promise<string | null> {
    const updateData: any = {
      empresa_id: message.empresa_id,
      canal_id: canalId,
      external_id: message.sender_id,
      last_message: message.content,
      updated_at: new Date()
    };

    if (leadId) {
      updateData.lead_id = leadId;
    }

    if (message.direction === 'outbound' && !message.metadata?.is_ai) {
      updateData.last_human_interaction = new Date();
      updateData.status = 'human'; // Assume o controle ao falar humanamente
    }

    const { data, error } = await supabase
      .from('crm_conversas')
      .upsert(updateData, { onConflict: 'canal_id, external_id' })
      .select('id')
      .single();

    if (error) {
      console.error("[Triage] Erro ao atualizar estado da conversa:", error);
      return null;
    }

    return data?.id;
  }
}
