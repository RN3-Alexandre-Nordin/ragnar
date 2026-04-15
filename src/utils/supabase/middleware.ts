import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] || process.env['SUPABASE_URL'];
  const supabaseKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || process.env['SUPABASE_ANON_KEY'];

  console.log("DEBUG SUPABASE:", supabaseUrl ? "URL OK" : "URL VAZIA");

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const pathname = request.nextUrl.pathname
  
  // Normalizar pathname: remover locale (ex: /pt/login -> /login)
  const segments = pathname.split('/').filter(Boolean);
  const normalizedPathname = (segments.length > 0 && segments[0].length === 2) 
    ? '/' + (segments.slice(1).join('/') || '') 
    : pathname;

  const publicRoutes = ['/', '/login'];
  const isPublicRoute = publicRoutes.includes(normalizedPathname);
  const isWebhook = normalizedPathname.startsWith('/api/webhooks');
  const isInbound = normalizedPathname.startsWith('/api/inbound');

  // 1. Prioridade máxima: Webhooks, Inbound e Rotas Públicas (Sem esperar Auth)
  if (isWebhook || isInbound || isPublicRoute) {
    if (isWebhook || isInbound) return supabaseResponse;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 2. Se NÃO está logado:
  if (!user) {
    if (!isPublicRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // 3. Se ESTÁ logado e tenta acessar /login, redireciona para /cockpit
  if (user) {
    if (normalizedPathname === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/cockpit'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
