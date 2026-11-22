// 렌더링 전용 고정 단면도. 층/방/경로 ID는 안정적이며 저장 데이터에는 추가하지 않는다.
export type RoomKind='entry'|'security'|'stores'|'housing'|'infirmary'|'hydro'|'workshop'|'pump'|'generator'|'repair';
export interface Point {x:number;y:number}
export interface RoomLayout {id:string;floor:number;kind:RoomKind;label:string;x:number;y:number;width:number;height:number;work:Point}
export interface FloorLayout {id:string;index:number;label:string;y:number;rooms:RoomLayout[]}
export interface PathNode extends Point {id:string;neighbors:string[]}
export interface BuildingLayout {buildingId:number;width:number;height:number;floors:FloorLayout[];nodes:PathNode[];entryNode:string}
const names:Record<RoomKind,string>={entry:'환승역 출입구',security:'경계실',stores:'보급 창고',housing:'공동 생활실',infirmary:'회복 구역',hydro:'기초 수경 재배실',workshop:'공용 정비 작업장',pump:'기초 정수 설비',generator:'수동·보조 발전실',repair:'미복구 구획'};
export function createBuildingLayout(id:number,type:string):BuildingLayout {
 const kinds:RoomKind[][]=id===0?[['entry','security','stores'],['housing','infirmary'],['hydro','workshop'],['pump','generator'],['repair']]:[['entry','security'],['hydro','workshop','pump','generator','housing'],['repair','infirmary']];
 // 축소 내부도는 다양한 시설의 위치 후보를 두되 비가동 공간을 명시한다.
 const width=1140,height=kinds.length*150+95,nodes:PathNode[]=[],floors:FloorLayout[]=[];
 for(let i=0;i<kinds.length;i++) {
  const y=70+i*150,stair:PathNode={id:`b${id}:stair:${i}`,x:i%2?125:65,y:y+112,neighbors:[]};
  nodes.push(stair);
  if(i>0){const previous=nodes.find(n=>n.id===`b${id}:stair:${i-1}`)!;stair.neighbors.push(previous.id);previous.neighbors.push(stair.id);}
  const roomWidth=900/kinds[i].length;
  const rooms=kinds[i].map((kind,j)=>{
   const roomId=`b${id}:floor:${i}:room:${j}:${kind}`,work={x:195+j*roomWidth+roomWidth*.52,y:y+112};
   const node:PathNode={...work,id:roomId,neighbors:[stair.id]};nodes.push(node);stair.neighbors.push(node.id);
   return {id:roomId,floor:i,kind,label:names[kind],x:180+j*roomWidth,y,width:roomWidth-8,height:136,work};
  });
  floors.push({id:`b${id}:floor:${i}`,index:i,label:id===0?i===0?'지상 출입층':`B${i} · 지하 ${i}층`:`${kinds.length-i}F · ${type==='residential'?'주거동':'시설동'}`,y,rooms});
 }
 return {buildingId:id,width,height,floors,nodes,entryNode:floors[0].rooms[0].id};
}
