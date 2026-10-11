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

## Quote posts and hashtag discovery (social content phase)

- Quote another visible post with your own commentary. The preview follows existing block, mute, deleted/suspended account and moderation visibility checks; inaccessible quoted content is not revealed.
- Create and edit operations transactionally maintain indexed normalized hashtags. The feed accepts a strict hashtag filter, and a real trending-tags endpoint ranks tags on visible published posts.
- Quoted source deletion does not delete the quoting member's own post. Instead, the shared source preview becomes unavailable. Quote references and personal hashtags are included in account exports, while deletion removes the account's hashtag records.
- Hashtag indexing starts with new or edited posts in this migration; older posts remain full-text searchable but need a backfill before appearing in hashtag trends.

## Native image posting (media phase)

- Attach PNG, JPEG or GIF images to feed posts (including image-only posts) and quote posts. Images are persisted in the same local SQLite instance, not fetched from external third-party URLs.
- The upload route requires an authenticated same-origin session and Content-Length bounds. Files must match an allowed magic signature and embedded dimensions of 1–4096 pixels, be no larger than 2 MiB, and stay within a per-account 100-image cap.
- Binary reads recheck post moderation, account status, block/mute relationships and parent visibility. Responses set a fixed verified image MIME, no content sniffing and no caching.
- A failed image upload does not create a post. Deleting your own image post purges its binary bytes; deleting an account removes every image that account uploaded. Account exports include image metadata, not binary image contents. Image file metadata may be present in uploads; remove private EXIF information before publishing. Images are not automatically resized.
- Unsupported: SVG, videos, WebP, a global hosting/CDN layer, automatic image screening, and animations larger than the per-file limit.

## Creator communities (community phase)
- Public creator communities with unique URL slugs, details, join/leave membership, dedicated feeds, member roster, and creator-controlled information.
- Owners can assign and demote moderators. Owners and moderators can ban members and remove community posts; moderators cannot ban moderators or remove owner content.
- Joining is required to publish or reply inside a community, including image uploads; banned accounts cannot rejoin. Moderation records prevent removed posts and their media from being displayed.
- Community data is stored locally; no private groups, ownership transfer, or externally hosted community network yet. When an owner closes an account, the community is disbanded without deleting other members' posts.

## Next direction (not implemented in this draft)

Public profile pages with custom handles and avatars; media uploads and image moderation; hashtag indexing, mentions and reshares; block/mute/privacy settings; integrated Control Center social moderation queue; public scale and real-time notifications.

## Moderation and data lifecycle (second foundation)

The Control Center Moderation queue includes reports from both chat and the new social feed. Authorized moderators can hide social posts and their direct replies, or resolve, dismiss and reopen reports; actions are audit logged. Social moderation decisions are stored independently from chat.

Account export includes social posts, reactions, bookmarks, follows and reports. Account deletion transactionally removes the member's posts and social graph references, and hides other members' replies when their parent posts disappear, without deleting those members' owned replies.

A dedicated social-post restoration UI, block/mute tools and richer reporting reasons remain future work.

## Private creator spaces and ownership (phase 7)

- New communities may be Public (instant membership) or Private (members-only posts and member roster). Existing communities remain public after the additive migration. Private community names and descriptions are discoverable so prospective members can request entry.
- Private joins create pending requests; applicants can cancel, and owners/moderators can approve or deny. Approval inserts membership transactionally, requiring an active account and no community ban.
- The social API filters private posts from global/followed/saved/author feeds, direct threads, quote previews, hashtag trends, community feeds, and activity notifications unless the viewer is an approved member. Binary image reads and source quote checks enforce the same policy.
- Owners may change visibility and transfer ownership to an existing active member with the exact phrase TRANSFER OWNERSHIP. Ownership and role changes are transactional, with the previous owner retained as a moderator; transfer history records the change.
- Account data export and deletion include pending requests and transfer records. This is locally persisted SQLite permissioning, not end-to-end encryption or a globally hosted network.

## Community Trust Center (moderation phase)

- Communities have a dedicated Trust Center for **open post reports**, **member appeals**, **active removals**, and a **recent decision history**. The moderator dashboard requires an active owner or moderator membership, even for public communities.
- Reviewed reports may be resolved, dismissed, or used to remove a post. These decisions are recorded in the existing social reports queue and an append-only moderation event timeline. Community moderators may not remove owner-authored posts.
- Members can appeal an active post removal they authored or their own active community ban. One pending appeal per decision and at most four submitted appeals per day limit repeat submissions. Members see only their own appeals, while moderators see the queue; reviewers cannot decide their own appeals.
- Approving a removed-post appeal restores visibility by deleting the community removal record. Approving a ban appeal removes the ban without silently reinstating membership. Denial preserves the decision. Direct restoration closes pending appeals about that removal. **Platform-hidden or deleted posts cannot be restored by community moderators.**
- Decision history records actor, action, target, note and timestamp. Account export includes personal appeals and actions; account deletion purges affected member records and disbanded-community logs. Current history is limited to recent entries and is not a tamper-proof external audit service.
- HTTP integration tests cover report review, unauthorized access, duplicate appeals, approval, denial, bans, media restoration, and audit events. These controls are local-instance functionality; no automated content scanning or cross-instance arbitration is implied.

## MemeSpace Signal Inbox and creator mentions (notification phase)

- Social reactions, replies, follows and posts mentioning an existing **@creator_handle** create persisted in-app inbox events. Uploaded image posts also accept mention tags in captions. A creator may claim a unique handle (3–24 lowercase characters, starting with a letter), with a seven-day cooldown before changing it.
- Community membership reviews, bans, unbans, post removal/restoration and appeals also create in-app notifications for affected members. Members can choose categories independently: social, mentions, communities or moderation.
- Each account has its own read/unread state, count endpoint, mark-one/all-read actions, filtered inbox, pagination and up to 300 recent stored events. Notification writes are grouped transactionally with their underlying actions.
- The client checks for updated counts and inbox items every 20 seconds while active. **This is near-live polling, not WebSockets, email, SMS, browser push or a background service worker.**
- Notification creation and retrieval respect account status, blocking/muting and private-community post access. Leaving a private community removes visibility of linked post notifications. Account export includes owned handles, preferences and delivered notifications; deletion clears the member's identifiers and relevant references.
- Mentions are emitted for initial post creation; edits do not retroactively create notifications. Handles are opt-in, and a nonexistent handle does not trigger an alert.

## Creator profiles and profile media (identity phase)

- Member timelines now include a creator identity page with editable display name, bio, one-line headline, optional location and website, interests, color accent (mint/violet/coral/amber), follower counts, profile link, and real uploaded avatar/banner.
- Profile avatars (maximum 512 KiB) and banners (maximum 2 MiB) accept PNG/JPEG/GIF validated by signature and image dimensions (1–4096 pixels per side). No SVG/HTML, external image fetches or arbitrary content sniffing. Images are stored locally in SQLite, served with no-store/nosniff and bilateral block checks.
- Only the logged-in profile owner can edit or remove profile media. Removing an image deletes the original stored binary. Public profiles and images are available to signed-out readers unless blocked; they are not private storage.
- Creator metadata is included in account exports; image bytes are not included in exports, and closing an account deletes stored profile media. Existing post and social graphs are unchanged.
- Existing creator handles are maintained in the notifications settings, with the one-change-per-seven-days rule. Hosted image CDNs, automated image moderation, profile verification badges and crop editing remain future work.
