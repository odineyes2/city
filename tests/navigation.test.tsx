// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {useState} from 'react';
import {newGame,advance,dispatch} from '../src/engine';
import GameShell from '../src/game/GameShell';
vi.mock('../src/game/city/CityView',()=>({default:({onSelect,onView}:{onSelect:(id:number)=>void;onView:(v:'building')=>void})=><button onClick={()=>{onSelect(5);onView('building');}}>도시 건물 선택</button>}));
vi.mock('../src/game/building/BuildingView',()=>({default:({selected}:{selected:number})=><p>내부 건물 ID {selected}</p>}));
afterEach(cleanup);
function Harness(){const [game,setGame]=useState(()=>newGame(727,1000)),[selected,onSelect]=useState(0);return <GameShell game={game} act={c=>setGame(s=>dispatch(s,c).state)} step={()=>setGame(s=>advance(s))} selected={selected} onSelect={onSelect} notice="" saveError={false}><p>운영실 시간 {game.hour}</p><button onClick={()=>onSelect(1)}>운영실에서 건물 변경</button></GameShell>;}
describe('3개 화면의 공유 상태',()=>{
 it('도시를 기본 화면으로 표시하고 선택 건물을 내부에 전달한다',async()=>{const {container}=render(<Harness/>);expect(container.querySelector('[data-game-view=city]')).not.toBeNull();fireEvent.click(await screen.findByText('도시 건물 선택'));expect(await screen.findByText('내부 건물 ID 5')).toBeTruthy();});
 it('화면 변경 뒤 시간·마지막 선택을 유지하고 관리에서 내부로 복귀한다',async()=>{render(<Harness/>);fireEvent.click(screen.getByLabelText('1시간 진행'));fireEvent.click(screen.getByRole('button',{name:'관리'}));expect(screen.getByText('운영실 시간 1')).toBeTruthy();fireEvent.click(screen.getByText('운영실에서 건물 변경'));fireEvent.click(screen.getByRole('button',{name:'건물 내부'}));expect(await screen.findByText('내부 건물 ID 1')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'도시'}));await waitFor(()=>expect(screen.getByText('도시 건물 선택')).toBeTruthy());});
});

