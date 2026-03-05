import { NextRequest, NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant-resolver";

const PUBLIC_PATHS = ["/login", "/api/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

const SESSION_COOKIE = "better-auth.session_token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const hostname = request.headers.get("host") ?? "";
  const overrideSlug = request.headers.get("x-tenant-slug");
  const tenant = await resolveTenant(hostname, overrideSlug);

  if (!tenant) {
    return NextResponse.json(
      { error: "Tenant not found", host: hostname },
      { status: 404 },
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-id", tenant.id);
  requestHeaders.set("x-tenant-name", tenant.name);
  requestHeaders.set("x-tenant-slug", tenant.slug);
  requestHeaders.set("x-tenant-region", tenant.region);

  if (isPublic(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isApiRoute = pathname.startsWith("/api/");

  if (!hasSession) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
