'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createClient()

  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  // Verificar se a empresa do usuário está ativa
  const userId = data.session?.user?.id
  if (userId) {
    const { data: usuarioData } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('auth_user_id', userId)
      .single()

    if (usuarioData?.empresa_id) {
      const { data: empresaData } = await supabase
        .from('empresas')
        .select('ativo')
        .eq('id', usuarioData.empresa_id)
        .single()

      if (empresaData && !empresaData.ativo) {
        // Empresa inativa — desconectar e alertar
        await supabase.auth.signOut()
        redirect('/login?error=' + encodeURIComponent('Acesso suspenso. Entre em contato com a RN3.'))
      }
    }
  }

  revalidatePath('/cockpit', 'layout')
  redirect('/cockpit')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
