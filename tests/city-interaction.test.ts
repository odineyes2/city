import {it,expect} from 'vitest';
import {PointerGesture} from '../src/game/city/CityInteraction';
it('작은 클릭과 왕복 드래그를 구별하고 새 클릭 때 초기화한다',()=>{const g=new PointerGesture();g.down(10,10);g.move(13,12);expect(g.dragged).toBe(false);g.move(30,20);g.move(10,10);expect(g.dragged).toBe(true);g.down(0,0);expect(g.dragged).toBe(false);g.move(6,0);expect(g.dragged).toBe(true);});
