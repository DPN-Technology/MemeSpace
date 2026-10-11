# MemeSpace Connect — social network foundation

The dedicated social network is available on /social and via the Social Network node inside the Meme Mind. The existing Community Chat remains unchanged.

## Delivered

- Mobile and desktop feed with topic filters, latest/popular sorting, full-text search, author timelines, pagination, saved posts and following feed.
- Persistent accounts, posts, comments, likes, follows, saved posts, notifications and moderation reports using the existing SQLite identity model.
- In-place editing, deletion, guest browsing and account-only writes. Post creation is rate-limited and protected by same-origin sessions.
- Member directory and public bio from existing profiles; no invented profiles or simulated popularity counts.
- MemeSpace mint, violet and black theme. Responsive navigation and keyboard-accessible interaction.

## Architecture

- Drizzle journal entry 0005_social_network applies an additive database migration without clearing prior data.
- Social API in app/api/social/route.ts supports feed, thread, people and activity queries; POST create/react/bookmark/follow/report; PATCH and DELETE own posts.
- The existing chat_readonly setting pauses social post and reply creation and editing.
- Data is local to the running instance, not globally hosted or synchronized across different instances.

## Validation

Run pnpm lint, pnpm typecheck, pnpm test, pnpm build, pnpm security:gate.
Use pnpm test:social-api (requires installed dependencies) for the HTTP integration test.

## Member identity, blocking and muting

- Public profile API serves actual member display name, biography, joined date, post count and social graph counts. The social interface adds a reusable profile panel and deep links.
- Blocks enforce mutual feed and thread visibility, stop new follows and remove existing follows in either direction. Unblocking does not automatically recreate follows.
- Mutes filter the muted member from a viewer's feed and activity, while other members can still read their content.
- The additive relationship migration stores these preferences. Account export includes block and mute relationships, and account deletion removes both outgoing and incoming records. Tests cover these security and lifecycle rules.

## Next direction (not implemented in this draft)

Public profile pages with custom handles and avatars; media uploads and image moderation; hashtag indexing, mentions and reshares; block/mute/privacy settings; integrated Control Center social moderation queue; public scale and real-time notifications.

## Moderation and data lifecycle (second foundation)

The Control Center Moderation queue includes reports from both chat and the new social feed. Authorized moderators can hide social posts and their direct replies, or resolve, dismiss and reopen reports; actions are audit logged. Social moderation decisions are stored independently from chat.

Account export includes social posts, reactions, bookmarks, follows and reports. Account deletion transactionally removes the member's posts and social graph references, and hides other members' replies when their parent posts disappear, without deleting those members' owned replies.

A dedicated social-post restoration UI, block/mute tools and richer reporting reasons remain future work.
