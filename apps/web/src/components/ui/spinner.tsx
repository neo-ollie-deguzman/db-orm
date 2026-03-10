import { LoaderCircle } from "lucide-react";

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <LoaderCircle className={`animate-spin ${className}`} />;
}
