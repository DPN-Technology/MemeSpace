export type PinballFeatureId='left-orbit'|'spinner'|'right-orbit'|'left-lane'|'center-lane'|'right-lane'|'drop-bank';
export type PinballSensor={x:number;y:number;r:number};
export const PINBALL_FEATURES:Record<PinballFeatureId,PinballSensor>={
 'left-orbit':{x:102,y:190,r:22},spinner:{x:272,y:252,r:18},'right-orbit':{x:442,y:190,r:22},
 'left-lane':{x:185,y:105,r:16},'center-lane':{x:272,y:105,r:16},'right-lane':{x:359,y:105,r:16},'drop-bank':{x:272,y:350,r:28},
};
export const PINBALL_SENSORS=(Object.entries(PINBALL_FEATURES) as [PinballFeatureId,PinballSensor][]).filter(([id])=>id!=='drop-bank');
export const PINBALL_ORBITS={left:[[66,317],[72,251],[92,185],[118,135],[160,104],[209,96]],right:[[494,317],[488,251],[468,185],[442,135],[400,104],[351,96]]} as const;
export const PINBALL_LANES=[{x:185,y:105,label:'1'},{x:272,y:105,label:'2'},{x:359,y:105,label:'3'}] as const;
export const PINBALL_SPINNER={x1:244,y1:253,x2:300,y2:253};
export const PINBALL_DROP_TARGETS=[{x:224,y:350},{x:272,y:350},{x:320,y:350}] as const;
export const RAILS:number[][]=[
 [44,705,44,145],[44,145,78,69],[78,69,150,36],[150,36,448,36],[448,36,520,82],[520,82,536,140],[536,140,536,784],[536,784,491,784],[488,230,488,768],[488,230,461,202],
 [44,531,110,648],[110,648,160,680],[481,530,433,650],[433,650,401,680],[83,429,126,454],[126,454,111,515],[111,515,83,429],[444,429,402,454],[402,454,416,515],[416,515,444,429],
];

export function sweptFeatureTrigger(from:{x:number;y:number},to:{x:number;y:number},sensor:PinballSensor){
 const dx=to.x-from.x,dy=to.y-from.y,length=dx*dx+dy*dy;
 const t=length?Math.max(0,Math.min(1,((sensor.x-from.x)*dx+(sensor.y-from.y)*dy)/length)):0;
 const x=from.x+t*dx,y=from.y+t*dy;
 return Math.hypot(sensor.x-x,sensor.y-y)<=sensor.r;
}
