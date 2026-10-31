import type { SummaryMeta } from "@/lib/types";
import { topicLabel } from "@/lib/types";

/** CSS-drawn book cover in the Bookly style: spine, page edge and gold bookmark ribbon. */
export function BookCover({ meta, size = "md" }: { meta: Pick<SummaryMeta, "title" | "titleUz" | "author" | "coverColor" | "topic">; size?: "sm" | "md" | "lg" }) {
  return (
    <div className={`cover cover-${size}`} style={{ ["--cover" as string]: meta.coverColor }} aria-hidden="true">
      <div className="cover-pages" />
      <div className="cover-front">
        <span className="cover-spine" />
        <span className="cover-ribbon" />
        <span className="cover-topic">{topicLabel(meta.topic)}</span>
        <span className="cover-title">{meta.title}</span>
        <span className="cover-author">{meta.author}</span>
      </div>
    </div>
  );
}
