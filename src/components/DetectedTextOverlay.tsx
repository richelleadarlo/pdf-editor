import { useState } from "react";
import type { DetectedTextItem } from "@/lib/pdf-types";
import { Pencil } from "lucide-react";

interface Props {
  item: DetectedTextItem;
  onEdit: (item: DetectedTextItem) => void;
}

export function DetectedTextOverlay({ item, onEdit }: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="absolute cursor-pointer"
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onEdit(item);
      }}
    >
      <div
        className={`h-full w-full rounded-sm transition-colors ${
          hovered ? "bg-primary/15 outline outline-1 outline-primary/60" : "bg-transparent"
        }`}
      />
      {hovered && (
        <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary shadow-sm">
          <Pencil className="h-2.5 w-2.5 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
