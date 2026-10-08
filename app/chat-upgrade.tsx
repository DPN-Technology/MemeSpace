"use client";

import {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, Edit3, Flag, Hash, Heart, MessageCircle, Reply, RotateCcw, Search, Send, Shield, Trash2, Users, X} from 'lucide-react';
import {useIdentityScope} from './identity-scope';
import {chatChannels, type ChannelId, type ChatMessage, type ChatPage} from './chat-types';

function draftKey(scope: string, channel: string) {
  return 'memespace-draft:' + scope + ':' + channel;
}
function readDraft(scope: string, channel: string) {
  try { return sessionStorage.getItem(draftKey(scope, channel)) || ''; } catch { return ''; }
}
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed.';
}
async function mutate(path: string, body: unknown, method = 'POST') {
  const response = await fetch('/api/' + path, {method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const data = await response.json() as {error?: string};
  if (!response.ok) throw Error(data.error || 'The community service is unavailable.');
}
function initials(name: string) {
  return name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'MS';
}

type MessageActions = {
  disabled: boolean;
  browsingDisabled: boolean;
  readOnly: boolean;
  onLike: (message: ChatMessage) => void;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onReport: (message: ChatMessage) => void;
  onThread: (id: string) => void;
};
function MessageCard({message, actions, root = false}: {message: ChatMessage; actions: MessageActions; root?: boolean}) {
  return <article className={'chat-message-card' + (root ? ' thread-root' : '')} data-message-id={message.id}>
    <div className="chat-message-avatar" aria-hidden="true">{initials(message.name)}</div>
    <div className="chat-message-content">
      <header><b>{message.name}</b>{message.mine && <span className="chat-you">you</span>}<time dateTime={new Date(message.created_at).toISOString()}>{new Date(message.created_at).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</time>{message.edited_at > 0 && <small>edited</small>}</header>
      {message.reply_to && <blockquote>{message.parent ? <button disabled={actions.browsingDisabled} onClick={() => actions.onThread(message.parent!.id)}><Reply/><span>{message.parent.name}: {message.parent.text.slice(0, 140)}</span></button> : <span>Original message unavailable</span>}</blockquote>}
      <p>{message.text}</p>
      <div className="chat-message-actions">
        <button disabled={actions.disabled} className={message.liked ? 'liked' : ''} aria-label={'Like message by ' + message.name} aria-pressed={message.liked} onClick={() => actions.onLike(message)}><Heart fill={message.liked ? 'currentColor' : 'none'}/>{message.likes > 0 ? message.likes : 'Like'}</button>
        <button disabled={actions.disabled || actions.readOnly} onClick={() => actions.onReply(message)}><Reply/>Reply</button>
        {message.mine ? <><button disabled={actions.disabled || actions.readOnly} onClick={() => actions.onEdit(message)}><Edit3/>Edit</button><button disabled={actions.disabled} onClick={() => actions.onDelete(message)}><Trash2/>Delete</button></> : <button disabled={actions.disabled} onClick={() => actions.onReport(message)}><Flag/>Report</button>}
        {!root && message.replyCount > 0 && <button className="chat-thread-link" onClick={() => actions.onThread(message.id)} disabled={actions.browsingDisabled}><MessageCircle/>View {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}</button>}
      </div>
    </div>
  </article>;
}

export function AdvancedChatRoom({openIdentity}: {openIdentity?: () => void}) {
  const scope = useIdentityScope();
  const [channel, setChannel] = useState<ChannelId>('general');
  const [page, setPage] = useState<ChatPage | null>(null);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [cursors, setCursors] = useState<string[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [synced, setSynced] = useState(0);
  const [away, setAway] = useState(false);
  const conversation = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const normalDraft = useRef('');
  const follow = useRef(true);
  const cursor = cursors.at(-1) || '';
  const contextId = reply?.id || editing?.id || '';
  const selected = chatChannels.find(item => item.id === channel)!;
  const stats = page?.channels.find(item => item.id === channel);
  const signedIn = page?.signedIn ?? scope !== 'guest';
  const readOnly = page?.readOnly ?? false;

  useEffect(() => {
    normalDraft.current = readDraft(scope, channel);
    setDraft(normalDraft.current);
    setReply(null); setEditing(null); setNotice(''); setActionError('');
    follow.current = true; setAway(false);
  }, [scope, channel]);

  useEffect(() => {
    if (search.trim() === query) return;
    const timer = setTimeout(() => {setQuery(search.trim()); setCursors([]);}, 300);
    return () => clearTimeout(timer);
  }, [search, query]);

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | undefined;
    setLoading(true); setPage(null); setConnectionError('');
    async function load() {
      controller?.abort();
      const request = new AbortController(); controller = request;
      const params = new URLSearchParams({channel, q: query, filter});
      if (cursor) params.set('before', cursor);
      if (threadId) params.set('thread', threadId);
      if (contextId) params.set('context', contextId);
      try {
        const response = await fetch('/api/chat?' + params, {signal: request.signal});
        const data = await response.json() as ChatPage & {error?: string};
        if (cancelled || request.signal.aborted) return;
        if (!response.ok) {
          if (response.status === 404 && threadId) {
            setThreadId(null); setReply(null); setEditing(null); setDraft(normalDraft.current);
            setNotice('That conversation is no longer available. Your draft is kept.');
          }
          throw Error(data.error || 'The conversation could not be loaded.');
        }
        if (contextId && !data.context) {
          setReply(null); setEditing(null); setDraft(normalDraft.current);
          setNotice('That message is no longer available. Your draft is kept.');
        } else if (contextId && data.context) {
          setReply(current => current?.id === contextId ? data.context : current);
        }
        setPage(data); setSynced(Date.now()); setConnectionError('');
      } catch (error) {
        if (!cancelled && !request.signal.aborted) {setConnectionError(errorMessage(error)); setPage(null);}
      } finally {
        if (!cancelled && !request.signal.aborted) setLoading(false);
      }
    }
    void load();
    const interval = setInterval(() => void load(), 5000);
    return () => {cancelled = true; controller?.abort(); clearInterval(interval);};
  }, [channel, query, filter, cursor, threadId, contextId, refreshKey]);

  useEffect(() => {
    if (follow.current && conversation.current) conversation.current.scrollTop = conversation.current.scrollHeight;
  }, [page]);

  function updateDraft(value: string) {
    setDraft(value);
    if (!editing) {
      normalDraft.current = value;
      try { sessionStorage.setItem(draftKey(scope, channel), value); } catch { /* The in-memory draft still works. */ }
    }
  }
  function cancelContext() {
    if (editing) setDraft(normalDraft.current);
    setEditing(null); setReply(null);
    composer.current?.focus();
  }
  function changeChannel(id: ChannelId) {
    setChannel(id); setSearch(''); setQuery(''); setFilter('all'); setCursors([]); setThreadId(null);
    normalDraft.current = readDraft(scope, id); setDraft(normalDraft.current);
    setReply(null); setEditing(null);
  }
  function viewThread(id: string | null) {
    cancelContext(); setThreadId(id); setCursors([]); setSearch(''); setQuery(''); setFilter('all');
    follow.current = true; setAway(false);
  }
  async function act(work: () => Promise<void>, success?: string) {
    if (busy) return;
    setBusy(true); setActionError(''); setNotice('');
    try {await work(); if (success) setNotice(success); setRefreshKey(value => value + 1);}
    catch (error) {setActionError(errorMessage(error));}
    finally {setBusy(false);}
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim() || readOnly || !signedIn) return;
    await act(async () => {
      await mutate('chat', editing ? {id: editing.id, text: draft} : {text: draft, channel, replyTo: reply?.id || threadId}, editing ? 'PATCH' : 'POST');
      if (editing) {
        setDraft(normalDraft.current);
      } else {
        if (threadId && reply && reply.id !== threadId) setThreadId(reply.id);
        normalDraft.current = ''; setDraft('');
        try { sessionStorage.removeItem(draftKey(scope, channel)); } catch {}
        setSearch(''); setQuery(''); setFilter('all'); setCursors([]);
      }
      setReply(null); setEditing(null); follow.current = true; setAway(false);
    }, editing ? 'Message updated. Your draft is ready below.' : 'Message sent.');
  }
  const actions: MessageActions = {
    disabled: busy || !signedIn,
    browsingDisabled: busy,
    readOnly,
    onLike: message => void act(() => mutate('chat/like', {id: message.id, enabled: !message.liked})),
    onReply: message => {if (readOnly) return; if (editing) setDraft(normalDraft.current); setEditing(null); setReply(message); composer.current?.focus();},
    onEdit: message => {if (readOnly) return; setEditing(message); setReply(null); setDraft(message.text); composer.current?.focus();},
    onDelete: message => void act(async () => {await mutate('chat', {id: message.id}, 'DELETE'); if (editing?.id === message.id) cancelContext(); if (threadId === message.id) viewThread(null);}, 'Message deleted.'),
    onReport: message => void act(() => mutate('reports', {messageId: message.id}), 'Report recorded for moderator review.'),
    onThread: viewThread,
  };

  return <div className="chat-upgrade">
    <aside className="chat-directory">
      <div className="chat-network-card"><p className="micro-label">THE COMMON FREQUENCY</p><h2>A little context.<br/>A better conversation.</h2><p>Find a room, follow a reply, and pick up where you left off.</p><span className="chat-room-count"><Hash/>4 community rooms</span></div>
      <nav className="chat-channel-map" aria-label="Community channels">{chatChannels.map(item => <button key={item.id} aria-label={'Open ' + item.id + ' channel'} aria-current={channel === item.id ? 'page' : undefined} className={channel === item.id ? 'selected' : ''} disabled={busy} onClick={() => changeChannel(item.id)}><Hash/><span><b>{item.id}</b><small>{item.title}</small></span><em>{page?.channels.find(c => c.id === item.id)?.messages ?? '–'}</em></button>)}</nav>
      <div className="chat-guidance"><Shield/><h3>Room to be curious.</h3><p>Give your message context. Credit creators. Keep personal details and wallet recovery phrases private.</p><p>Report a message when it needs a moderator’s attention.</p></div>
    </aside>
    <section className="chat-upgrade-main" aria-label={'Conversation in ' + channel}>
      <header className="chat-upgrade-header"><div><p className="micro-label">COMMUNITY / {channel.toUpperCase()}</p><h2>{selected.title}</h2><p>{selected.description}</p></div><span className="chat-channel-badge"><Hash/>{channel}</span></header>
      <div className="chat-signal-row"><span><MessageCircle/>{stats?.messages ?? '–'} messages</span><span><Users/>{stats?.voices ?? '–'} contributors</span><span className="chat-sync-status">{connectionError ? 'Connection interrupted' : loading ? 'Loading…' : 'Updated ' + new Date(synced).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span><button onClick={() => setRefreshKey(value => value + 1)} disabled={loading || busy} aria-label="Refresh conversation"><RotateCcw/></button></div>
      {threadId ? <div className="chat-thread-heading"><button disabled={busy} onClick={() => viewThread(null)}><ArrowLeft/>All messages</button><span>Replies to one message</span></div> : <div className="chat-toolbar">
        <label className="community-search"><Search/><input aria-label="Search channel messages" placeholder="Search all room history…" maxLength={100} value={search} disabled={busy} onChange={event => setSearch(event.target.value)}/>{search && <button disabled={busy} onClick={() => setSearch('')} aria-label="Clear message search"><X/></button>}</label>
        <select aria-label="Filter messages" disabled={busy} value={filter} onChange={event => {setFilter(event.target.value); setCursors([]);}}><option value="all">All messages</option><option value="replies">Replies</option><option value="liked">Liked messages</option></select>
      </div>}
      <div className="chat-history-nav"><span>{cursor ? 'Older history' : query ? 'Search results' : 'Latest conversation'} · {page?.messages.length ?? 0} shown</span><div><button disabled={!cursor || busy || loading} onClick={() => setCursors(previous => previous.slice(0, -1))}><ArrowLeft/>Newer</button><button disabled={!page?.nextCursor || busy || loading} onClick={() => {setCursors(previous => [...previous, page!.nextCursor!]); follow.current = false;}}>Older<ArrowRight/></button></div></div>
      <div className="chat-conversation" ref={conversation} role="log" aria-label="Messages" aria-live="polite" onScroll={event => {const el = event.currentTarget; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; setAway(!follow.current);}}>
        {page?.thread && <MessageCard message={page.thread} actions={actions} root/>}
        {page?.messages.map(message => <MessageCard key={message.id} message={message} actions={actions}/>)}
        {loading && <div className="chat-empty-state"><MessageCircle/><h3>Opening the conversation…</h3></div>}
        {!loading && page && !page.messages.length && <div className="chat-empty-state"><MessageCircle/><h3>{threadId ? 'Be the first to reply.' : query || filter !== 'all' ? 'No matching messages.' : 'Every good room starts with a hello.'}</h3><p>{query || filter !== 'all' ? 'Try another phrase or choose all messages.' : selected.prompt}</p>{!threadId && !query && filter === 'all' && signedIn && !readOnly && <button className="secondary-action" onClick={() => {updateDraft(draft ? draft + '\n' + selected.prompt : selected.prompt); composer.current?.focus();}}>Use this starter<Send/></button>}</div>}
      </div>
      {connectionError && <p className="error" role="alert">{connectionError}</p>}
      {(away || cursor) && <button className="secondary-action jump-latest" disabled={busy} onClick={() => {setCursors([]); follow.current = true; setAway(false); if (conversation.current) conversation.current.scrollTop = conversation.current.scrollHeight;}}>Jump to latest<ArrowRight/></button>}
      {(reply || editing) && <div className="chat-compose-context"><span>{editing ? 'Editing your message · your unsent draft is kept' : 'Replying to ' + reply?.name + ': ' + reply?.text.slice(0, 100)}</span><button disabled={busy} aria-label="Cancel reply or edit" onClick={cancelContext}><X/></button></div>}
      <form className="chat-composer-v3" onSubmit={send}><textarea ref={composer} aria-label="Message" rows={3} maxLength={1000} disabled={busy || readOnly || !signedIn} placeholder={readOnly ? 'Chat is temporarily read only' : !signedIn ? 'Sign in to join this conversation' : threadId ? 'Write a reply…' : 'Message #' + channel + '…'} value={draft} onChange={event => updateDraft(event.target.value)} onKeyDown={event => {if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault(); event.currentTarget.form?.requestSubmit();}}}/><button className="primary-action" aria-label={editing ? 'Save edited message' : 'Send message'} disabled={busy || readOnly || !signedIn || !draft.trim()}><Send/><span>{editing ? 'Save' : 'Send'}</span></button></form>
      <div className="chat-composer-footer"><span>{draft.length}/1000 · Enter sends · Shift+Enter adds a line</span>{readOnly ? <span>Read only</span> : !signedIn ? <button onClick={openIdentity}>Open Identity Center to join</button> : <span>Draft kept for this room</span>}</div>
      {actionError && <p className="error" role="alert">{actionError}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
    </section>
  </div>;
}
