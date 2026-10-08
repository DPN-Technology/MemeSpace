# Community and knowledge upgrade

Improve the existing MemeSpace application in its repository. Retain the DPN visual language with MemeSpace mint, lavender and dark surfaces.

## Chat

Four existing rooms gain descriptions, actual message/contributor counts, search across stored history, stable older/newer pages, liked/reply filters and focused reply views. Keep existing authenticated CRUD, moderation, reporting and five-message-per-minute limits. Hide moderated text everywhere, including reply previews. Editing or cancelling must preserve the normal draft for that account and channel. Clearly distinguish synchronization from presence; do not invent users or online counts.

## Information

Expand to twelve culture articles, seven memecoin field guides and nine lessons. Add practical examples and primary-source reading links, full-text discovery, category filters, reading lists, article outlines and related reading. Lessons have a visible path, explanatory knowledge checks, notes and persisted completion. Counts and global search use the shared catalog. Keep educational content distinct from investment advice.

## Constraints

- No new dependencies or schema migration.
- Preserve local accounts, SQLite storage, existing saved items and moderation.
- Desktop and 390px mobile layouts must remain usable with keyboard and touch.
- Repository publication is part of completion; verify before merging.

## Acceptance

Exercise the real API against a temporary SQLite database. In a production browser, send and reply, preserve drafts around editing, change rooms, toggle a bookmark, complete a lesson, revisit its progress, and discover new content through global search. Confirm mobile layout, typecheck, lint and the repository suite. Review and publish a focused PR; inspect finite commit checks rather than unbounded workflow polling.
