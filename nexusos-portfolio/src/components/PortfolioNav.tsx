/**
 * Section navigation. NexusOS's app-navigation.tsx cannot be imported (it is
 * bound to react-router, route prefetch, framer-motion and permissions), so
 * this reproduces its nav-item recipe — same classes, same active marker
 * (.nav-active-glow on bg-primary/10), same icon treatment — over in-page
 * sections instead of routes.
 */
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECTIONS } from "~/sections/registry";
import { profile } from "~/data/profile";

interface NavProps {
  active: string;
  onNavigate: (id: string) => void;
}

export function PortfolioNav({ active, onNavigate, onReplayIntro }: NavProps & { onReplayIntro: () => void }) {
  return (
    <aside className="hidden h-full min-h-0 flex-col md:flex" aria-label="Portfolio sections">
      <div className="flex h-shell-header shrink-0 items-center px-5">
        <img
          className="nexusos-wordmark-img h-auto w-[132px]"
          src="/brand/nexusos-wordmark.png"
          alt="NexusOS"
          width={132}
          height={20}
          draggable={false}
        />
      </div>
      <div className="px-5 pb-3">
        <p className="text-h4">{profile.name}</p>
        <p className="text-small text-muted-foreground">{profile.role}</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-clip p-3 pr-4">
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <a
              key={id}
              href={`#${id}`}
              aria-current={isActive ? "location" : undefined}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(id);
              }}
              className={cn(
                "focus-ring group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-fast",
                isActive ? "font-medium text-foreground" : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
              )}
            >
              {isActive && (
                <span className="nav-active-glow absolute inset-0 -z-10 rounded-lg bg-primary/10" aria-hidden="true" />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors duration-fast",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              <span className="min-w-0 truncate">{label}</span>
            </a>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-line-soft p-3">
        <button
          type="button"
          onClick={onReplayIntro}
          className="focus-ring text-machine flex w-full items-center gap-2 rounded-control px-3 py-2 transition-colors duration-fast hover:bg-surface-3 hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-left">Replay star entry</span>
        </button>
      </div>
    </aside>
  );
}

export function MobileNav({ active, onNavigate }: NavProps) {
  return (
    <nav
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-line-soft px-3 py-2 md:hidden"
      aria-label="Portfolio sections"
    >
      {SECTIONS.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={active === id ? "location" : undefined}
          onClick={(e) => {
            e.preventDefault();
            onNavigate(id);
          }}
          className={cn(
            "focus-ring shrink-0 rounded-control px-3 py-1.5 text-xs transition-colors duration-fast",
            active === id ? "bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-surface-3",
          )}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
