import {CircuitBoard,Gem,Orbit,Zap,Star,Sparkles} from 'lucide-react';
import type {SymbolId} from './engines/slots';
export function SlotSymbol({id}:{id:SymbolId}){return <span className={'slot-symbol symbol-'+id} aria-label={id==='circuit'?'Circuit':id==='crystal'?'Crystal':id==='orbit'?'Orbit':id==='lightning'?'Lightning':id==='wild'?'Wild':id==='scatter'?'Scatter':'Neon seven'}>{id==='circuit'?<CircuitBoard/>:id==='crystal'?<Gem/>:id==='orbit'?<Orbit/>:id==='lightning'?<Zap/>:id==='wild'?<Star/>:id==='scatter'?<Sparkles/>:<b>7</b>}</span>}
