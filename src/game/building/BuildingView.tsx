import type {WorldProps} from '../GameShell';
import type {GamePresentation} from '../presentation/GamePresentation';
export default function BuildingView({onView,presentation}:WorldProps&{presentation:GamePresentation}) {
 return <div className="world-loading"><h1>{presentation.interior.name}</h1><p>Phase A 내부 연결 확인용 화면입니다. 단면 렌더러는 Phase C에서 추가합니다.</p><button onClick={()=>onView('city')}>도시로 복귀</button><button onClick={()=>onView('management')}>건물 관리</button></div>;
}
