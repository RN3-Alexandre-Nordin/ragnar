import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { EvolutionApiService } from '@/lib/omnichannel/services/EvolutionApiService';

/**
 * POST /api/channels/create
 * Orquestra a criação de canais omnichannel usando credenciais SEGURAS do servidor (.env).
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  // 1. Obter perfil do usuário logado
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('usuarios')
    .select('empresa_id')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });

  try {
    const { nome, tipo, provider } = await request.json();

    // SEGURANÇA: Ignoramos apiUrl/apiToken vindos do body.
    // Usamos exclusivamente o que está no servidor.
    const serverApiUrl = process.env.WHATSAPP_API_URL;
    const serverApiToken = process.env.WHATSAPP_API_TOKEN;

    if (!nome || !provider) {
      return NextResponse.json({ error: 'Nome e Provider são obrigatórios' }, { status: 400 });
    }

    if (!serverApiUrl || !serverApiToken) {
       return NextResponse.json({ error: 'Servidor não configurado para conexões omnichannel (WHATSAPP_API_URL/TOKEN ausentes).' }, { status: 500 });
    }

    // 2. Gerar nome de instância único baseado no nome digitado pelo usuário
    const normalizedName = nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9]/g, '_')     // Substitui caracteres especiais por _
      .substring(0, 30);              // Limita o tamanho inicial
    
    const shortId = Math.random().toString(36).substring(7);
    const instanceName = `${normalizedName}_${shortId}`;

    let qrCodeBase64 = null;

    // 3. Orquestração Baseada no Provedor (Usando Credenciais Seguras)
    if (provider === 'evolution') {
      const createResponse: any = await EvolutionApiService.createInstance(instanceName, serverApiUrl, serverApiToken);
      
      // Aplicar configurações de "Ouro" (Reject Call, Always Online, Ignore Groups)
      await EvolutionApiService.setInstanceSettings(instanceName, {
        rejectCall: true,
        msgCall: "Este número só recebe mensagens de WhatsApp.",
        groupsIgnore: true,
        alwaysOnline: true,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false
      }, serverApiUrl, serverApiToken);
      
      // Registrar Webhook dinamicamente baseado no ambiente (.env)
      const webhookUrl = process.env.RAGNAR_WEBHOOK_URL || "https://ragnar.supa.rn3.tec.br/api/webhooks/evolution";
      
      await EvolutionApiService.registerWebhook(instanceName, webhookUrl, serverApiUrl, serverApiToken);
      
      // Capturar o QR Code (Base64) gerado na criação da instância
      if (createResponse?.qrcode?.base64) {
        qrCodeBase64 = createResponse.qrcode.base64;
      } else if (createResponse?.base64) {
        qrCodeBase64 = createResponse.base64;
      } else if (typeof createResponse?.qrcode === 'string') {
        qrCodeBase64 = createResponse.qrcode;
      }
    } else {
      return NextResponse.json({ error: 'Provedor ainda não integrado ou indisponível.' }, { status: 501 });
    }

    // 4. Registrar em crm_canais preservando a rastreabilidade interna
    // O provider_token é salvo mas o segredo real reside no .env se for global.
    const { data: canal, error: canalError } = await supabase
      .from('crm_canais')
      .insert([{
        empresa_id: profile.empresa_id,
        nome: nome,
        tipo: tipo || 'whatsapp',
        provider: provider,
        provider_id: instanceName,
        provider_token: serverApiToken,
        // Se tiver QR code = está pareando; se não = conexão direta (Evolution mode)
        status: qrCodeBase64 ? 'pairing' : 'connected',
        settings: {
          apiUrl: serverApiUrl,
          instanceName: instanceName
        }
      }])
      .select('id')
      .single();

    if (canalError) {
      // Rollback na Evolution se falhar no DB
      await EvolutionApiService.logoutInstance(instanceName, serverApiUrl, serverApiToken);
      throw canalError;
    }

    return NextResponse.json({
      success: true,
      canalId: canal.id,
      instanceName: instanceName,
      qrcode: qrCodeBase64
    });

  } catch (error: any) {
    console.error('Erro na criação segura de canal:', error);
    return NextResponse.json({ error: error.message || 'Falha ao criar canal' }, { status: 500 });
  }
}
