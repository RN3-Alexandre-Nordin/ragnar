import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { RagnarMessage, ProviderConfig } from '@/types/omnichannel';
import { EvolutionProvider } from '../providers/EvolutionProvider';
import { TriageService } from '../TriageService';

export class AiResponseService {
  /**
   * Processa uma resposta automática para uma mensagem recebida.
   */
  static async processAutoResponse(message: RagnarMessage, canalId: string) {
    const supabase = await createClient();

    try {
      // 1. Buscar configurações da empresa
      const { data: empresa, error: empresaError } = await supabase
        .from('empresas')
        .select('id, gemini_api_key, ai_model, ai_context_prompt, ia_silence_timeout')
        .eq('id', message.empresa_id)
        .single();

      if (empresaError || !empresa?.gemini_api_key) {
        console.error(`[AiResponse] Erro ao buscar config da empresa ou API Key ausente: ${message.empresa_id}`);
        return;
      }

      // 2. RECUPERAÇÃO DE CONTEXTO (RAG)
      const genAI = new GoogleGenerativeAI(empresa.gemini_api_key);
      
      // Embedding da pergunta do usuário
      const embedModel = genAI.getGenerativeModel({ 
        model: "models/gemini-embedding-001" 
      }, { apiVersion: 'v1beta' });
      
      const embeddingResponse = await embedModel.embedContent(message.content);
      const queryEmbedding = embeddingResponse.embedding.values;

      // Busca semântica
      const { data: kbContext, error: kbError } = await supabase.rpc('match_knowledge_base', {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 5, // Ajustado para auto-atendimento
        org_id: empresa.id
      });

      if (kbError) console.error("[AiResponse] Erro na busca semântica:", kbError);

      const extraContext = kbContext?.length 
        ? kbContext.map((c: any) => `[FONTE: ${c.file_name || 'Geral'}]: ${c.content}`).join('\n---\n') 
        : "Nenhuma informação específica encontrada na base de conhecimento.";

      // 3. Gerar Resposta com Gemini
      const aiModel = empresa.ai_model || "gemini-2.0-flash"; // Fallback se vazio
      const model = genAI.getGenerativeModel({ 
        model: aiModel
      }, { apiVersion: 'v1beta' });

      const systemPersonality = (empresa.ai_context_prompt || "Você é um assistente virtual prestativo.").replace(/%22/g, '"').trim();
      
      const ragnarInstructions = `
        --- INSTRUÇÕES DE PRIORIDADE (BASE DE CONHECIMENTO) ---
        1. Use os dados abaixo para responder o cliente. Eles são sua única fonte de verdade técnica.
        2. Se a informação não estiver na base, responda educadamente que irá verificar com um humano.
        
        --- DADOS DA BASE DE CONHECIMENTO ---
        ${extraContext}
        -----------------------------------------------

        DIRETRIZES:
        - ${systemPersonality}
        - Responda de forma curta e natural, como se fosse um atendente no WhatsApp.
        - Não use formatações complexas que o WhatsApp não suporte bem.
      `;

      const result = await model.generateContent(`${ragnarInstructions}\n\nCliente: ${message.content}`);
      const response = await result.response;
      const aiText = response.text().trim();

      // 4. Enviar Resposta via Evolution
      // Precisamos da config do canal para o token e instance
      const { data: canal } = await supabase
        .from('crm_canais')
        .select('*')
        .eq('id', canalId)
        .single();

      if (!canal) {
        console.error(`[AiResponse] Canal não encontrado: ${canalId}`);
        return;
      }

      const provider = new EvolutionProvider();
      const providerConfig: ProviderConfig = {
        provider: 'evolution',
        provider_id: canal.provider_id, // instance name
        provider_token: canal.provider_token,
        settings: canal.settings
      };

      const sendResult = await provider.sendMessage(message.sender_id, aiText, providerConfig);

      if (sendResult.success) {
        // 5. Salvar Interação da IA
        await supabase.from('crm_interacoes').insert({
          empresa_id: empresa.id,
          lead_id: message.metadata?.lead_id, // Passar o lead_id se disponível
          conversa_id: message.metadata?.conversa_id,
          contact_phone: message.sender_id,
          role: 'assistant',
          content: aiText,
          metadata: { 
            is_ai: true,
            model: aiModel,
            provider_message_id: sendResult.messageId
          }
        });

        // 6. Atualizar estado da conversa (opcional, para marcar ultima interação)
        await TriageService.updateConversaState({
          ...message,
          content: aiText,
          direction: 'outbound',
          metadata: { is_ai: true }
        }, canalId, supabase);
      } else {
        console.error(`[AiResponse] Erro ao enviar mensagem:`, sendResult.error);
      }

    } catch (error) {
      console.error("[AiResponse] Erro crítico no processamento da IA:", error);
    }
  }
}
