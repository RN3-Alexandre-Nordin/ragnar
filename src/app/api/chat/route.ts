import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const { prompt, cardId } = await req.json();
    const supabase = await createClient();

    // 1. Identificar usuário e empresa
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: perfil } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('auth_user_id', user.id)
      .single();

    if (!perfil) {
      return NextResponse.json({ error: "Perfil de usuário não encontrado" }, { status: 404 });
    }

    // 2. Buscar configurações da organização (tabela empresas)
    const { data: empresa } = await supabase
      .from('empresas')
      .select('gemini_api_key, ai_model, ai_context_prompt')
      .eq('id', perfil.empresa_id)
      .single();

    if (!empresa?.gemini_api_key) {
      return NextResponse.json({ 
        error: "Sua empresa ainda não configurou uma API Key do Gemini nas configurações." 
      }, { status: 400 });
    }
    
    // 3. RECUPERARAÇÃO DE CONTEXTO (RAG - Semantic Search)
    const genAI = new GoogleGenerativeAI(empresa.gemini_api_key);
    
    // Gerar embedding da pergunta do usuário
    const embedModel = genAI.getGenerativeModel({ 
      model: "models/gemini-embedding-001" 
    }, { apiVersion: 'v1beta' });
    
    const embeddingResponse = await embedModel.embedContent(prompt);
    const queryEmbedding = embeddingResponse.embedding.values;

    // Busca semântica via RPC (Aumentando match_count para 10 conforme solicitado)
    const { data: kbContext, error: kbError } = await supabase.rpc('match_knowledge_base', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 10,
      org_id: perfil.empresa_id
    });

    if (kbError) console.error("Erro na busca semântica:", kbError);

    const extraContext = kbContext?.length 
      ? kbContext.map((c: any) => `[FONTE: ${c.file_name || 'Geral'}]: ${c.content}`).join('\n---\n') 
      : "Nenhuma informação específica encontrada na base de conhecimento.";

    // 4. Inicializar Gemini para resposta (v1beta + gemini-2.5-flash)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash"
    }, { apiVersion: 'v1beta' });

    // 5. Montagem do Prompt de Sistema (PRIORIDADE RAG NO TOPO)
    const systemPersonality = (empresa.ai_context_prompt || "Você é a Mônica, assistente da Monte Sinai.").replace(/%22/g, '"').trim();
    
    const ragnarInstructions = `
      --- INSTRUÇÕES CRÍTICAS DE PRIORIDADE (RAG) ---
      1. VOCÊ DEVE CONSULTAR OS "DADOS DA BASE DE CONHECIMENTO" ABAIXO PARA QUALQUER PERGUNTA SOBRE PRODUTOS, PREÇOS, REGRAS OU FAQ.
      2. ESTA BASE É A ÚNICA FONTE DE VERDADE. SE A RESPOSTA ESTIVER LÁ, USE-A EXCLUSIVAMENTE.
      3. SE A INFORMAÇÃO NÃO ESTIVER NA BASE, RESPONDA COM EDUCAÇÃO E DIGA QUE IRÁ VERIFICAR, MAS NÃO TENTE INVENTAR PREÇOS OU REGRAS.
      
      --- DADOS DA BASE DE CONHECIMENTO (FONTE ÚNICA) ---
      ${extraContext}
      -----------------------------------------------

      PERSONALIDADE E DIRETRIZES:
      - ${systemPersonality}
      - Ao final da resposta, se identificar progresso na negociação, inclua obrigatoriamente um bloco oculto no formato:
        [STATUS_CRM: NOVO_LEAD | EM_QUALIFICACAO | INTERESSADO | APROVACAO | PEDIDO | GANHO | PERDIDO]
      - Baseie o status no progresso desta conversa específica.
    `;

    const fullPrompt = `${ragnarInstructions}\n\nPergunta do Cliente: ${prompt.trim()}`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    let text = response.text();

    // 6. INTERCEPTAÇÃO E GESTÃO DE TAGS CRM
    const statusMatch = text.match(/\[STATUS_CRM:\s*(.*?)\]/i);
    if (statusMatch && cardId) {
      const suggestedStatus = statusMatch[1].trim().toUpperCase();
      console.log(`[CRM TAG] Status detectado: ${suggestedStatus} para o Card: ${cardId}`);

      // Mapeamento simples de tags para IDs de etapas conhecidas
      const stageMap: Record<string, string> = {
        'NOVO_LEAD': '51107160-6030-42de-b25b-23cdcc5a70d0', // Prospecção
        'PROSPECCAO': '51107160-6030-42de-b25b-23cdcc5a70d0',
        'APROVACAO': 'cd16c7c7-f630-4a9a-bed6-1c6947bd968d', // Aprovação
        'INTERESSADO': 'cd16c7c7-f630-4a9a-bed6-1c6947bd968d', // Mapear para Aprovação ou similar
        'GANHO': '39363b20-7452-4d1e-bdd5-b986d96137ed',    // Aprovados
        'PEDIDO': 'b5f8582a-7c72-425b-ae20-46a74f4566b1',    // Pedidos
        'PERDIDO': '7f3136d8-c88c-42c9-a2d7-4cb4fe6c04b6',   // Não Aprovados
      };

      const newStageId = stageMap[suggestedStatus];
      if (newStageId) {
        await supabase
          .from('crm_cards')
          .update({ stage_id: newStageId, stage_entered_at: new Date().toISOString() })
          .eq('id', cardId);
        console.log(`[CRM TAG] Card ${cardId} movido para etapa ${newStageId}`);
      }
    }

    // 7. LIMPEZA FINAL DO TEXTO (Remover QUALQUER tag entre colchetes [...])
    const cleanedText = text.replace(/\[.*?\]/g, '').trim();

    return NextResponse.json({ response: cleanedText });
  } catch (error: any) {
    console.error("Erro na API de Chat:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
