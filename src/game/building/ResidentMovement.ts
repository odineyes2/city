import type {BuildingLayout,Point} from './BuildingLayout';
export interface Motion extends Point {route:Point[];facing:number;walking:boolean}
export function routeBetween(layout:BuildingLayout,from:string,to:string):Point[]{
 const nodes=new Map(layout.nodes.map(n=>[n.id,n])),queue=[from],previous=new Map<string,string|null>([[from,null]]);
 for(let i=0;i<queue.length;i++){const id=queue[i];if(id===to)break;for(const next of nodes.get(id)?.neighbors??[])if(!previous.has(next)){previous.set(next,id);queue.push(next);}}
 if(!previous.has(to))return[];const ids:string[]=[];let id:string|null=to;while(id!==null){ids.unshift(id);id=previous.get(id)??null;}return ids.flatMap(id=>{const n=nodes.get(id);return n?[{x:n.x,y:n.y}]:[];});
}
export function redirectMotion(motion:Motion,layout:BuildingLayout,target:string,offset=0):Motion {
 const nearest=layout.nodes.reduce((best,n)=>Math.hypot(n.x-motion.x,n.y-motion.y)<Math.hypot(best.x-motion.x,best.y-motion.y)?n:best),route=routeBetween(layout,nearest.id,target);if(!route.length)return {...motion,route:[],walking:false};const end=route[route.length-1];route.push({x:end.x+offset,y:end.y});return{...motion,route,walking:true};
}
export function moveResident(motion:Motion,seconds:number,speed:number,paused:boolean):Motion {
 if(paused||seconds<=0)return motion;let budget=Math.min(seconds,.1)*65*speed,x=motion.x,y=motion.y,facing=motion.facing;const route=[...motion.route];
 while(route.length&&budget>0){const next=route[0],dx=next.x-x,dy=next.y-y,distance=Math.hypot(dx,dy);if(Math.abs(dx)>.1)facing=dx<0?-1:1;if(distance<=budget){x=next.x;y=next.y;budget-=distance;route.shift();}else{x+=dx/distance*budget;y+=dy/distance*budget;budget=0;}}
 return{x,y,route,facing,walking:route.length>0};
}
