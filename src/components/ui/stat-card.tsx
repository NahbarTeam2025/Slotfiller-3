import { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
  valueClassName?: string;
}

export function StatCard({ title, value, subtitle, icon, className, valueClassName }: StatCardProps) {
  return (
    <div className={cn("rounded-xl bg-white dark:bg-card-dark p-4 sm:p-6 shadow-floating border border-gray-100 dark:border-slate-800", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</div>
        {icon && <div className="text-gray-400 dark:text-gray-500">{icon}</div>}
      </div>
      <div className={cn("text-3xl sm:text-4xl font-bold text-deep-blue dark:text-white", valueClassName)}>{value}</div>
      {subtitle && <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">{subtitle}</div>}
    </div>
  );
}
