export type PoolPoint={x:number;y:number};
export type PoolDrag={pointerId:number;cue:PoolPoint;start:PoolPoint;current:PoolPoint};

const MIN_PULL=12;
const MAX_PULL=180;
const MAX_PRESS_DISTANCE=32;

export function dragToShot(cue:PoolPoint,release:PoolPoint):{angle:number;power:number}|null{
 const dx=release.x-cue.x,dy=release.y-cue.y,distance=Math.hypot(dx,dy);
 if(!Number.isFinite(distance)||distance<MIN_PULL)return null;
 return {angle:Math.atan2(-dy,-dx),power:Math.min(1,Math.max(.05,distance/MAX_PULL))};
}

export function beginPoolDrag(pointerId:number,press:PoolPoint,cue:PoolPoint,phase:'aim'|'rolling'|'placement'|'over'):PoolDrag|null{
 if(phase!=='aim'||!Number.isFinite(pointerId)||![press.x,press.y,cue.x,cue.y].every(Number.isFinite)||Math.hypot(press.x-cue.x,press.y-cue.y)>MAX_PRESS_DISTANCE)return null;
 return {pointerId,cue:{...cue},start:{...press},current:{...press}};
}

export function movePoolDrag(gesture:PoolDrag,pointerId:number,point:PoolPoint):PoolDrag{
 return pointerId===gesture.pointerId?{...gesture,current:{...point}}:gesture;
}

export function finishPoolDrag(gesture:PoolDrag,pointerId:number):{angle:number;power:number}|null{
 return pointerId===gesture.pointerId?dragToShot(gesture.cue,gesture.current):null;
}

export function cancelPoolDrag(_gesture:PoolDrag,_pointerId:number):null{return null}
