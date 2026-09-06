import { Construction } from 'lucide-react';

export default function Placeholder({ title = 'Coming Soon', message = "This part of the app hasn't been built yet." }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 gap-3">
      <div className="p-3 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-500 dark:text-brand-400">
        <Construction size={24} />
      </div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-muted-light dark:text-muted-dark max-w-sm">{message}</p>
    </div>
  );
}