import { getTenantContext } from "@/lib/tenant";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const { slug, tenantId } = await getTenantContext();

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-gray-500">
            Workspace: <span className="font-medium text-gray-700">{slug}</span>
          </p>
        </div>
        <LoginForm tenantId={tenantId} />
      </div>
      <p className="mt-4 text-center text-xs text-gray-400">
        All accounts use password{" "}
        <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-600">
          passworD123
        </code>
      </p>
    </div>
  );
}
