import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Brand, NavigationRail, NavLinks } from "./NavigationRail";
import { GlobalFilters } from "./GlobalFilters";

export function AppShell({ children, toolbar }: { children: ReactNode; toolbar?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex h-dvh w-full overflow-hidden bg-background">
        <NavigationRail collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-14 shrink-0 items-center gap-2 border-b bg-card/80 px-3 py-2 backdrop-blur sm:px-4">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir navegación">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 border-none bg-rail p-0 text-rail-foreground">
                <SheetTitle className="sr-only">Navegación</SheetTitle>
                <div className="flex h-14 items-center px-4">
                  <Brand />
                </div>
                <div className="px-2">
                  <NavLinks onNavigate={() => setOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <span className="text-sm font-extrabold tracking-tight lg:hidden">NEXO MX 2030</span>
            <div className="ml-auto flex min-w-0 items-center gap-2 lg:ml-0 lg:flex-1">
              <GlobalFilters />
            </div>
            {toolbar}
          </header>
          <div className="min-h-0 flex-1">{children}</div>
        </div>
      </div>
    </>
  );
}

export function PageScroll({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground sm:text-base">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
