'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/utils/permissions'
import { getMyProfile } from '@/app/(app)/cockpit/actions'

export async function createPipeline(formData: FormData) {
  try {
    const me = await getMyProfile()
    if (!hasPermission(me, 'funis', 'create')) {
      return { error: 'Sem permissão para criar funis.' }
    }

    const nome = formData.get('nome') as string
    const descricao = formData.get('descricao') as string
    const is_public = formData.get('is_public') === 'true'
    const gruposRaw = formData.get('grupos_ids') as string
    const gruposIds: string[] = gruposRaw ? JSON.parse(gruposRaw) : []
    const departamento_id = formData.get('departamento_id') as string

    const supabase = await createClient()
    const empresaId = me?.role_global === 'superadmin' ? formData.get('empresa_id') as string : me?.empresa_id ?? ''

    const { data: pipeline, error } = await supabase
      .from('pipelines')
      .insert([{
        nome,
        descricao,
        is_public,
        departamento_id: departamento_id || null,
        empresa_id: empresaId
      }])
      .select()
      .single()

    if (error) {
      console.error("Erro ao criar pipeline", error)
      return { error: error.message }
    }

    if (pipeline) {
        // Registrar grupos no Pipeline
        if (gruposIds.length > 0) {
          const pipelineGroupsData = gruposIds.map(grupoId => ({
              pipeline_id: pipeline.id,
              grupo_id: grupoId
          }))
          await supabase.from('pipeline_grupo_acesso').insert(pipelineGroupsData)
        }

        // Criar estágios básicos padrão
        const { data: stages } = await supabase.from('pipeline_stages').insert([
            { pipeline_id: pipeline.id, nome: 'PROSPECÇÃO', ordem: 0, cor: '#80B828' },
            { pipeline_id: pipeline.id, nome: 'NEGOCIAÇÃO', ordem: 1, cor: '#2BAADF' },
            { pipeline_id: pipeline.id, nome: 'FECHADO', ordem: 2, cor: '#1A8FBF' }
        ]).select('id')

        // Herdar permissão de grupos nos estágios recém-criados
        if (stages && gruposIds.length > 0) {
           const stageGroupsData: { stage_id: string, grupo_id: string }[] = []
           stages.forEach(stage => {
              gruposIds.forEach(grupoId => {
                 stageGroupsData.push({ stage_id: stage.id, grupo_id: grupoId })
              })
           })
           await supabase.from('pipeline_stage_grupo_acesso').insert(stageGroupsData)
        }
    }

    revalidatePath('/cockpit/crm/funis')
    return { success: true, pipelineId: pipeline?.id }
  } catch (err: any) {
    console.error("Fatal Error Create Pipeline", err)
    return { error: err?.message || 'Erro crítico na Server Action' }
  }
}

export async function createCrmCard(pipelineId: string, stageId: string, formData: FormData) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'cards', 'create')) {
    return { error: 'Sem permissão para criar cards no CRM.' }
  }

  const titulo = formData.get('titulo') as string
  const descricao = formData.get('descricao') as string
  const valor = formData.get('valor') || 0
  const cliente_nome = formData.get('cliente_nome') as string || null
  const responsavel_id = formData.get('responsavel_id') as string || null
  const data_prazo_form = formData.get('data_prazo') as string || null

  const supabase = await createClient()
  const empresaId = me?.role_global === 'superadmin' ? formData.get('empresa_id') as string : me?.empresa_id ?? ''

  // Se não digitou prazo manualmente, calcula a partir do SLA do estágio
  // sla_dias = null → mesmo dia (0 dias); sla_dias = N → hoje + N dias
  let data_prazo = data_prazo_form
  if (!data_prazo) {
    const { data: stageData } = await supabase
      .from('pipeline_stages')
      .select('sla_dias')
      .eq('id', stageId)
      .single()
    
    const slaDias = stageData?.sla_dias ?? 0
    const now = new Date()
    data_prazo = new Date(now.getTime() + slaDias * 86400000).toISOString().split('T')[0]
  }

  const { data: newCard, error: insertError } = await supabase
    .from('crm_cards')
    .insert([{
      titulo,
      descricao,
      valor: Number(valor),
      cliente_nome,
      pipeline_id: pipelineId,
      stage_id: stageId,
      empresa_id: empresaId,
      responsavel_id: responsavel_id || null,
      data_prazo: data_prazo || null,
      stage_entered_at: new Date().toISOString()
    }])
    .select('id')
    .single()

  if (insertError) {
    console.error("Erro ao criar card", insertError)
    return { error: insertError.message }
  }

  // Gravar histórico de Criação
  if (me?.id && newCard?.id) {
    await supabase.from('crm_cards_history').insert([{
       card_id: newCard.id,
       usuario_id: me.id,
       acao: 'CARD_CREATED',
       para_stage_id: stageId,
       para_pipeline_id: pipelineId
    }])
  }

  revalidatePath(`/cockpit/crm/${pipelineId}`)
}

export async function updateCardStage(cardId: string, pipelineId: string, newStageId: string) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'cards', 'move')) {
    return { error: 'Sem permissão para mover cards no CRM.' }
  }
  const supabase = await createClient()

  // Buscar current para histórico
  const { data: currentCard } = await supabase.from('crm_cards').select('stage_id').eq('id', cardId).single()
  const de_stage_id = currentCard?.stage_id

  // Fetch SLA from the new stage to compute data_prazo
  const { data: stageData } = await supabase
    .from('pipeline_stages')
    .select('sla_dias')
    .eq('id', newStageId)
    .single()

  const now = new Date()
  // sla_dias = null → mesmo dia (0 dias); sla_dias = N → hoje + N dias
  const slaDias = stageData?.sla_dias ?? 0
  const data_prazo = new Date(now.getTime() + slaDias * 86400000).toISOString().split('T')[0]

  const updatePayload: Record<string, any> = {
    stage_id: newStageId,
    stage_entered_at: now.toISOString(),
    data_prazo,
  }

  const query = supabase.from('crm_cards').update(updatePayload).eq('id', cardId)
  
  // Tenant Isolation
  if (me?.role_global !== 'superadmin') {
    query.eq('empresa_id', me?.empresa_id ?? '')
  }

  const { error } = await query
  if (error) {
    console.error("Erro ao mover card", error)
    return { error: error.message }
  }

  // Gravar histórico
  if (me?.id && de_stage_id !== newStageId) {
     await supabase.from('crm_cards_history').insert([{
        card_id: cardId,
        usuario_id: me.id,
        acao: 'STATUS_CHANGED',
        de_stage_id: de_stage_id,
        para_stage_id: newStageId,
        de_pipeline_id: pipelineId,
        para_pipeline_id: pipelineId
     }])
  }

  // A UI cuidará do swap visual, mas persistimos na DB
  revalidatePath(`/cockpit/crm/${pipelineId}`)
}

export async function transferCardPipeline(cardId: string, currentPipelineId: string, toPipelineId: string, toStageId: string, observacao?: string) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'cards', 'move')) {
    return { error: 'Sem permissão para transferir cards entre funis.' }
  }
  const supabase = createAdminClient()

  const { data: currentCard } = await supabase.from('crm_cards').select('stage_id').eq('id', cardId).single()
  const de_stage_id = currentCard?.stage_id

  const query = supabase.from('crm_cards').update({ pipeline_id: toPipelineId, stage_id: toStageId }).eq('id', cardId)
  
  // Tenant Isolation (Obrigatório ao usar Admin Client)
  if (me?.role_global !== 'superadmin') {
    query.eq('empresa_id', me?.empresa_id ?? '')
  }

  const { error } = await query
  if (error) return { error: error.message }

  if (me?.id) {
     await supabase.from('crm_cards_history').insert([{
        card_id: cardId,
        usuario_id: me.id,
        acao: 'TRANSFER_PIPELINE',
        de_stage_id: de_stage_id,
        para_stage_id: toStageId,
        de_pipeline_id: currentPipelineId,
        para_pipeline_id: toPipelineId,
        observacao: observacao
     }])
  }

  revalidatePath(`/cockpit/crm/${currentPipelineId}`)
  revalidatePath(`/cockpit/crm/${toPipelineId}`)
}

export async function updateCrmCard(cardId: string, pipelineId: string, formData: FormData) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'cards', 'edit')) {
    return { error: 'Sem permissão para editar cards no CRM.' }
  }
  const supabase = await createClient()

  const titulo = formData.get('titulo') as string
  const descricao = formData.get('descricao') as string
  const valor = formData.get('valor') || 0
  const cliente_nome = formData.get('cliente_nome') as string
  const observacao = formData.get('observacao') as string
  const responsavel_id = formData.get('responsavel_id') as string || null
  const data_prazo = formData.get('data_prazo') as string || null

  const query = supabase
    .from('crm_cards')
    .update({
      titulo,
      descricao,
      valor: Number(valor),
      cliente_nome,
      observacao,
      responsavel_id: responsavel_id || null,
      data_prazo: data_prazo || null
    })
    .eq('id', cardId)

  // Tenant Isolation
  if (me?.role_global !== 'superadmin') {
    query.eq('empresa_id', me?.empresa_id ?? '')
  }

  const { error } = await query
  if (error) {
    console.error("Erro ao atualizar card", error)
    return { error: error.message }
  }

  // Gravar histórico de Edição
  if (me?.id) {
     await supabase.from('crm_cards_history').insert([{
        card_id: cardId,
        usuario_id: me.id,
        acao: 'CARD_EDITED',
        de_pipeline_id: pipelineId,
        para_pipeline_id: pipelineId
     }])
  }

  revalidatePath(`/cockpit/crm/${pipelineId}`)
}

export async function toggleCardFinalizado(cardId: string, pipelineId: string, status: boolean) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'cards', 'edit')) {
    return { error: 'Sem permissão para alterar status de conclusão.' }
  }
  const supabase = await createClient()

  const query = supabase
    .from('crm_cards')
    .update({ finalizado: status })
    .eq('id', cardId)

  // Tenant Isolation
  if (me?.role_global !== 'superadmin') {
    query.eq('empresa_id', me?.empresa_id ?? '')
  }

  const { error } = await query

  if (error) {
    console.error("Erro ao concluir card", error)
    return { error: error.message }
  }

  // Gravar histórico de Conclusão / Reativação
  if (me?.id) {
     await supabase.from('crm_cards_history').insert([{
        card_id: cardId,
        usuario_id: me.id,
        acao: status ? 'CARD_FINISHED' : 'CARD_REOPENED',
        de_pipeline_id: pipelineId,
        para_pipeline_id: pipelineId
     }])
  }

  revalidatePath(`/cockpit/crm/${pipelineId}`)
  return { success: true }
}

export async function getCardHistory(cardId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('crm_cards_history')
    .select(`
       id, acao, created_at, observacao,
       usuarios ( nome_completo ),
       de_stage:pipeline_stages!de_stage_id ( nome ),
       para_stage:pipeline_stages!para_stage_id ( nome ),
       de_pipeline:pipelines!de_pipeline_id ( nome ),
       para_pipeline:pipelines!para_pipeline_id ( nome )
    `)
    .eq('card_id', cardId)
    .order('created_at', { ascending: false })
  
  return { data, error: error?.message }
}

export async function saveStageConfig(pipelineId: string, stages: any[], stageGroupMap: Record<string, string[]>) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'funis', 'edit')) {
    return { error: 'Sem permissão para editar estágios do funil.' }
  }
  const supabase = await createClient()

  // 1. Processar Estágios. Vamos obter os estágios atuais para saber se tem que deletar
  const { data: existing } = await supabase.from('pipeline_stages').select('id').eq('pipeline_id', pipelineId)
  const existingIds = existing?.map(e => e.id) || []
  
  const incomingIds = stages.filter(s => s.id).map(s => s.id)
  const toDelete = existingIds.filter(id => !incomingIds.includes(id))

  // Deleta os que não vieram na lista salva (cuidado: cascade vai apagar cards e permissions!)
  if (toDelete.length > 0) {
     await supabase.from('pipeline_stages').delete().in('id', toDelete)
  }

  // Insere ou atualiza estágios
   for (let i = 0; i < stages.length; i++) {
     const st = stages[i]
     const tempKey = st.id || `new_${i}`
     let realStageId = st.id

     if (st.id) {
       await supabase.from('pipeline_stages').update({
         nome: st.nome,
         cor: st.cor,
         ordem: st.ordem,
         sla_dias: st.sla_dias ?? null
       }).eq('id', st.id)
     } else {
       const { data: novo } = await supabase.from('pipeline_stages').insert({
          pipeline_id: pipelineId,
          nome: st.nome,
          cor: st.cor,
          ordem: st.ordem,
          sla_dias: st.sla_dias ?? null
       }).select('id').single()
       if (novo) realStageId = novo.id
     }

     // 2. Atualizar permissões de GRUPOS do Estágio!
     // Limpa permissões do stage
     if (realStageId) {
       await supabase.from('pipeline_stage_grupo_acesso').delete().eq('stage_id', realStageId)
       
       const permittedGroups = stageGroupMap[tempKey] || []
       if (permittedGroups.length > 0) {
          const acc_data = permittedGroups.map(gid => ({
             stage_id: realStageId,
             grupo_id: gid
          }))
          await supabase.from('pipeline_stage_grupo_acesso').insert(acc_data)
       }
     }
  }

  revalidatePath(`/cockpit/crm/${pipelineId}`)
}

export async function updatePipeline(formData: FormData) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'funis', 'edit')) {
    return { error: 'Sem permissão para editar funis.' }
  }

  const id = formData.get('id') as string
  const nome = formData.get('nome') as string
  const descricao = formData.get('descricao') as string
  const is_public = formData.get('is_public') === 'true'
  const gruposRaw = formData.get('grupos_ids') as string
  const gruposIds: string[] = gruposRaw ? JSON.parse(gruposRaw) : []

  const supabase = await createClient()

  // 1. Atualizar base
  const { error } = await supabase
    .from('pipelines')
    .update({ nome, descricao, is_public })
    .eq('id', id)

  if (error) {
    console.error("Erro ao atualizar pipeline", error)
    return { error: error.message }
  }

  // 2. Limpar e recadastrar grupos associados globais
  await supabase.from('pipeline_grupo_acesso').delete().eq('pipeline_id', id)
  
  if (gruposIds.length > 0) {
    const pipelineGroupsData = gruposIds.map(grupoId => ({
        pipeline_id: id,
        grupo_id: grupoId
    }))
    await supabase.from('pipeline_grupo_acesso').insert(pipelineGroupsData)
  }

  revalidatePath('/cockpit/crm/funis')
  redirect('/cockpit/crm/funis')
}

export async function deletePipeline(formData: FormData) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'funis', 'delete')) {
    return { error: 'Sem permissão para excluir funis.' }
  }

  const id = formData.get('id') as string
  const supabase = await createClient()

  const { error } = await supabase.from('pipelines').delete().eq('id', id)

  if (error) {
    console.error("Erro ao excluir pipeline", error)
    return { error: error.message }
  }

  revalidatePath('/cockpit/crm/funis')
  redirect('/cockpit/crm/funis')
}

export async function deleteCrmCard(cardId: string, pipelineId: string) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'cards', 'delete')) {
    return { error: 'Sem permissão para excluir cards.' }
  }
  const supabase = await createClient()

  const query = supabase.from('crm_cards').delete().eq('id', cardId)

  // Tenant Isolation (Lei Suprema)
  if (me?.role_global !== 'superadmin') {
    query.eq('empresa_id', me?.empresa_id ?? '')
  }

  const { error } = await query

  if (error) {
    console.error("Erro ao excluir card", error)
    return { error: error.message }
  }

  revalidatePath(`/cockpit/crm/${pipelineId}`)
  return { success: true }
}

export async function getCardFiles(cardId: string) {
  const me = await getMyProfile()
  if (!me) return { error: 'Não autenticado' }
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('crm_card_files')
    .select('*')
    .eq('card_id', cardId)
    .eq('empresa_id', me.empresa_id)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }

  // Gerar URLs assinadas para cada arquivo para permitir acesso seguro
  const filesWithUrls = await Promise.all((data || []).map(async (file) => {
    const { data: signedUrlData } = await supabase.storage
      .from('card_attachments')
      .createSignedUrl(file.file_url, 3600) // 1 hora de validade
    
    return { ...file, download_url: signedUrlData?.signedUrl }
  }))

  return { data: filesWithUrls }
}

export async function uploadCardFile(cardId: string, formData: FormData) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'card_attachments', 'create')) {
    return { error: 'Sem permissão para anexar arquivos.' }
  }

  const file = formData.get('file') as File
  if (!file) return { error: 'Nenhum arquivo enviado.' }

  // Validação de Tamanho (5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { error: 'Arquivo excede o limite de 5MB.' }
  }

  const supabase = await createClient()
  const empresaId = me.empresa_id
  const fileName = `${Date.now()}_${file.name}`
  const filePath = `${empresaId}/${cardId}/${fileName}`

  // 1. Upload para o Storage
  const { data: storageData, error: storageError } = await supabase.storage
    .from('card_attachments')
    .upload(filePath, file)

  if (storageError) {
    console.error("Erro storage upload:", storageError)
    return { error: storageError.message }
  }

  // 2. Salvar Metadados no Banco
  const { error: dbError } = await supabase
    .from('crm_card_files')
    .insert([{
      empresa_id: empresaId,
      card_id: cardId,
      file_name: file.name,
      file_url: filePath,
      file_type: file.type,
      uploaded_by: me.id
    }])

  if (dbError) {
    // Pipeline de rollback: se falhar no DB, removemos do Storage
    await supabase.storage.from('card_attachments').remove([filePath])
    return { error: dbError.message }
  }

  // REGISTRAR NO HISTÓRICO
  await supabase.from('crm_cards_history').insert([{
     card_id: cardId,
     usuario_id: me.id,
     acao: 'ATTACHMENT_ADDED',
     observacao: `Anexo adicionado: ${file.name}`
  }])

  return { success: true }
}

export async function deleteCardFile(fileId: string, storagePath: string) {
  const me = await getMyProfile()
  if (!hasPermission(me, 'card_attachments', 'delete')) {
    return { error: 'Sem permissão para excluir anexos.' }
  }

  const supabase = await createClient()

  // 0. Buscar metadados para o histórico antes de deletar
  const { data: fileData } = await supabase.from('crm_card_files').select('file_name, card_id').eq('id', fileId).single()

  // 1. Remover do Storage
  const { error: storageError } = await supabase.storage
    .from('card_attachments')
    .remove([storagePath])

  if (storageError) {
    console.error("Erro storage remove:", storageError)
    // Mesmo se falhar no storage, tentamos limpar o DB se o arquivo não existir mais
  }

  // 2. Remover do Banco (Garantindo Tenant Isolation)
  const query = supabase.from('crm_card_files').delete().eq('id', fileId)
  
  if (me?.role_global !== 'superadmin') {
    query.eq('empresa_id', me?.empresa_id ?? '')
  }

  const { error: dbError } = await query
  if (dbError) return { error: dbError.message }

  // REGISTRAR NO HISTÓRICO
  if (fileData) {
     await supabase.from('crm_cards_history').insert([{
        card_id: fileData.card_id,
        usuario_id: me.id,
        acao: 'ATTACHMENT_REMOVED',
        observacao: `Anexo removido: ${fileData.file_name}`
     }])
  }

  return { success: true }
}

export async function getTransferablePipelines() {
  const me = await getMyProfile()
  if (!me) return { error: 'Não autenticado' }
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('pipelines')
    .select('id, nome, pipeline_stages(id, nome, ordem)')
    .eq('empresa_id', me.empresa_id)
    .order('nome')

  if (error) return { error: error.message }

  // Ordenar os estágios dentro de cada pipeline
  const pipesWithOrderedStages = (data || []).map(p => ({
     ...p,
     pipeline_stages: [...(p.pipeline_stages || [])].sort((a,b) => a.ordem - b.ordem)
  }))

  return { data: pipesWithOrderedStages }
}

export async function searchCrmCards(query: string) {
  const me = await getMyProfile()
  if (!me) return { error: 'Não autenticado' }
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('crm_cards')
    .select('id, titulo')
    .ilike('titulo', `%${query}%`)
    .eq('empresa_id', me.empresa_id)
    .limit(10)
    
  return { data, error: error?.message }
}
