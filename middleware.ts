import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // Only protect /admin routes
    if (!request.nextUrl.pathname.startsWith('/admin')) {
        return response;
    }

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user && request.nextUrl.pathname.startsWith('/admin/login')) {
        return response;
    }

    if (!user) {
        return NextResponse.redirect(new URL('/configurador/admin/login', request.url))
    }

    // Role-based gating: only admin can access these paths.
    const path = request.nextUrl.pathname;
    const adminOnlyExact = ['/admin'];
    const adminOnlyPrefix = ['/admin/parts', '/admin/products', '/admin/settings', '/admin/quotes', '/admin/stock', '/admin/reports', '/admin/cajas', '/admin/contabilidad'];
    // Edit & new order pages contienen montos/descuentos — solo admin.
    const isOrderEdit = /^\/admin\/orders\/[^/]+$/.test(path) && path !== '/admin/orders/new'
        ? true
        : path === '/admin/orders/new';
    const isAdminOnly = adminOnlyExact.includes(path)
        || adminOnlyPrefix.some(p => path === p || path.startsWith(p + '/'))
        || isOrderEdit;

    if (isAdminOnly) {
        try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
            const res = await fetch(`${supabaseUrl}/rest/v1/profiles?user_id=eq.${user.id}&select=role`, {
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                },
            });
            const rows = await res.json() as Array<{ role: string }>;
            const role = rows?.[0]?.role;
            if (role !== 'admin') {
                return NextResponse.redirect(new URL('/configurador/admin/orders', request.url));
            }
        } catch {
            // Si falla la verificación, mejor bloquear que filtrar.
            return NextResponse.redirect(new URL('/configurador/admin/orders', request.url));
        }
    }

    return response
}

export const config = {
    matcher: [
        '/admin/:path*',
    ],
}
