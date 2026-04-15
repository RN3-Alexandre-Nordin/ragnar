import { createClient } from "@/utils/supabase/server"
import { redirect, notFound } from "next/navigation"
import EditForm from "./EditForm"

export default async function EditarDepartamentoPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const supabase = await createClient()

  // Fetch department with company info
  const { data: departamento } = await supabase
    .from("departamentos")
    .select("*, empresas(id, nome)")
    .eq("id", params.id)
    .single()

  if (!departamento) {
    notFound()
  }

  // Get current user role — filter by auth_user_id to avoid .single() failing for superadmins
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const { data: userData } = await supabase
    .from('usuarios')
    .select('role_global')
    .eq('auth_user_id', authUser?.id ?? '')
    .single()
  const isSuperAdmin = userData?.role_global === 'superadmin'

  const { data: companies } = await supabase
    .from('empresas')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome')

  return (
    <div className="space-y-6">
      <EditForm departamento={departamento} companies={companies || []} isSuperAdmin={isSuperAdmin} />
    </div>
  )
}
