import { BookOpen } from "lucide-react";

type PageTurnLoaderProps = {
  label?: string;
  overlay?: boolean;
};

export default function PageTurnLoader({ label = "読み込み中", overlay = false }: PageTurnLoaderProps) {
  return (
    <div
      className={
        overlay
          ? "fixed inset-0 z-[120] flex items-center justify-center bg-white/70 backdrop-blur-sm"
          : "flex min-h-[60vh] items-center justify-center bg-white"
      }
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="open-book-loader" aria-hidden="true">
          <BookOpen className="h-14 w-14 text-gray-500" strokeWidth={1.9} />
        </div>
        <div className="flex items-center gap-1" aria-hidden="true">
          <span className="book-loading-dot" />
          <span className="book-loading-dot book-loading-dot--two" />
          <span className="book-loading-dot book-loading-dot--three" />
        </div>
        <p className="sr-only">{label}</p>
      </div>
    </div>
  );
}
