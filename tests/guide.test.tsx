// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {newGame} from "../src/engine";
import {presentGame} from "../src/game/presentation/GamePresentation";
import {guideMessage,LESSON_COUNT} from "../src/game/guide/guide";
import GuideDialogue from "../src/game/guide/GuideDialogue";
beforeEach(()=>{
  const values=new Map<string,string>();
  Object.defineProperty(window,"localStorage",{configurable:true,value:{
    getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),
    removeItem:(key:string)=>values.delete(key),clear:()=>values.clear(),key:(i:number)=>[...values.keys()][i]??null,
    get length(){return values.size;},
  }});
});
afterEach(()=>cleanup());
describe("서린의 상태 안내",()=>{
  it("실제 원장의 미공급과 주민·작위·계승을 읽고 게임은 변경하지 않는다",()=>{
    const game=newGame(77), snapshot=structuredClone(game), p=presentGame(game,0);
    expect(guideMessage(game,p,"status",0).text).toContain("일시정지");
    p.feedback.water.unmet=1;
    expect(guideMessage(game,p,"economy",0)).toMatchObject({expression:"concern"});
    expect(guideMessage(game,p,"economy",0).text).toContain("식수");
    expect(guideMessage(game,p,"people",0).text).toContain(String(game.people.filter(p=>p.alive).length));
    expect(game).toEqual(snapshot);
    game.pendingSuccession=true;
    expect(guideMessage(game,p,"status",0).text).toContain("계승");
    game.pendingSuccession=false;game.title="baron";
    expect(guideMessage(game,p,"diplomacy",0).title).toContain("남작");
  });
  it("초기 안내·건너뛰기·접기와 다시 열기·캠페인 UI 저장을 지원한다",()=>{
    const game=newGame(78), onNavigate=vi.fn(), props={game,presentation:presentGame(game,0),active:true,onNavigate};
    const {unmount}=render(<GuideDialogue {...props}/>);
    expect(screen.getByText(`처음 안내 1 / ${LESSON_COUNT}`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"다음"}));
    fireEvent.click(screen.getByRole("button",{name:"거점 내부 살펴보기"}));
    expect(onNavigate).toHaveBeenCalledWith("building");
    fireEvent.click(screen.getByRole("button",{name:"안내 건너뛰기"}));
    fireEvent.click(screen.getByRole("button",{name:"서린 안내 접기"}));
    expect(screen.getByRole("button",{name:"서린의 안내"})).toBeTruthy();
    unmount(); render(<GuideDialogue {...props}/>);
    expect(screen.getByRole("button",{name:"서린의 안내"})).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"서린의 안내"}));
    fireEvent.click(screen.getByRole("button",{name:"처음 안내 다시 보기"}));
    expect(screen.getByText(`처음 안내 1 / ${LESSON_COUNT}`)).toBeTruthy();
  });
  it("다른 오버레이에서는 숨기고 손상된 UI 저장을 게임 저장과 분리한다",()=>{
    window.localStorage.setItem("ashen-city-guide-v1",'{broken');
    const game=newGame(79), props={game,presentation:presentGame(game,0),onNavigate:vi.fn()};
    const {rerender}=render(<GuideDialogue {...props} active={false}/>);
    expect(screen.queryByRole("button",{name:"다음"})).toBeNull();
    rerender(<GuideDialogue {...props} active/>);
    expect(screen.getByRole("button",{name:"다음"})).toBeTruthy();
    expect(window.localStorage.getItem("ashen-city-v1")).toBeNull();
  });
});
