import { createClient } from '@supabase/supabase-js';

/**
 * Função utilitária para buscar a configuração de roteamento de um canal.
 * Utiliza SERVICE_ROLE para garantir acesso em fluxos de webhook/server actions.
 */
export async function getRoutingConfig(canalId: string, orgId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('crm_canais_roteamento')
    .select('pipeline_id, stage_id')
    .eq('canal_id', canalId)
    .eq('org_id', orgId)
    .single();

  if (error) {
    console.error(`[Routing] Erro ao buscar roteamento para o canal ${canalId}:`, error);
    return null;
  }

  return data;
}
