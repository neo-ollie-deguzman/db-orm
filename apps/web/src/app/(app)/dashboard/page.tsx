import { Suspense } from "react";
import { DashboardContent } from "./dashboard-content";

function CalendarSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-9 w-48 rounded-lg bg-gray-200" />
          <div className="mt-2 h-5 w-64 rounded bg-gray-100" />
        </div>
        <div className="h-10 w-36 rounded-lg bg-gray-200" />
      </div>
      <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="h-12 border-b border-gray-200" />
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[110px] border-b border-r border-gray-100 p-2"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
