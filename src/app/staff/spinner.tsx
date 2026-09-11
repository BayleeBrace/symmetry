"use client";
import type { ReactNode } from "react";

/** While a section fetches: the wordmark drawn in by a cut, over and over, and a quiet word. */
export function Loading({ children }: { children?: ReactNode }) {
  return (
    <div className="staff-loading" role="status">
      <span className="loading-mark" aria-hidden="true" />
      <span className="loading-text">{children ?? "Loading"}</span>
    </div>
  );
}
