import {it,expect,describe} from 'vitest';
import {createBuildingLayout} from '../src/game/building/BuildingLayout';
import {routeBetween,redirectMotion,moveResident,type Motion} from '../src/game/building/ResidentMovement';
import {residentPose} from '../src/game/building/ResidentAnimator';
const layout=createBuildingLayout(0,'shelter'),start=layout.nodes.find(n=>n.id===layout.entryNode)!,target=layout.floors[3].rooms[1].id;
const initial=():Motion=>({x:start.x,y:start.y,route:[],facing:1,walking:false});
describe('주민의 표시 이동과 리깅',()=>{
 it('층간 경로는 실제 계단 노드를 모두 통과한다',()=>{const path=routeBetween(layout,layout.entryNode,target);for(let i=0;i<=3;i++){const n=layout.nodes.find(n=>n.id===`b0:stair:${i}`)!;expect(path).toContainEqual({x:n.x,y:n.y});}expect(routeBetween(layout,'missing',target)).toEqual([]);});
 it('주민을 순간이동시키지 않고 경로 끝에 도착한다',()=>{let m=redirectMotion(initial(),layout,target,12);const before={x:m.x,y:m.y};m=moveResident(m,.1,1,false);expect(Math.hypot(m.x-before.x,m.y-before.y)).toBeLessThanOrEqual(6.51);for(let i=0;i<600;i++)m=moveResident(m,.1,1,false);const end=layout.nodes.find(n=>n.id===target)!;expect(m.x).toBe(end.x+12);expect(m.y).toBe(end.y);expect(m.walking).toBe(false);});
 it('작업 변경은 현재 위치를 보존하고 부상자는 천천히 이동한다',()=>{const a=redirectMotion(initial(),layout,target);const slow=moveResident(a,.1,.6,false),fast=moveResident(a,.1,1,false);expect(Math.hypot(slow.x-a.x,slow.y-a.y)).toBeLessThan(Math.hypot(fast.x-a.x,fast.y-a.y));const changed=redirectMotion(fast,layout,layout.floors[2].rooms[0].id);expect(changed.x).toBe(fast.x);expect(changed.y).toBe(fast.y);});
 it('일시정지는 이동을 그대로 보존하며 동작 유형별 자세가 다르다',()=>{const a=redirectMotion(initial(),layout,target);expect(moveResident(a,.1,1,true)).toBe(a);expect(residentPose('walking',.5,'food')).not.toEqual(residentPose('working',.5,'food'));expect(residentPose('injured',.5,null).sit).toBe(true);expect(residentPose('repairing',.5,'repair')).not.toEqual(residentPose('resting',.5,null));});
});
