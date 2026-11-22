// 캠페인별 안내 진행은 별도 UI 저장소에만 보관한다. GameState와 기존 저장 스키마는 바꾸지 않는다.
import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, ChevronRight, RotateCcw } from "lucide-react";
import type { GameState } from "../../model";
import type { GamePresentation } from "../presentation/GamePresentation";
import { guideMessage, LESSON_COUNT, type GuideTopic } from "./guide";
import "./guide.css";

const KEY = "ashen-city-guide-v1";
interface GuideSession { campaign: string; open: boolean; topic: GuideTopic; step: number }
function restore(campaign: string): GuideSession {
  const fallback: GuideSession = {campaign,open:true,topic:"intro",step:0};
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || "null");
    if (v?.campaign === campaign && typeof v.open === "boolean" && ["intro","status","economy","people","diplomacy"].includes(v.topic) && Number.isInteger(v.step) && v.step >= 0 && v.step < LESSON_COUNT) return v;
  } catch { /* 저장 접근 실패는 게임을 막지 않는다. */ }
  return fallback;
}
export default function GuideDialogue({game,presentation,active,onNavigate}: {game:GameState;presentation:GamePresentation;active:boolean;onNavigate:(view:"management"|"building")=>void}) {
  const [session,setSession] = useState(() => restore(game.campaignId));
  const [portraitFailed,setPortraitFailed] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null), closeButton = useRef<HTMLButtonElement>(null), openedByUser = useRef(false);
  useEffect(() => { if(session.campaign !== game.campaignId) setSession(restore(game.campaignId)); },[game.campaignId,session.campaign]);
  useEffect(() => { if(session.campaign===game.campaignId) try {window.localStorage.setItem(KEY,JSON.stringify(session));} catch { /* UI 설정 저장 실패만 무시한다. */ } },[session,game.campaignId]);
  useEffect(() => {if(active && openedByUser.current) { (session.open ? closeButton : launcher).current?.focus(); openedByUser.current=false;}},[session.open,active]);
  const message = guideMessage(game,presentation,session.topic,session.step);
  const close = () => {openedByUser.current=true;setSession(s=>({...s,open:false}));};
  return <aside className="guide-host" hidden={!active} aria-label="서린의 안내">
    {!session.open ? <button className="guide-launcher" ref={launcher} onClick={()=>{openedByUser.current=true;setSession(s=>({...s,open:true}));}}><MessageCircle size={18}/> 서린의 안내</button> :
    <section className="guide-dialogue" aria-labelledby="seorin-name" onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();close();}}}>
      <header><span><b id="seorin-name">서린</b><small>공동체 안내자</small></span><button ref={closeButton} onClick={close} aria-label="서린 안내 접기" title="안내 접기"><X size={18}/></button></header>
      <div className="guide-scene">
        {!portraitFailed ? <img className="guide-portrait" src={`/mascot/seorin-${message.expression}.webp`} alt="캐릭터 스튜디오의 서린" onError={()=>setPortraitFailed(true)}/> : <div className="guide-portrait-unavailable">서린<br/><small>초상화를 불러오지 못했어요</small></div>}
        <div className="guide-speech" aria-live="polite" aria-atomic="true"><h2>{message.title}</h2><p>{message.text}</p></div>
      </div>
      {session.topic === "intro" ? <div className="guide-actions"><small>처음 안내 {session.step+1} / {LESSON_COUNT}</small><button onClick={()=>setSession(s=>({...s,topic:"status"}))}>안내 건너뛰기</button><button onClick={()=>setSession(s=>s.step+1<LESSON_COUNT?{...s,step:s.step+1}:{...s,topic:"status"})}>{session.step+1<LESSON_COUNT?"다음":"도시 살펴보기"}<ChevronRight size={15}/></button></div> :
      <nav className="guide-topics" aria-label="서린에게 물어보기">{([['status','현재 상황'],['economy','자원'],['people','주민'],['diplomacy','남작 조건']] as const).map(([topic,label])=><button key={topic} aria-pressed={session.topic===topic} onClick={()=>setSession(s=>({...s,topic}))}>{label}</button>)}<button title="처음 안내 다시 보기" aria-label="처음 안내 다시 보기" onClick={()=>setSession(s=>({...s,topic:"intro",step:0}))}><RotateCcw size={15}/></button></nav>}
      {message.destination && <button className="guide-destination" onClick={()=>onNavigate(message.destination!)}>{message.destination==="building"?"거점 내부 살펴보기":"운영실 열기"}</button>}
    </section>}
  </aside>;
}
