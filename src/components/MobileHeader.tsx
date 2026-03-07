import { ChefHat } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MobileHeaderProps {
  title?: string;
}

export function MobileHeader({ title }: MobileHeaderProps) {
  const router = useRouter();

  return (
    <header className="md:hidden sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => router.push('/dashboard')}
      >
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <ChefHat className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-semibold text-sm">Azura</h1>
          {title && <p className="text-xs text-muted-foreground">{title}</p>}
        </div>
      </div>
    </header>
  );
}
