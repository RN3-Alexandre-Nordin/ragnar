import { createClient } from "@/utils/supabase/server";
import { getMyProfile } from "@/app/(app)/cockpit/actions";

export default async function DebugCanaisPage(props: { searchParams: Promise<{ error?: string, status?: string }> }) {
  const searchParams = await props.searchParams;
  const me = await getMyProfile();
  if (!me) return <div className="text-white">Não autenticado</div>;

  const errorMsg = searchParams.error;
  const statusMsg = searchParams.status;

  const supabase = await createClient();
  const { data: canais, error } = await supabase
    .from("crm_canais")
    .select("*")
    .eq("empresa_id", me.empresa_id)
    .order("created_at", { ascending: false });

  return (
    <div className="bg-black text-white p-10 min-h-screen font-mono">
      <h1 className="text-2xl font-bold mb-5">Debug de Canais (Failsafe)</h1>
      <p className="mb-5">Empresa ID: {me.empresa_id}</p>

      {statusMsg === 'success' && (
        <div className="bg-green-900/50 p-4 border border-green-500 mb-5 animate-pulse">
           ✅ SUCESSO! O canal foi criado e registrado no banco.
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-900/50 p-4 border border-red-500 mb-5">
           ❌ ERRO: {decodeURIComponent(errorMsg)}
        </div>
      )}
      
      {error && <div className="bg-red-900 p-4 border border-red-500 mb-5">Erro DB: {error.message}</div>}
      
      <div className="space-y-4">
        {canais?.map(canal => (
          <div key={canal.id} className="border border-green-500/30 p-5 rounded-lg bg-green-900/10">
            <p className="text-green-400 font-bold">Nome: {canal.nome}</p>
            <p>Status: {canal.status}</p>
            <p>ID: {canal.id}</p>
            <p className="text-xs text-gray-400 mt-2">Data: {canal.created_at}</p>
            <pre className="text-xs bg-black p-3 mt-2 overflow-auto">
              {JSON.stringify(canal.provider_data, null, 2)}
            </pre>
          </div>
        ))}
        {canais?.length === 0 && <p>Nenhum canal encontrado para esta empresa.</p>}
      </div>
    </div>
  );
}
