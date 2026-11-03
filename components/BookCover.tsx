import type { SummaryMeta } from "@/lib/types";
import { topicLabel } from "@/lib/types";

type CoverMeta = Pick<SummaryMeta, "title" | "titleUz" | "author" | "coverColor" | "topic"> & { coverImage?: string | null };

/**
 * Book cover in the Bookly style. Uses the summary's cover artwork when it has one,
 * otherwise draws a CSS cover (spine, page edge and gold bookmark ribbon).
 */
export function BookCover({ meta, size = "md" }: { meta: CoverMeta; size?: "sm" | "md" | "lg" }) {
  if (meta.coverImage) {
    return (
      <div className={`cover cover-${size} has-image`} style={{ ["--cover" as string]: meta.coverColor }} aria-hidden="true">
        <div className="cover-pages" />
        <div className="cover-front cover-art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={meta.coverImage} alt="" loading={size === "lg" ? "eager" : "lazy"} decoding="async" draggable={false} />
          <span className="cover-spine" />
        </div>
      </div>
    );
  }
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
