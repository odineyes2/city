import type {WorldProps} from '../GameShell';
import type {GamePresentation} from '../presentation/GamePresentation';
export default function CityView({onView,presentation,onSelect}:WorldProps&{presentation:GamePresentation}) {
 return <div className="world-loading"><h1>새벽 지구 · 공간 렌더러 기반</h1><p>Phase A 연결 확인용 화면입니다. 최종 3D 도시가 아닙니다.</p><div>{presentation.city.map(b=><button key={b.id} onClick={()=>{onSelect(b.id);onView('building');}}>{b.name}</button>)}</div><button onClick={()=>onView('management')}>운영실 열기</button></div>;
}
