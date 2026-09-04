import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie and gates every non-public route
// behind sign-in. Public surface (excluded by the matcher below): /login,
// /auth/*, the public blog pages (/agents/*, /lo/*), the public landing page
// /blog/2-1-buydown and its form endpoint /api/lead-capture (NOT /blog itself
// — that's the authed blog manager), sitemap/robots, the token- or
// secret-authenticated APIs (/api/bookmarklet, /api/scout, /api/blog-cron,
// /api/chatgpt-ads/*),
// Next internals, and static files.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    // The site root doubles as the public front door: signed-in users get the
    // lead dashboard, anonymous visitors (and crawlers) get /home rewritten in
    // place so the content lives at "/" for SEO.
    if (url.pathname === "/") {
      url.pathname = "/home";
      return NextResponse.rewrite(url);
    }
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|login|auth(?:/|$)|agents(?:/|$)|lo(?:/|$)|blog/2-1-buydown(?:/|$)|home(?:/|$)|sitemap\\.xml|robots\\.txt|api/bookmarklet|api/scout|api/blog-cron|api/chatgpt-ads(?:/|$)|api/lead-capture(?:/|$)|.*\\.[\\w]+$).*)"
  ]
};
