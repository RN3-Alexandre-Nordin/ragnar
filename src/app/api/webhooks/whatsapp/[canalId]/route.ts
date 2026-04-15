import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// Validação de Token da Meta (GET)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ canalId: string }> }
) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode && token) {
    if (mode === 'subscribe') {
      // Aqui poderíamos validar o token contra o banco de dados se necessário
      return new Response(challenge, { status: 200 })
    }
  }

  return new Response('Forbidden', { status: 403 })
}

// Recebimento de Mensagens (POST)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ canalId: string }> }
) {
  const { canalId } = await params
  const body = await request.json()
  
  const supabase = await createClient()

  // 1. Identificar o Canal e Empresa
  const { data: canal } = await supabase
    .from('crm_canais')
    .select('empresa_id, tipo, nome')
    .eq('id', canalId)
    .single()

  if (!canal) return NextResponse.json({ error: 'Canal não encontrado' }, { status: 404 })

  let senderName = ''
  let senderPhone = ''
  let messageText = ''

  // 2. Normalizar dados baseados no tipo (Evolution vs Meta)
  if (body.instance && body.data) {
    // Padrão Evolution API
    senderName = body.data.pushName || 'WhatsApp User'
    senderPhone = body.data.key.remoteJid.split('@')[0]
    messageText = body.data.message?.conversation || body.data.message?.extendedTextMessage?.text || ''
  } else if (body.object === 'whatsapp_business_account') {
    // Padrão Meta API
    const entry = body.entry?.[0]?.changes?.[0]?.value
    if (entry?.messages?.[0]) {
      const msg = entry.messages[0]
      const contact = entry.contacts?.[0]
      senderName = contact?.profile?.name || 'WhatsApp User'
      senderPhone = msg.from
      messageText = msg.text?.body || ''
    }
  }

  if (!senderPhone) return NextResponse.json({ status: 'ok', info: 'No message found' })

  // 3. Lógica de Leads: Buscar ou Criar
  const { data: existingLead } = await supabase
    .from('crm_leads')
    .select('id')
    .eq('empresa_id', canal.empresa_id)
    .eq('telefone', senderPhone)
    .single()

  let leadId = existingLead?.id

  if (!leadId) {
    const { data: newLead, error: leadError } = await supabase
      .from('crm_leads')
      .insert([{
        empresa_id: canal.empresa_id,
        nome: senderName,
        telefone: senderPhone,
        whatsapp: senderPhone,
        canal_id: canalId
      }])
      .select('id')
      .single()
    
    if (leadError) console.error('Erro ao criar lead:', leadError)
    leadId = newLead?.id
  }

  // 4. Criação Automática de Card no Kanban (Início do Funil)
  // Opcional: Só criar se não houver um card ativo para esse lead no momento
  if (leadId) {
    // Buscar o primeiro pipeline e primeiro estágio
    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('id')
      .eq('empresa_id', canal.empresa_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (pipeline) {
      const { data: stage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('pipeline_id', pipeline.id)
        .order('ordem', { ascending: true })
        .limit(1)
        .single()

      if (stage) {
        // Verificar se já existe um card aberto para este lead
        const { data: currentCard } = await supabase
          .from('crm_cards')
          .select('id')
          .eq('empresa_id', canal.empresa_id)
          .eq('lead_id', leadId)
          .eq('pipeline_id', pipeline.id)
          .limit(1)

        if (!currentCard || currentCard.length === 0) {
          await supabase.from('crm_cards').insert({
            empresa_id: canal.empresa_id,
            pipeline_id: pipeline.id,
            stage_id: stage.id,
            lead_id: leadId,
            titulo: `Lead: ${senderName}`,
            cliente_nome: senderName,
            descricao: `Mensagem inicial: ${messageText}`
          })
        }
      }
    }
  }

  return NextResponse.json({ status: 'success' })
}
