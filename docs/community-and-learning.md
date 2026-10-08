# Community and learning

Open **Community Chat**, **Meme History**, **Memecoin History** or **Crypto Education** from the Meme Mind or workspace tabs. Existing local accounts, conversations, bookmarks and notes carry forward.

## Conversations that keep their context

- Choose general, memes, web3 or gaming. Counts reflect stored visible messages and their contributors; they are not online-presence indicators.
- Search the room's entire stored history by text or display name. Use **Older** and **Newer** to navigate pages, or narrow the view to replies and liked messages.
- **View replies** opens a message and its direct replies. Replying to a reply opens that conversation after sending so your new message stays visible.
- Press **Enter** to send or **Shift+Enter** to add a line. Normal drafts are kept separately for each account and room in the current browser session. Editing a sent message keeps that draft available when you save or cancel.
- Sign in through **Identity Center** to participate. Guests can read and explore replies. Existing rate limits, report handling and operator read-only controls remain in effect.
- Conversations refresh every five seconds. Moderated messages are excluded from history, search and reply previews; selected context is refreshed too.

## A reading list with useful context

The reading room contains twelve culture articles and seven memecoin guides. Filter by category, search the article body and examples, sort the index and use **Save** to keep an article in your reading list. Use **Saved** to remove it again.

Inside an article, the outline jumps to a section. A takeaway, practical example and reflection question help connect the idea to a real conversation. Selected articles link to primary references and further reading. **Copy link** preserves the article's direct location within your running MemeSpace site.

## A path through nine lessons

The path moves through **Foundations**, **Safer actions** and **Culture**. Each lesson includes an objective, explanation, practice exercise and knowledge check. Incorrect answers explain the concept and can be retried. Correct answers save completion when you are signed in.

Use the notes area to keep your own explanation or open question. Draft notes remain on the device; **Save notes** also stores them in your account's library. **Continue learning** opens the first unfinished lesson. Global search includes the articles, examples, objectives and lesson explanations.

The content is educational. No wallet connection or purchase is required to complete it.

## Verification for contributors

The normal repository suite includes real SQLite/API checks for stable pagination, historical search, filters and moderated context. The production browser suite checks sending and editing, draft restoration, nested replies, guest access, moderation, bookmark removal, notes, progress and mobile layout.

```sh
pnpm build
pnpm exec playwright install chromium
pnpm test:community-ui
```

`MEMESPACE_COMMUNITY_EVIDENCE_DIR` optionally saves desktop/mobile screenshots. The suite starts its own server with temporary test accounts and a disposable database.

Stop the running production server before rebuilding. The build command clears Next.js's generated route-response cache so a restarted server uses the new client bundle. Member data and backups are kept separately and are not removed.
