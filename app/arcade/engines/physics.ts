export type Vec={x:number;y:number};
export type Body=Vec&{vx:number;vy:number;r:number};
export const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
export function closestPoint(p:Vec,a:Vec,b:Vec){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return {x:a.x+dx*t,y:a.y+dy*t,t}}
export function circleCollision(a:Body,b:Body,restitution=.96){
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),r=a.r+b.r;if(d>=r)return false;
 const nx=d?dx/d:1,ny=d?dy/d:0,overlap=(r-d)/2+.001;
 a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
 const relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(relative<0){const impulse=-(1+restitution)*relative/2;a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny}return true;
}
export function capsuleCollision(ball:Body,a:Vec,b:Vec,r=0,restitution=.85,surface:Vec={x:0,y:0}){
 const near=closestPoint(ball,a,b),dx=ball.x-near.x,dy=ball.y-near.y,d=Math.hypot(dx,dy),radius=ball.r+r;if(d>=radius)return false;
 const nx=d?dx/d:0,ny=d?dy/d:-1;ball.x=near.x+nx*(radius+.01);ball.y=near.y+ny*(radius+.01);
 const velocity=(ball.vx-surface.x)*nx+(ball.vy-surface.y)*ny;if(velocity<0){ball.vx-=(1+restitution)*velocity*nx;ball.vy-=(1+restitution)*velocity*ny}return true;
}
export function finiteBody(ball:Body){return [ball.x,ball.y,ball.vx,ball.vy].every(Number.isFinite)}
