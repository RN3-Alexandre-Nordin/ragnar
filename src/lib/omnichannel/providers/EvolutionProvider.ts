import { RagnarMessage, BaseProvider, ProviderConfig, WebhookResult, RagnarEvent } from '@/types/omnichannel';

export class EvolutionProvider implements BaseProvider {
  /**
   * Envia uma mensagem de texto simples via Evolution API
   */
  async sendMessage(to: string, content: string, config: ProviderConfig): Promise<{ success: boolean; messageId?: string; error?: any }> {
    const baseUrl = config.settings?.apiUrl || process.env.EVOLUTION_API_URL || 'https://evo.supa.rn3.tec.br';
    const apiKey = config.provider_token || process.env.EVOLUTION_API_KEY;
    const instance = config.provider_id;

    if (!instance || !apiKey) {
      return { success: false, error: 'Configuração da Evolution API incompleta (Instance ou API Key ausente)' };
    }

    try {
      const response = await fetch(`${baseUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({
          number: to,
          options: {
            delay: 1200,
            presence: 'composing',
            linkPreview: false
          },
          text: content
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data };
      }

      return { success: true, messageId: data.key?.id };
    } catch (error) {
      console.error('Erro ao enviar mensagem via Evolution:', error);
      return { success: false, error };
    }
  }

  /**
   * Converte o payload bruto do webhook da Evolution para RagnarMessage ou RagnarEvent
   */
  parseWebhook(payload: any): WebhookResult {
    // 1. Tratamento de Mudança de Status da Conexão
    if (payload.event?.toLowerCase() === 'connection.update') {
      const state = payload.data?.state;
      let ragnarStatus: 'connected' | 'disconnected' | 'pairing' = 'disconnected';

      if (state === 'open' || state === 'connected') ragnarStatus = 'connected';
      if (state === 'connecting' || state === 'pairing') ragnarStatus = 'pairing';
      if (state === 'close' || state === 'refused') ragnarStatus = 'disconnected';

      return {
        event: 'status_update',
        provider: 'evolution',
        provider_id: payload.instance || '',
        status: ragnarStatus,
        metadata: { raw: payload.data }
      } as RagnarEvent;
    }

    // 2. Tratamento de Recebimento de Mensagem
    if (payload.event?.toLowerCase() === 'messages.upsert') {
      const data = payload.data;
      if (!data || data.key?.fromMe) return null; // Ignora mensagens enviadas por nós mesmos

      const senderPhone = data.key.remoteJid.split('@')[0];
      const messageContent = data.message?.conversation || 
                            data.message?.extendedTextMessage?.text || 
                            data.message?.imageMessage?.caption || '';

      // Determinando o tipo de mensagem simplificado
      let type: any = 'text';
      if (data.message?.imageMessage) type = 'image';
      if (data.message?.videoMessage) type = 'video';
      if (data.message?.audioMessage) type = 'audio';
      if (data.message?.documentMessage) type = 'document';

      return {
        id: data.key.id,
        provider: 'evolution',
        provider_id: payload.instance || '', // instance name
        empresa_id: '', // Será preenchido pelo serviço de roteamento ao consultar o banco
        sender_id: senderPhone,
        sender_name: data.pushName || 'WhatsApp User',
        content: messageContent,
        type: type,
        created_at: new Date(data.messageTimestamp * 1000),
        direction: 'inbound',
        metadata: {
          raw: data,
          instance: payload.instance
        }
      } as RagnarMessage;
    }

    return null;
  }
}
