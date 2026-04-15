import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { EvolutionProvider } from '@/lib/omnichannel/providers/EvolutionProvider';
import { TriageService } from '@/lib/omnichannel/TriageService';
import { AiResponseService } from '@/lib/omnichannel/services/AiResponseService';
import { RagnarMessage } from '@/types/omnichannel';

export async function POST(request: Request) {
  try {
    let rawBody = await request.json();
    
    // ATENÇÃO: A Evolution API por vezes envia o body como uma string JSON dupla (escapada)
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    
    console.log("Mensagem recebida da Evolution:", JSON.stringify(body, null, 2));

    // ATENÇÃO: Webhooks não possuem cookies de sessão. 
    // Usamos a Service Role Key para contornar o RLS e acessar a tabela crm_canais.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Validar se é um evento de mensagem
    const event = body.event?.toLowerCase();
    if (event !== 'messages.upsert') {
      return NextResponse.json({ status: 'ignored', reason: 'Evento não processado nesta rota' });
    }

    const instanceName = body.instance;
    const data = body.data;

    if (!instanceName || !data || data.key?.fromMe) {
      return NextResponse.json({ status: 'ignored', reason: 'Payload inválido ou mensagem enviada por nós' });
    }

    // 2. Validar canal/instância no banco
    const { data: canal, error: canalError } = await supabase
      .from('crm_canais')
      .select('id, empresa_id, ia_config, settings')
      .eq('provider_id', instanceName)
      .eq('provider', 'evolution')
      .single();

    if (canalError || !canal) {
      console.error(`Canal não configurado ou inativo para instância: ${instanceName}`);
      return NextResponse.json({ error: 'Instância não autorizada' }, { status: 403 });
    }

    // 3. Normalizar a mensagem usando o Provedor
    const provider = new EvolutionProvider();
    const parsed = provider.parseWebhook(body);

    if (!parsed || !('content' in parsed)) {
      return NextResponse.json({ status: 'ignored', reason: 'Não foi possível parsear a mensagem' });
    }

    const msg = parsed as RagnarMessage;
    msg.empresa_id = canal.empresa_id;

    // 4. Lógica de Leads (Busca ou Criação)
    const { data: existingLead } = await supabase
      .from('crm_leads')
      .select('id')
      .eq('empresa_id', canal.empresa_id)
      .eq('telefone', msg.sender_id)
      .single();

    let leadId = existingLead?.id;
    if (!leadId) {
      const { data: newLead, error: insertError } = await supabase
        .from('crm_leads')
        .insert([{
          empresa_id: canal.empresa_id,
          nome: msg.sender_name || 'Usuário WhatsApp',
          telefone: msg.sender_id,
          whatsapp: msg.sender_id,
          canal_id: canal.id
        }])
        .select('id')
        .single();
      
      if (insertError) {
        console.error("[Webhook] Erro ao criar novo Lead:", insertError);
      }
      leadId = newLead?.id;
    }

    // 5. Atualizar Estado da Conversiva e Triagem
    const conversaId = await TriageService.updateConversaState(msg, canal.id, supabase, leadId);
    const shouldRespond = await TriageService.shouldAiRespond(msg, canal.id, supabase);

    // 6. Salvar Interação em crm_interacoes
    const { error: interacaoError } = await supabase.from('crm_interacoes').insert({
      empresa_id: canal.empresa_id,
      lead_id: leadId,
      conversa_id: conversaId,
      contact_phone: msg.sender_id,
      contact_name: msg.sender_name || 'Usuário WhatsApp',
      role: 'user',
      content: msg.content,
      // Se provider suportar, força timestamp original, senão DB põe genérico
      created_at: msg.created_at ? new Date(msg.created_at).toISOString() : new Date().toISOString(),
      metadata: { 
        provider: 'evolution',
        instance: instanceName,
        ai_triage: shouldRespond,
        provider_message_id: msg.id,
        timestamp: msg.created_at,
        type: msg.type
      }
    });

    if (interacaoError) {
      console.error("[Webhook] Erro CRÍTICO ao salvar crm_interacoes:", interacaoError);
    }

    // 7. Lógica de Resposta da IA (Modo Automático)
    if (shouldRespond && canal.ia_config?.ativo) {
      console.log(`[Webhook Evolution] Disparando IA para lead ${leadId} no canal ${canal.id}`);
      
      // Passamos o lead_id e conversa_id no metadata para o serviço de IA
      msg.metadata = { 
        ...msg.metadata, 
        lead_id: leadId, 
        conversa_id: conversaId 
      };

      // Executamos de forma assíncrona (não travamos o webhook)
      AiResponseService.processAutoResponse(msg, canal.id).catch(err => {
        console.error("[Webhook Evolution] Erro no processamento da IA:", err);
      });
    }

    return NextResponse.json({ status: 'SUCCESS' });
  } catch (error: any) {
    console.error("[Webhook Evolution] Erro crítico:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
