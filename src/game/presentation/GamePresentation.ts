// 저장/경제를 쓰지 않는 읽기 전용 투영. 렌더러에는 게임 명령이나 가변 GameState를 주지 않는다.
import type { BuildingStatus, Facility, GameState, Role, Stock, WorkArea } from '../../model';
import { economy, workerEfficiency } from '../../economy';
import { FACILITIES, STATUS_NAMES } from '../../data';
import { createBuildingLayout, type BuildingLayout, type RoomKind } from '../building/BuildingLayout';

export interface CityBuildingPresentation {
 id:number; name:string; type:string; position:[number,number,number]; status:BuildingStatus; statusName:string;
 owner:string; owned:boolean; known:boolean; reachable:boolean; facility:Facility|null; progress:number; condition:number;
 active:boolean; powered:boolean; workerCount:number; warning:string; accent:string;
}
export type AnimationState='idle'|'walking'|'working'|'resting'|'injured'|'repairing';
export interface ResidentPresentation {
 id:string;name:string;role:Role;health:number;injury:number;task:string;area:WorkArea|null;roomId:string;
 state:AnimationState;present:boolean;speed:number;equipment:number;
}
export interface RoomPresentation {
 id:string;kind:RoomKind;label:string;active:boolean;workers:string[];output:string;warning:string;progress:number|null;
}
export interface BuildingPresentation {
 id:number;name:string;status:BuildingStatus;statusName:string;facility:string;accessible:boolean;representative:boolean;
 layout:BuildingLayout;rooms:RoomPresentation[];residents:ResidentPresentation[];offsite:number;paused:boolean;progress:number;warning:string;
}
export interface GamePresentation { paused:boolean;city:CityBuildingPresentation[];interior:BuildingPresentation;warnings:string[] }
const kindForArea:Record<WorkArea,RoomKind>={food:'hydro',water:'pump',power:'generator',materials:'workshop',repair:'repair',guard:'security'};
const areaForKind:Partial<Record<RoomKind,WorkArea>>={hydro:'food',pump:'water',generator:'power',workshop:'materials',repair:'repair',security:'guard'};
const resourceNames:Record<keyof Stock,string>={food:'식량',water:'식수',power:'전력',materials:'자재'};
export const cityPosition=(x:number,y:number):[number,number,number]=>[(x-2)*20,0,(y-1.5)*20];
export function presentGame(s:GameState,selected=0):GamePresentation {
 const flow=economy(s),paused=!s.clock.speed||s.ended||s.pendingSuccession;
 const city=s.buildings.map(b=>{
  const info=flow.facilities[b.id],owned=b.owner==='player';
  return {id:b.id,name:b.status==='unknown'?'미탐사 구조물':b.name,type:b.type,position:cityPosition(b.x,b.y),status:b.status,statusName:b.project?.kind==='convert'?'시설 전환 중':STATUS_NAMES[b.status],owner:owned?'새벽 공동체':s.factions.find(f=>f.id===b.owner)?.name??'무주지',owned,known:b.status!=='unknown',reachable:s.buildings.some(a=>a.owner==='player'&&Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1),facility:b.facility,progress:b.progress,condition:b.structure,active:b.status==='operating',powered:b.id===0?flow.livingConsumption.power>0:!!info&&(info.powerDemand===0||info.powerUsed>0),workerCount:info?.workers.length??(b.id===0?Object.values(flow.assignments).filter(a=>a?.building===null).length:0),warning:info?.reason??'',accent:owned?'#98c1a1':s.factions.find(f=>f.id===b.owner)?.color??'#a2a08d'};
 });
 const b=s.buildings[selected]??s.buildings[0],layout=createBuildingLayout(b.id,b.type),accessible=b.owner==='player',home=b.id===0;
 const allOutput=Object.values(flow.facilities).reduce((sum,f)=>{for(const k of Object.keys(sum) as (keyof Stock)[])sum[k]+=f.output[k];return sum;},{food:0,water:0,power:0,materials:0});
 const toRoom=(kind:RoomKind)=>layout.floors.flatMap(f=>f.rooms).find(r=>r.kind===kind)??layout.floors[0].rooms[0];
 const residents=s.people.filter(p=>p.alive).map(p=>{
  const assignment=flow.assignments[p.id]??null,here=assignment?(assignment.building===b.id||home&&assignment.building===null):home;
  const injured=workerEfficiency(p)===0;
  const kind=injured?'infirmary':assignment?kindForArea[assignment.area]:p.morale<50?'housing':'entry';
  return {id:p.id,name:p.name,role:p.role,health:p.health,injury:p.injury,task:flow.jobs[p.id]??p.task,area:assignment?.area??null,roomId:toRoom(kind).id,state:injured?'injured':assignment?.area==='repair'?'repairing':assignment?'working':p.morale<50?'resting':'idle',present:accessible&&here,speed:p.injury>0?0.6:1,equipment:s.equipment} as ResidentPresentation;
 });
 const rooms=layout.floors.flatMap(f=>f.rooms).map(room=>{
  const area=areaForKind[room.kind],workers=residents.filter(p=>p.present&&p.roomId===room.id&&(p.state==='working'||p.state==='repairing')).map(p=>p.id);
  let output='',active=false,warning='',progress:number|null=null;
  if(home&&area&&area!=='repair'&&area!=='guard') {const value=flow.production[area]-allOutput[area];active=workers.length>0;output=`기초 ${resourceNames[area]} ${Math.max(0,value).toFixed(1)}/h`;}
  else if(home&&area==='guard'){active=workers.length>0;output='실제 쉘터 경계';}
  else if(room.kind==='repair'){active=b.status==='restoring';progress=active?b.progress:null;output=active?`${b.project?.kind==='convert'?'전환':'복구'} ${Math.round(b.progress)}%`:'미가동 공간 · 확장 기능 없음';}
  else if(!home&&room.id===toRoom(b.facility?kindForArea[FACILITIES[b.facility].resource??(b.facility==='barracks'?'guard':'repair')]:'repair').id){active=b.status==='operating';const info=flow.facilities[b.id];output=info?Object.entries(info.output).filter(([,v])=>v>0).map(([k,v])=>`${resourceNames[k as keyof Stock]} ${v.toFixed(1)}/h`).join(' · '):'';warning=info?.reason??'';}
  if(room.kind==='housing'){active=home||b.facility==='housing'&&b.status==='operating';output=home?'공동 생활 공간':'휴식 공간 · 독립 주거 효과 없음';}
  if(room.kind==='infirmary'){active=residents.some(p=>p.present&&p.state==='injured');output='회복 공간 · 의료 생산 없음';}
  if(room.kind==='stores')output='공용 보관 공간 · 추가 생산 없음';
  return {id:room.id,kind:room.kind,label:room.label,active:accessible&&active,workers,output,warning,progress};
 });
 return {paused,city,interior:{id:b.id,name:b.name,status:b.status,statusName:b.project?.kind==='convert'?'시설 전환 중':STATUS_NAMES[b.status],facility:b.facility?FACILITIES[b.facility].name:'미지정',accessible,representative:home,layout,rooms,residents,offsite:home?residents.filter(p=>!p.present).length:0,paused,progress:b.progress,warning:flow.facilities[b.id]?.reason??''},warnings:flow.warnings};
}
