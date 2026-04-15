import { Button } from "@/components/ui/button";

interface Props {
  pageCount: number;
  currentPage: number;
  editCountByPage: Record<number, number>;
  onSelectPage: (page: number) => void;
}

export function PageNavigator({ pageCount, currentPage, editCountByPage, onSelectPage }: Props) {
  if (pageCount <= 1) return null;

  return (
    <aside className="border-b border-border/70 bg-card/80 backdrop-blur md:w-24 md:flex-none md:border-b-0 md:border-r">
      <div className="flex gap-2 overflow-x-auto px-3 py-3 md:flex-col md:overflow-y-auto md:px-2">
        {Array.from({ length: pageCount }, (_, index) => {
          const page = index + 1;
          const isActive = page === currentPage;
          const editCount = editCountByPage[page] ?? 0;

          return (
            <Button
              key={page}
              variant={isActive ? "toolbarActive" : "outline"}
              size="sm"
              className="h-auto min-w-16 flex-col gap-1 px-2 py-2 md:min-w-0"
              onClick={() => onSelectPage(page)}
            >
              <span className="text-[11px] uppercase tracking-[0.22em] text-current/70">Page</span>
              <span className="text-sm font-semibold">{page}</span>
              <span className="text-[11px] text-current/70">
                {editCount} edit{editCount === 1 ? "" : "s"}
              </span>
            </Button>
          );
        })}
      </div>
    </aside>
  );
}
