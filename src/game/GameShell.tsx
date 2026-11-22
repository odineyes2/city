import { lazy,Suspense,useMemo,useState,type ReactNode } from 'react';
import type { Command,GameState } from '../model';
import GameNavigation,{type GameView} from './GameNavigation';
import GameHUD from './hud/GameHUD';
import ManagementView from '../management/ManagementView';
import {presentGame} from './presentation/GamePresentation';
import './world.css';
const CityView=lazy(()=>import('./city/CityView'));
const BuildingView=lazy(()=>import('./building/BuildingView'));
export interface WorldProps {game:GameState;act:(c:Command)=>void;selected:number;onSelect:(id:number)=>void;onView:(view:GameView)=>void}
export default function GameShell({game,act,step,selected,onSelect,notice,saveError,children}:{game:GameState;act:(c:Command)=>void;step:()=>void;selected:number;onSelect:(id:number)=>void;notice:string;saveError:boolean;children:ReactNode}) {
 const [view,setView]=useState<GameView>('city'),presentation=useMemo(()=>presentGame(game,selected),[game,selected]);
 if(view==='management')return <ManagementView onView={setView}>{children}</ManagementView>;
 return <div className={`world-shell ${view}-mode`} data-game-view={view}><GameHUD game={game} act={act} step={step}/><GameNavigation view={view} onView={setView}/><Suspense fallback={<div className="world-loading" role="status">지구 기록을 불러오는 중…</div>}>{view==='city'?<CityView game={game} act={act} selected={selected} onSelect={onSelect} onView={setView} presentation={presentation}/>:<BuildingView game={game} act={act} selected={selected} onSelect={onSelect} onView={setView} presentation={presentation}/>}</Suspense>{(notice||saveError)&&<div className="world-notice" role="status">{saveError?'저장 오류 · 관리 화면에서 진행을 내보내세요.':notice}</div>}{game.offlineSummary&&<details className="world-offline"><summary>부재 중 공동체 기록</summary><p>{game.offlineSummary}</p></details>}{(game.ended||game.pendingSuccession)&&<div className="world-decision"><h2>{game.pendingSuccession?'지도자 계승 결정 대기':'공동체 여정 종료'}</h2><p>시간이 중단되었습니다. 운영실에서 기록과 다음 결정을 확인하세요.</p><button onClick={()=>setView('management')}>관리 화면에서 확인</button></div>}</div>;
}
