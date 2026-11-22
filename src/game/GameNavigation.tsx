import { Building2,Map,PanelsTopLeft } from 'lucide-react';
export type GameView='city'|'building'|'management';
export default function GameNavigation({view,onView}:{view:GameView;onView:(view:GameView)=>void}) {
 return <nav className="world-navigation" aria-label="게임 화면"><button aria-current={view==='city'?'page':undefined} onClick={()=>onView('city')}><Map size={16}/>도시</button><button aria-current={view==='building'?'page':undefined} onClick={()=>onView('building')}><Building2 size={16}/>건물 내부</button><button aria-current={view==='management'?'page':undefined} onClick={()=>onView('management')}><PanelsTopLeft size={16}/>관리</button></nav>;
}
