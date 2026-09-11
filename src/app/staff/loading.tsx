"use client";
import type { ReactNode } from "react";

/** While a section fetches: a hairline with a sweep, the brand's cut, and a quiet word. */
export function Loading({ children }: { children?: ReactNode }) {
  return (
    <div className="staff-loading" role="status">
      <span className="loading-line" aria-hidden="true" />
      <span className="loading-text">{children ?? "Loading"}</span>
    </div>
  );
}
