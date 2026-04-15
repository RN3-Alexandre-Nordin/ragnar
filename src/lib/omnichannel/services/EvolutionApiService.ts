import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente manualmente se estivermos em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
}

export class EvolutionApiService {
  /**
   * Resolve a URL base: usa a passada na chamada ou a do .env se existir.
   */
  private static getBaseUrl(customUrl?: string) {
     return customUrl || process.env.WHATSAPP_API_URL || 'https://evo.supa.rn3.tec.br';
  }

  /**
   * Resolve a API Key: usa a passada na chamada ou a do .env se existir.
   */
  private static getApiKey(customKey?: string) {
     const key = customKey || process.env.WHATSAPP_API_TOKEN;
     if (!key) throw new Error('API Key da Evolution não fornecida (WHATSAPP_API_TOKEN).');
     return key;
  }

  /**
   * Cria uma nova instância na Evolution API (WHATSAPP-BAILEYS).
   * Retorna o objeto completo da resposta, incluindo o base64 do QR Code.
   */
  static async createInstance(instanceName: string, customUrl?: string, customKey?: string, options: { token?: string; number?: string } = {}) {
    const baseUrl = this.getBaseUrl(customUrl);
    const apiKey = this.getApiKey(customKey);

    // Schema exato conforme especificação técnica.
    // Campos opcionais (token, number) são incluídos APENAS se tiverem valor
    // para evitar erros de validação de schema da API.
    const webhookUrl = process.env.RAGNAR_WEBHOOK_URL || process.env.NEXT_PUBLIC_WEBHOOK_URL || 'https://ragnar.supa.rn3.tec.br/api/webhooks/evolution';
    console.log(`[EvolutionApiService] Criando instância com webhook: ${webhookUrl} (Env: ${process.env.NODE_ENV})`);

    const body: Record<string, unknown> = {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      webhook: {
        enabled: true,
        url: webhookUrl,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'SEND_MESSAGE',
          'CONNECTION_UPDATE',
          'PRESENCE_UPDATE',
          'CHATS_UPSERT',
          'CONTACTS_UPSERT',
        ],
      },
      reject_call: true,
      msg_call: 'Olá! Este número é automatizado e não recebe chamadas. Por favor, envie sua dúvida por texto.',
      groups_ignore: true,
      always_online: true,
      read_messages: false,
      read_status: false,
      sync_full_history: false,
    };

    if (options.token) body.token = options.token;
    if (options.number) body.number = options.number;

    const response = await fetch(`${baseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        (Array.isArray(data?.response?.message) ? data.response.message[0] : null)
        || data?.response?.message
        || data?.message
        || data?.error
        || JSON.stringify(data);
      throw new Error(`Evolution API (${response.status}): ${errorMsg}`);
    }

    return data;
  }

  /**
   * Define configurações de comportamento da instância (Always Online, Reject Call, etc).
   */
  static async setInstanceSettings(instanceName: string, settings: any, customUrl?: string, customKey?: string) {
    const baseUrl = this.getBaseUrl(customUrl);
    const apiKey = this.getApiKey(customKey);

    const response = await fetch(`${baseUrl}/settings/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify(settings)
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Erro ao definir settings na Evolution API:', data);
      return { success: false, error: data };
    }

    return { success: true, data };
  }

  /**
   * Registra a URL do Webhook do Ragnar na instância Evolution.
   */
  static async registerWebhook(instanceName: string, webhookUrl: string, customUrl?: string, customKey?: string) {
    const baseUrl = this.getBaseUrl(customUrl);
    const apiKey = this.getApiKey(customKey);

    const response = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        url: webhookUrl,
        enabled: true,
        // Habilitamos eventos de conexão e mensagens para garantir sync total
        events: [
          "CONNECTION_UPDATE",
          "MESSAGES_UPSERT"
        ]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Erro ao registrar webhook na Evolution API:', data);
      return { success: false, error: data };
    }

    return { success: true, data };
  }

  /**
   * Busca o QR Code atual da instância.
   */
  static async getQRCode(instanceName: string, customUrl?: string, customKey?: string) {
    const baseUrl = this.getBaseUrl(customUrl);
    const apiKey = this.getApiKey(customKey);

    const response = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey
      }
    });

    const data = await response.json();
    if (!response.ok) return null;

    return data.base64;
  }

  /**
   * Remove uma instância da Evolution API.
   */
  static async logoutInstance(instanceName: string, customUrl?: string, customKey?: string) {
    const baseUrl = this.getBaseUrl(customUrl);
    const apiKey = this.getApiKey(customKey);

    console.log(`[EvolutionApiService] Solicitando exclusão da instância: ${instanceName}`);

    try {
      const response = await fetch(`${baseUrl}/instance/delete/${instanceName}`, {
        method: 'DELETE',
        headers: {
          'apikey': apiKey
        }
      });

      if (response.ok) {
        console.log(`[EvolutionApiService] Instância ${instanceName} removida com sucesso do provedor.`);
      } else {
        const data = await response.json().catch(() => ({}));
        console.warn(`[EvolutionApiService] Resposta do provedor ao deletar (status ${response.status}):`, data);
      }
    } catch (e) {
      console.error('[EvolutionApiService] Erro de rede ao tentar deletar instância:', e);
    }
  }

  /**
   * Verifica o status da conexão da instância.
   */
  static async getConnectionStatus(instanceName: string, customUrl?: string, customKey?: string) {
    const baseUrl = this.getBaseUrl(customUrl);
    const apiKey = this.getApiKey(customKey);

    const response = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey
      }
    });

    if (!response.ok) return 'disconnected';

    const data = await response.json();
    return data.instance.state;
  }
}
