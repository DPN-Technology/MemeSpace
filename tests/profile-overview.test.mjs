import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase } from '../lib/local-database.mjs';
import { createAccount } from '../lib/local-auth.mjs';
import { computeAchievements, getProfileOverview, setWalletVisibility } from '../lib/profile-overview.mjs';

function withDb(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'memespace-profile-'));
  const previous = process.env.MEMESPACE_DATA_DIR;
  process.env.MEMESPACE_DATA_DIR = dir;
  const db = openDatabase(process.cwd());
  try { return fn(db); } finally { db.close(); process.env.MEMESPACE_DATA_DIR = previous ?? ''; rmSync(dir, { recursive: true, force: true }); }
}
const user = (db, n) => createAccount(db, { identifier: `${n}@example.com`, displayName: n, password: 'correct horse battery' }).userId;
const post = (db, id, userId, o = {}) => db.prepare('INSERT INTO social_posts(id,user_id,body,topic,reply_to,created_at,hidden_at,community_id) VALUES(?,?,?,?,?,?,?,?)')
  .run(id, userId, 'hi', 'general', o.replyTo ?? null, 1, o.hidden ?? 0, o.community ?? null);

test('achievements report progress and cap at the goal', () => {
  const list = computeAchievements({ posts: 12, followers: 0, reactions: 100 });
  const by = Object.fromEntries(list.map((a) => [a.id, a]));
  assert.equal(by['first-post'].earned, true);
  assert.equal(by['ten-posts'].earned, true);
  assert.equal(by['fifty-posts'].earned, false);
  assert.equal(by['fifty-posts'].progress, 12);
  assert.equal(by.reacted.progress, 25);
  assert.equal(by['first-follower'].earned, false);
  assert.equal(computeAchievements(null).every((a) => !a.earned), true);
});

test('overview counts only visible original posts, replies, reactions and follows', () => withDb((db) => {
  const a = user(db, 'a'), b = user(db, 'b'), c = user(db, 'c');
  post(db, 'p1', a); post(db, 'p2', a); post(db, 'p3', a, { hidden: 1 }); post(db, 'r1', a, { replyTo: 'p1' });
  db.prepare('INSERT INTO social_reactions(user_id,post_id,created_at) VALUES(?,?,?)').run(b, 'p1', 1);
  db.prepare('INSERT INTO social_reactions(user_id,post_id,created_at) VALUES(?,?,?)').run(a, 'p1', 1);
  db.prepare('INSERT INTO social_reactions(user_id,post_id,created_at) VALUES(?,?,?)').run(c, 'p3', 1);
  db.prepare('INSERT INTO social_follows(follower_id,following_id,created_at) VALUES(?,?,?)').run(b, a, 1);
  db.prepare('INSERT INTO social_follows(follower_id,following_id,created_at) VALUES(?,?,?)').run(a, c, 1);
  const o = getProfileOverview(db, a, b);
  assert.deepEqual([o.stats.posts, o.stats.replies, o.stats.reactions, o.stats.followers, o.stats.following], [2, 1, 1, 1, 1]);
  assert.equal(o.mine, false);
  assert.equal(getProfileOverview(db, a, a).mine, true);
}));

test('unknown, deleted and blocking users hide the profile', () => withDb((db) => {
  const a = user(db, 'a'), b = user(db, 'b');
  assert.equal(getProfileOverview(db, 'usr_missing', a), null);
  db.prepare("INSERT INTO social_relationships(actor_id,target_id,kind,created_at) VALUES(?,?,'block',1)").run(a, b);
  assert.equal(getProfileOverview(db, a, b), null);
  assert.notEqual(getProfileOverview(db, b, a), null);
  db.prepare('UPDATE accounts SET deleted_at=1 WHERE user_id=?').run(b);
  assert.equal(getProfileOverview(db, b, a), null);
}));

test('wallet addresses are private until the owner opts in', () => withDb((db) => {
  const a = user(db, 'a'), b = user(db, 'b');
  db.prepare('INSERT INTO wallet_links(address,user_id,linked_at,last_used_at) VALUES(?,?,?,?)').run('Addr1111', a, 1, 1);
  let seen = getProfileOverview(db, a, b);
  assert.deepEqual([seen.wallets, seen.stats.wallets, seen.walletsVisible], [[], 0, false]);
  assert.equal(seen.achievements.find((x) => x.id === 'wallet').earned, false);
  assert.equal(getProfileOverview(db, a, a).wallets.length, 1);
  setWalletVisibility(db, a, true);
  seen = getProfileOverview(db, a, b);
  assert.deepEqual([seen.wallets.map((w) => w.address), seen.achievements.find((x) => x.id === 'wallet').earned], [['Addr1111'], true]);
  setWalletVisibility(db, a, false);
  assert.deepEqual(getProfileOverview(db, a, b).wallets, []);
}));

test('private communities are only listed for the owner or fellow members', () => withDb((db) => {
  const a = user(db, 'a'), b = user(db, 'b'), c = user(db, 'c');
  const add = (id, vis) => db.prepare('INSERT INTO social_communities(id,slug,name,description,owner_id,created_at,updated_at,visibility) VALUES(?,?,?,?,?,1,1,?)').run(id, id, id, '', a, vis);
  add('pub', 'public'); add('priv', 'private');
  for (const id of ['pub', 'priv']) db.prepare("INSERT INTO social_community_members(community_id,user_id,role,joined_at) VALUES(?,?,'member',1)").run(id, a);
  db.prepare("INSERT INTO social_community_members(community_id,user_id,role,joined_at) VALUES('priv',?,'member',2)").run(b);
  const names = (viewer) => getProfileOverview(db, a, viewer).communities.map((x) => x.slug).sort();
  assert.deepEqual(names(c), ['pub']);
  assert.deepEqual(names(b), ['priv', 'pub']);
  assert.deepEqual(names(a), ['priv', 'pub']);
  assert.deepEqual(names(''), ['pub']);
}));
