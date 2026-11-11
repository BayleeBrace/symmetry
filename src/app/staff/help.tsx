"use client";
import { useMemo, useState } from "react";
import { HELP_TOPICS, type HelpArticle, searchHelp } from "@/lib/help";

/** One how-to, opened and closed by tapping its title. */
function Article({ a, open }: { a: HelpArticle; open?: boolean }) {
  return (
    <details className="help-item" open={open}>
      <summary>
        <span>{a.title}</span>
        {a.owner && <span className="help-owner">Owner</span>}
      </summary>
      <ol className="help-steps">
        {a.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {a.note && <p className="help-note">{a.note}</p>}
    </details>
  );
}

/**
 * More, Help: how to do anything in the app. Type to search; with nothing
 * typed, everything is listed by topic. Barbers don't see the owner's
 * how-tos.
 */
export function Help({ owner }: { owner: boolean }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchHelp(query, { owner }), [query, owner]);
  const searching = query.trim().length > 0;
  return (
    <section className="help">
      <label className="help-search">
        <span className="sr-only">Search help</span>
        <input
          id="help-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search, e.g. squeeze, refund, rent"
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>
      {searching ? (
        results.length ? (
          <div className="help-list">
            <p className="staff-muted help-count">
              {results.length} {results.length === 1 ? "answer" : "answers"}
            </p>
            {results.map((a, i) => (
              <Article key={a.id} a={a} open={i === 0} />
            ))}
          </div>
        ) : (
          <p className="staff-muted help-none">
            Nothing matches “{query.trim()}”. Try one word, like card, move or
            rent.
          </p>
        )
      ) : (
        HELP_TOPICS.map((topic) => {
          const items = results.filter((a) => a.topic === topic);
          if (!items.length) return null;
          return (
            <div className="help-list" key={topic}>
              <h2 className="help-topic">{topic}</h2>
              {items.map((a) => (
                <Article key={a.id} a={a} />
              ))}
            </div>
          );
        })
      )}
    </section>
  );
}
