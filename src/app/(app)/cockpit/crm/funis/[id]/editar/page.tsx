import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import EditPipelineForm from "./EditPipelineForm"

export default async function EditarFunilPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const supabase = await createClient()

  // Buscar pipeline existente
  const { data: pipeline, error } = await supabase
    .from('pipelines')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !pipeline) {
    notFound()
  }

  // Buscar grupos atrelados atualmente
  const { data: currentGroups } = await supabase
    .from('pipeline_grupo_acesso')
    .select('grupo_id')
    .eq('pipeline_id', pipeline.id)

  const groupIds = currentGroups?.map(g => g.grupo_id) || []

  // Buscar grupos disponíveis ("all") via client/server
  return <EditPipelineForm pipeline={pipeline} initialGroups={groupIds} />
}
