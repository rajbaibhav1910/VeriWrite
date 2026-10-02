import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MobileNavContent } from "@/components/navigation/TopNav";
import { useUiStore } from "@/store/uiStore";

/**
 * Mobile navigation drawer. Wraps the sheet primitive so the app shell does not
 * need to know the drawer's sizing or dismissal details.
 */
export function MobileNav() {
  const open = useUiStore((state) => state.mobileNavOpen);
  const setOpen = useUiStore((state) => state.setMobileNavOpen);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-[17rem] max-w-[85vw] gap-0 border-r p-0 lg:hidden">
        <MobileNavContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
