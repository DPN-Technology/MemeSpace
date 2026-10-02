'use client';
import {useEffect,useRef,useState} from 'react';
import type {RefObject} from 'react';
export type ArcadeStats={pinballBest:number;pinballRounds:number;poolBest:number;poolClears:number;poolWins:number;poolMatches:number};
export const emptyStats=():ArcadeStats=>({pinballBest:0,pinballRounds:0,poolBest:0,poolClears:0,poolWins:0,poolMatches:0});
export function readStats(scope:string):ArcadeStats{try{const value=JSON.parse(localStorage.getItem('memespace-arcade-stats:'+scope)||'{}'),out=emptyStats();for(const key of Object.keys(out) as (keyof ArcadeStats)[])if(Number.isSafeInteger(value[key])&&value[key]>=0&&value[key]<1e10)out[key]=value[key];return out}catch{return emptyStats()}}
export function saveStats(scope:string,change:(stats:ArcadeStats)=>ArcadeStats){const next=change(readStats(scope));try{localStorage.setItem('memespace-arcade-stats:'+scope,JSON.stringify(next))}catch{}return next}
export function useGameCanvas(width:number,height:number,draw:(ctx:CanvasRenderingContext2D)=>void,step:(dt:number)=>void,paused:boolean){
 const canvas=useRef<HTMLCanvasElement>(null),drawRef=useRef(draw),stepRef=useRef(step),pausedRef=useRef(paused);drawRef.current=draw;stepRef.current=step;pausedRef.current=paused;
 useEffect(()=>{const el=canvas.current;if(!el)return;const ctx=el.getContext('2d');if(!ctx)return;let frame=0,last=0,accumulator=0,scale=1;
  function resize(){const pixels=Math.max(1,Math.round(el!.clientWidth*Math.min(devicePixelRatio||1,2)));if(el!.width!==pixels){el!.width=pixels;el!.height=Math.round(pixels*height/width)}scale=pixels/width}
  const observer=new ResizeObserver(resize);observer.observe(el);resize();
  function tick(now:number){const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(!pausedRef.current&&!document.hidden){accumulator+=dt;let n=0;while(accumulator>=1/120&&n++<7){stepRef.current(1/120);accumulator-=1/120}}else accumulator=0;ctx!.setTransform(scale,0,0,scale,0,0);ctx!.clearRect(0,0,width,height);drawRef.current(ctx!);frame=requestAnimationFrame(tick)}
  frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);observer.disconnect()};
 },[width,height]);return canvas;
}
export function useAutoPause(onPause:()=>void){const ref=useRef(onPause);ref.current=onPause;useEffect(()=>{const hidden=()=>{if(document.hidden)ref.current()},blur=()=>ref.current();document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',blur);return()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',blur)}},[])}
export function useSound(){const ctx=useRef<AudioContext|null>(null),[enabled,setEnabled]=useState(false),enabledRef=useRef(enabled);enabledRef.current=enabled;
 useEffect(()=>()=>{void ctx.current?.close()},[]);
 function toggle(){if(!enabled){try{ctx.current??=new AudioContext();void ctx.current.resume();setEnabled(true)}catch{setEnabled(false)}}else setEnabled(false)}
 function tone(frequency=440,duration=.08,type:OscillatorType='sine'){if(!enabledRef.current||!ctx.current)return;try{const audio=ctx.current,osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(frequency*.6,audio.currentTime+duration);gain.gain.setValueAtTime(.07,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration)}catch{}}
 return {enabled,toggle,tone};
}
export function useFullscreen(ref:RefObject<HTMLElement|null>){const [full,setFull]=useState(false),[error,setError]=useState('');useEffect(()=>{const listener=()=>setFull(document.fullscreenElement===ref.current);document.addEventListener('fullscreenchange',listener);return()=>document.removeEventListener('fullscreenchange',listener)},[ref]);async function toggle(){try{setError('');if(document.fullscreenElement)await document.exitFullscreen();else if(ref.current?.requestFullscreen)await ref.current.requestFullscreen();else setError('Fullscreen is unavailable in this browser.')}catch{setError('Fullscreen is unavailable in this browser.')}}return {full,toggle,error,container:ref.current}}
export function canvasPoint(e:{clientX:number;clientY:number},canvas:HTMLCanvasElement,width:number,height:number){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*width,y:(e.clientY-r.top)/r.height*height}}
