import {CircuitBoard,Gem,Orbit,Zap} from 'lucide-react';
import type {SymbolId} from './engines/slots';
export function SlotSymbol({id}:{id:SymbolId}){return <span className={'slot-symbol symbol-'+id} aria-label={id==='chip'?'Circuit':id==='gem'?'Crystal':id==='orbit'?'Orbit':id==='bolt'?'Lightning':'Neon seven'}>{id==='chip'?<CircuitBoard/>:id==='gem'?<Gem/>:id==='orbit'?<Orbit/>:id==='bolt'?<Zap/>:<b>7</b>}</span>}
