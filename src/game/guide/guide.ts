// 서린의 읽기 전용 안내. 실제 엔진 상태를 설명하며 생산·주민·정치 결정을 실행하지 않는다.
import type { GameState } from "../../model";
import { titleRequirements } from "../../engine";
import type { GamePresentation } from "../presentation/GamePresentation";

export type GuideTopic = "intro" | "status" | "economy" | "people" | "diplomacy";
export type GuideExpression = "neutral" | "welcome" | "concern" | "explain";
export interface GuideMessage { title: string; text: string; expression: GuideExpression; destination?: "management" | "building" }
const lessons: GuideMessage[] = [
  { title: "다시 불을 켜는 도시", text: "안녕하세요, 서린이에요. 이 쉘터에서 도시의 재건을 함께 살펴볼게요. 왼쪽 드래그로 이동하고, 오른쪽 드래그로 회전해 보세요. 휠로 가까이 볼 수 있어요.", expression: "welcome" },
  { title: "먼저 거점 안으로", text: "확보한 건물의 ‘내부 보기’를 열면 실제 주민과 작업을 볼 수 있어요. 건물과 운영실은 도시 위에 열리고, X나 Escape로 닫으면 같은 도시로 돌아와요.", expression: "explain", destination: "building" },
  { title: "살아갈 시설을 확보해요", text: "인접한 건물을 선택해 탐색하고, 보급 협상이나 전투로 확보할 수 있어요. 버튼의 실제 비용과 조건을 확인하세요. 시설을 정하고 복구를 시작해야 생산할 수 있어요.", expression: "explain", destination: "management" },
  { title: "주민과 자원의 균형", text: "운영실에서 생산·필요량·미공급을 함께 확인하세요. 주민은 우선순위에 따라 스스로 배정돼요. 복구 인력과 생산 인력이 경쟁하고, 부상자는 작업에서 빠질 수 있어요.", expression: "neutral", destination: "management" },
  { title: "이 도시의 지도자가 되려면", text: "공동체를 안정시키고 귀족과 관계를 쌓으면 남작을 요청할 수 있어요. 서약과 의무는 조건을 비교해 직접 결정하세요. 저는 대신 계약하거나 전쟁을 시작하지 않아요.", expression: "explain", destination: "management" },
];
export const LESSON_COUNT = lessons.length;
export function guideMessage(game: GameState, presentation: GamePresentation, topic: GuideTopic, step: number): GuideMessage {
  if (topic === "intro") return lessons[Math.max(0, Math.min(lessons.length - 1, Math.floor(step) || 0))];
  if (game.ended) return {title:"공동체의 여정", text:"현재 여정이 종료되어 시간이 멈췄어요. 운영실에서 기록과 다음 선택을 확인해 주세요.",expression:"concern",destination:"management"};
  if (game.pendingSuccession) return {title:"당신의 결정이 필요해요", text:"지도자 계승을 기다리며 시간이 멈췄어요. 운영실에서 직접 결정해 주세요. 제가 자동으로 후계자를 고르지는 않아요.",expression:"concern",destination:"management"};
  if (topic === "diplomacy") {
    if (game.title === "baron") return {title:"남작으로 인정받았어요",text:"작위를 얻었어요. 재건은 계속할 수 있지만, 남아 있는 계약 의무와 자원 수지를 함께 살펴보세요.",expression:"welcome",destination:"management"};
    const requirements = titleRequirements(game).map(r => `${r.label}: ${Math.min(r.current,r.target).toFixed(0)}/${r.target}`).join(" · ");
    return {title:"남작으로 가는 길",text:`현재 공동체 조건은 ${requirements}이에요. 귀족 관계와 계약 조건도 필요해요. 운영실 외교 탭에서 실제 요청 가능 여부를 확인하세요.`,expression:"explain",destination:"management"};
  }
  if (topic === "people") {
    const living = game.people.filter(p => p.alive), injured = living.filter(p => p.injury > 0 || p.health < 25);
    return {title:"우리 공동체의 주민",text:`생존 주민 ${living.length}명 중 ${injured.length}명은 부상·낮은 건강 상태예요. 작업과 배정은 운영실 주민 탭에서 확인할 수 있어요. 우선순위를 바꾸면 실제 배정과 생산에 반영돼요.`,expression:injured.length ? "concern" : "neutral",destination:"management"};
  }
  const names = {food:"식량",water:"식수",power:"전력",materials:"자재"};
  const unmet = (Object.keys(names) as (keyof typeof names)[]).filter(k => presentation.feedback[k].unmet > 1e-8);
  if (unmet.length) return {title:"공급을 먼저 살펴봐 주세요",text:`이번 시간 계산에서 ${unmet.map(k=>names[k]).join("·")} 수요를 모두 공급하지 못해요. 재고만 보고 판단하지 말고 운영실의 생산·필요량·실제 출력을 확인하세요. 작업자와 시설 우선순위도 점검해 주세요.`,expression:"concern",destination:"management"};
  const restoring = game.buildings.filter(b => b.status === "restoring");
  if (restoring.length) return {title:"재건이 진행 중이에요",text:`${restoring.length}곳에서 복구·시설 전환을 진행 중이에요. 진행률은 실제 작업량에 따라 올라가며, 인력이 없으면 대기할 수 있어요. 작업 중인 시설을 운영 중이라고 계산하면 안 돼요.`,expression:"explain",destination:"management"};
  return {title:topic === "economy" ? "지금의 자원 수지" : "도시를 살펴볼까요",text:`현재 계산에서 미공급 자원은 없어요. ${game.clock.speed === 0 ? "시간은 일시정지 중이에요. 상단에서 배속이나 1시간 진행을 선택할 수 있어요." : "시간은 진행 중이며, 운영실을 열어도 계속 흘러요."} 새로운 시설을 늘리기 전에는 생활 소비와 운영 비용도 확인하세요.`,expression:"neutral",destination:"management"};
}
