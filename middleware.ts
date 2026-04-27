import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const PROTECTED_PATHS = [
        '/dashboard', '/estoque', '/fichas', '/producao', '/previsao-vendas',
        '/compras', '/financeiro', '/relatorios', '/perdas', '/praca-quente',
        '/produtos-venda', '/estoque-producao', '/estoque-finalizados',
        '/estoque-insumos-produzidos', '/colaboradores', '/cadastros',
        '/gestores', '/admin', '/assinatura', '/config-pdv',
    ];

    const pathname = request.nextUrl.pathname;
    const isProtected = PROTECTED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));

    // Redirect unauthenticated users away from protected routes
    if (isProtected && !user) {
        const url = new URL('/auth', request.url);
        url.searchParams.set('from', pathname);
        return NextResponse.redirect(url);
    }

    // Redirect authenticated users away from auth page
    if (pathname.startsWith('/auth') && user) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return response;
}

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/estoque/:path*', '/estoque',
        '/fichas/:path*', '/fichas',
        '/producao/:path*', '/producao',
        '/previsao-vendas/:path*', '/previsao-vendas',
        '/compras/:path*', '/compras',
        '/financeiro/:path*', '/financeiro',
        '/relatorios/:path*', '/relatorios',
        '/perdas/:path*', '/perdas',
        '/praca-quente/:path*', '/praca-quente',
        '/produtos-venda/:path*', '/produtos-venda',
        '/estoque-producao/:path*', '/estoque-producao',
        '/estoque-finalizados/:path*', '/estoque-finalizados',
        '/estoque-insumos-produzidos/:path*', '/estoque-insumos-produzidos',
        '/colaboradores/:path*', '/colaboradores',
        '/cadastros/:path*', '/cadastros',
        '/gestores/:path*', '/gestores',
        '/admin/:path*', '/admin',
        '/assinatura/:path*', '/assinatura',
        '/config-pdv/:path*', '/config-pdv',
        '/auth/:path*',
    ],
};
