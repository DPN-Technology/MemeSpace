"use client";
import {useEffect, useRef, useState} from 'react';
import {useIdentityScope} from './identity-scope';

type SavedItem = {kind: string; item_key: string; payload: {title?: string; text?: string}; updated_at: number};

export function useLibrary() {
  const scope = useIdentityScope();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    const id = ++generation.current;
    const controller = new AbortController();
    setItems([]); setError(''); setLoading(true);
    if (scope === 'guest') {setLoading(false); return () => {generation.current++;};}
    void fetch('/api/saved', {signal: controller.signal}).then(async response => {
      const data = await response.json() as {items: SavedItem[]; error?: string};
      if (!response.ok) throw Error(data.error || 'Your library could not be loaded.');
      if (id === generation.current) setItems(data.items);
    }).catch(error => {
      if (!controller.signal.aborted && id === generation.current) setError(error.message);
    }).finally(() => {if (id === generation.current) setLoading(false);});
    return () => {generation.current++; controller.abort();};
  }, [scope]);

  async function write(kind: string, key: string, payload: unknown, method: 'POST' | 'DELETE') {
    if (pending.current) return false;
    if (loading) {setError('Your library is still loading. Try again in a moment.'); return false;}
    if (scope === 'guest') {setError('Sign in through Identity Center to save your reading and progress.'); return false;}
    const id = generation.current;
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/saved', {method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify({kind, key, payload})});
      const data = await response.json() as {error?: string};
      if (!response.ok) throw Error(data.error || 'Your change could not be saved. Try again.');
      if (id !== generation.current) return false;
      setItems(previous => {
        const remaining = previous.filter(item => !(item.kind === kind && item.item_key === key));
        return method === 'DELETE' ? remaining : [...remaining, {kind, item_key: key, payload: payload as SavedItem['payload'], updated_at: Date.now()}];
      });
      return true;
    } catch (error) {
      if (id === generation.current) setError(error instanceof Error ? error.message : 'Your change could not be saved.');
      return false;
    } finally {
      pending.current = false;
      if (id === generation.current) setBusy(false);
    }
  }
  return {items, error, busy, loading, save: (kind: string, key: string, payload: unknown) => write(kind, key, payload, 'POST'), remove: (kind: string, key: string) => write(kind, key, undefined, 'DELETE')};
}
