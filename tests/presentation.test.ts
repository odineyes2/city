import {describe,it,expect} from 'vitest';
import {newGame,dispatch,advance} from '../src/engine';
import {presentGame} from '../src/game/presentation/GamePresentation';
import {createBuildingLayout} from '../src/game/building/BuildingLayout';
const freeze=(value:object)=>{Object.freeze(value);Object.values(value).forEach(v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v))freeze(v);});};
describe('시각화 투영',()=>{
 it('20개 기존 ID·좌표를 독립된 도시 위치로 투영하며 미발견 정보를 숨긴다',()=>{
  const s=newGame(727,1000),p=presentGame(s);expect(p.city).toHaveLength(20);expect(p.city.map(b=>b.id)).toEqual(s.buildings.map(b=>b.id));expect(new Set(p.city.map(b=>b.position.join(','))).size).toBe(20);expect(p.city[19].name).toBe('미탐사 구조물');expect(p.city[0].owned).toBe(true);
 });
 it('동결한 상태를 읽기만 하며 자원·경제·저장 구조를 변경하지 않는다',()=>{
  const s=newGame(727,1000),before=JSON.stringify(s);freeze(s);presentGame(s,0);presentGame(s,5);expect(JSON.stringify(s)).toBe(before);expect(s.version).toBe(2);
 });
 it('실제 확보와 복구·시설 전환 상태를 반영한다',()=>{
  let s=newGame(727,1000);s=dispatch(s,{type:'negotiate',building:1}).state;s=dispatch(s,{type:'facility',building:1,facility:'farm'}).state;s=dispatch(s,{type:'restore',building:1}).state;
  expect(presentGame(s,1).city[1].status).toBe('restoring');s=advance(s,5);expect(presentGame(s,1).city[1].active).toBe(true);s=dispatch(s,{type:'facility',building:1,facility:'pump'}).state;expect(presentGame(s,1).city[1].statusName).toBe('시설 전환 중');expect(presentGame(s,1).city[1].active).toBe(false);
 });
 it('대표 쉘터에 안정적인 5층·방·연결 경로를 생성한다',()=>{
  const a=createBuildingLayout(0,'shelter'),b=createBuildingLayout(0,'shelter');expect(a).toEqual(b);expect(a.floors).toHaveLength(5);const ids=new Set(a.nodes.map(n=>n.id));for(const n of a.nodes)for(const id of n.neighbors)expect(ids.has(id)).toBe(true);expect(new Set(a.floors.flatMap(f=>f.rooms.map(r=>r.kind)))).toContain('hydro');
 });
 it('주민 ID·작업·부상·사망·일시정지는 실제 상태에서 파생한다',()=>{
  let s=dispatch(newGame(727,1000),{type:'speed',speed:1}).state;let p=presentGame(s);expect(p.interior.residents.filter(r=>r.present).length).toBe(10);expect(p.interior.residents.some(r=>r.area==='food'&&r.state==='working')).toBe(true);
  s.people[1].injury=90;p=presentGame(s);expect(p.interior.residents.find(r=>r.id==='p1')?.state).toBe('injured');s.people[1].alive=false;s.people[1].health=0;expect(presentGame(s).interior.residents.some(r=>r.id==='p1')).toBe(false);s.clock.speed=0;expect(presentGame(s).paused).toBe(true);
 });
});
