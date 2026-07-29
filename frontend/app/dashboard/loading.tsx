import { Sparkles } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-fade-in py-2">
      {/* Filter Bar Skeleton */}
      <div className="h-12 w-full glass-card animate-shimmer rounded-xl" />

      {/* Headline Hero Metrics Skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="metric-card h-44 animate-shimmer rounded-xl flex flex-col justify-between p-6">
          <div className="flex justify-between items-center">
            <div className="w-36 h-4 bg-muted/80 rounded" />
            <div className="w-8 h-8 rounded-lg bg-muted/80" />
          </div>
          <div className="w-48 h-10 bg-muted/80 rounded mt-4" />
          <div className="w-64 h-3 bg-muted/60 rounded mt-auto" />
        </div>
        <div className="metric-card h-44 animate-shimmer rounded-xl flex flex-col justify-between p-6">
          <div className="flex justify-between items-center">
            <div className="w-44 h-4 bg-muted/80 rounded" />
            <div className="w-8 h-8 rounded-lg bg-muted/80" />
          </div>
          <div className="w-56 h-10 bg-muted/80 rounded mt-4" />
          <div className="w-56 h-3 bg-muted/60 rounded mt-auto" />
        </div>
      </div>

      {/* Charts & Taxonomies Skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 glass-card h-[420px] animate-shimmer p-6 flex flex-col justify-between">
          <div className="w-48 h-6 bg-muted/80 rounded" />
          <div className="flex items-center justify-center my-auto text-muted-foreground/60 text-sm gap-2">
            <Sparkles className="w-4 h-4 animate-spin text-primary" />
            <span>Aggregating organizational workflow efficiency metrics...</span>
          </div>
          <div className="w-full h-12 bg-muted/60 rounded" />
        </div>
        <div className="lg:col-span-5 glass-card h-[420px] animate-shimmer p-6 flex flex-col gap-4">
          <div className="w-40 h-6 bg-muted/80 rounded" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 w-full bg-muted/50 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
