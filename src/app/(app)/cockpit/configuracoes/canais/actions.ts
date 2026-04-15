"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { EvolutionApiService } from "@/lib/omnichannel/services/EvolutionApiService";

/**
 * Atualiza a configuração de IA de um canal.
 */
export async function updateChannelAIConfig(id: string, iaConfig: any) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("crm_canais")
    .update({ ia_config: iaConfig })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/cockpit/configuracoes/canais");
  return { success: true };
}

/**
 * Alterna o status de um canal entre 'connected' e 'inactive'.
 */
export async function toggleChannelStatus(id: string, currentStatus: string) {
  const supabase = await createClient();

  const newStatus = currentStatus === "inactive" ? "connected" : "inactive";

  const { error } = await supabase
    .from("crm_canais")
    .update({ status: newStatus })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/cockpit/configuracoes/canais");
  return { success: true, status: newStatus };
}

/**
 * Sincroniza o status real do canal com o provedor externo.
 * Útil para casos onde o Webhook não disparou ou está em ambiente local.
 */
export async function syncChannelStatus(id: string, provider: string, providerId: string, apiUrl?: string, apiToken?: string) {
  const supabase = await createClient();

  if (provider === 'evolution') {
    try {
      const state = await EvolutionApiService.getConnectionStatus(providerId, apiUrl, apiToken);
      console.log(`[actions] Sincronizando status para ${providerId}: Evo State = ${state}`);
      
      let ragnarStatus = 'pairing';

      if (state === 'open' || state === 'connected') {
        ragnarStatus = 'connected';
      } else if (state === 'close' || state === 'refused' || state === 'disconnected') {
        ragnarStatus = 'disconnected';
      }

      const { error } = await supabase
        .from("crm_canais")
        .update({ status: ragnarStatus })
        .eq("id", id);

      if (error) throw error;

      revalidatePath("/cockpit/configuracoes/canais");
      return { success: true, status: ragnarStatus };
    } catch (e) {
      console.error(`Erro ao sincronizar status do canal ${id}:`, e);
      return { success: false, error: String(e) };
    }
  }

  return { success: false, reason: 'Provedor não suporta sincronismo ativo' };
}

/**
 * Remove um canal e sua respectiva instância no provedor.
 */
export async function deleteChannel(id: string, provider: string, providerId: string, apiUrl?: string, apiToken?: string) {
  const supabase = await createClient();

  try {
    // 1. Remover do provedor externo se for Evolution
    if (provider === 'evolution') {
      await EvolutionApiService.logoutInstance(providerId, apiUrl, apiToken);
    }

    // 2. Remover do Supabase
    const { error } = await supabase
      .from("crm_canais")
      .delete()
      .eq("id", id);

    if (error) {
      // Código PostgreSQL 23503: restrição de chave estrangeira
      if (error.code === '23503') {
        return { 
          success: false, 
          error: "Não é possível remover este canal pois existem leads ou conversas vinculadas a ele. Remova as associações primeiro ou desative a IA." 
        };
      }
      throw error;
    }

    revalidatePath("/cockpit/configuracoes/canais");
    return { success: true };
  } catch (e: any) {
    console.error(`Erro ao deletar canal ${id}:`, e);
    return { success: false, error: e.message || "Erro desconhecido ao deletar canal." };
  }
}

/**
 * Busca um novo QR Code para uma instância existente usando as credenciais do canal.
 */
export async function getReconnectQRCode(provider: string, providerId: string, apiUrl?: string, apiToken?: string) {
  if (provider === 'evolution') {
    const qrcode = await EvolutionApiService.getQRCode(providerId, apiUrl, apiToken);
    return { qrcode };
  }
  return { qrcode: null };
}
/**
 * Busca todos os pipelines (boards) e suas etapas para a empresa logada.
 */
export async function getPipelinesAndStages(empresaId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pipelines")
    .select(`
      id,
      nome,
      pipeline_stages (
        id,
        nome,
        ordem
      )
    `)
    .eq("empresa_id", empresaId)
    .order("nome");

  if (error) {
    console.error("Erro ao buscar pipelines:", error);
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

/**
 * Cria um canal do tipo Landing Page com configuração de roteamento.
 */
export async function createLandingPageChannel(nome: string, pipelineId: string, stageId: string, empresaId: string) {
  const supabase = await createClient();

  // 1. Criar o Canal Interno
  const { data: canal, error: canalError } = await supabase
    .from("crm_canais")
    .insert([
      {
        empresa_id: empresaId,
        nome: nome,
        tipo: 'landing-page',
        provider: 'internal',
        provider_id: `lp_${Math.random().toString(36).substring(7)}`,
        status: 'connected',
        token: crypto.randomUUID()
      }
    ])
    .select("id")
    .single();

  if (canalError) {
    console.error("Erro ao criar canal de landing page:", canalError);
    return { success: false, error: canalError.message };
  }

  // 2. Criar configuração de roteamento
  const { error: routeError } = await supabase
    .from("crm_canais_roteamento")
    .insert([
      {
        canal_id: canal.id,
        org_id: empresaId,
        pipeline_id: pipelineId,
        stage_id: stageId
      }
    ]);

  if (routeError) {
    console.error("Erro ao criar roteamento:", routeError);
    return { success: false, error: routeError.message };
  }

  revalidatePath("/cockpit/configuracoes/canais");
  return { success: true, canalId: canal.id };
}
