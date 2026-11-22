import {Container,Graphics,Text} from 'pixi.js';
import type {BuildingPresentation,ResidentPresentation,AnimationState} from '../presentation/GamePresentation';
import {residentPose} from './ResidentAnimator';
import {moveResident,redirectMotion,type Motion} from './ResidentMovement';
import {rect,label} from './RoomRenderer';
const uniform={farmer:0x8f9d6f,engineer:0xc3ad75,scavenger:0x879d9b,guard:0x798978};
export class ResidentRenderer {
 readonly container=new Container();private body=new Container();private leftLeg=new Container();private rightLeg=new Container();private leftArm=new Container();private rightArm=new Container();private selection=new Graphics();private gear=new Graphics();private name:Text;private phase:number;private current:ResidentPresentation;private destination='';private motion:Motion;private patrol=0;private departed=false;private chosen=false;
 constructor(person:ResidentPresentation,private model:BuildingPresentation,onSelect:(id:string)=>void){
  this.current=person;const seed=[...person.id].reduce((n,c)=>n+c.charCodeAt(0),0);this.phase=seed*.9;const start=model.layout.nodes.find(n=>n.id===person.roomId)??model.layout.nodes[0];this.destination=person.roomId;this.motion={x:start.x+(seed%5-2)*24,y:start.y,route:[],facing:seed%2?1:-1,walking:false};
  this.container.addChild(this.selection,this.body);const skin=[0xc39f7d,0xb48b6d,0xd1b395,0x95785d][seed%4],shirt=uniform[person.role];
  for(const [limb,x] of [[this.leftLeg,-4],[this.rightLeg,4]] as const){limb.position.set(x,-15);const g=new Graphics();rect(g,-3,0,6,13,0x404b43);rect(g,-3,11,9,4,0x222e28);limb.addChild(g);this.body.addChild(limb);}
  const torso=new Graphics();torso.roundRect(-8,-36,16,22,3).fill(shirt);rect(torso,-7,-25,14,5,0x58664e);rect(torso,-6,-19,12,3,0x302e27);rect(torso,-5,-34,3,13,0xa5ae8b);rect(torso,3,-32,3,6,0x586750);this.body.addChild(torso);
  for(const [limb,x] of [[this.leftArm,-9],[this.rightArm,8]] as const){limb.position.set(x,-33);const g=new Graphics();g.roundRect(-3,0,6,12,2).fill(shirt);rect(g,-2,11,4,6,skin);limb.addChild(g);this.body.addChild(limb);}
  const head=new Graphics();head.roundRect(-6,-49,12,14,4).fill(skin);head.poly([-6,-43,-6,-50,-3,-53,4,-52,7,-48,6,-45,0,-49,-3,-47]).fill(seed%3===0?0x807f67:0x393b30);rect(head,3,-44,2,2,0x29342c);rect(head,5,-40,3,3,skin);if(person.role==='engineer'){head.roundRect(-7,-52,15,6,3).fill(0xc2b47f);rect(head,-8,-48,18,2,0xd0bd80);}this.body.addChild(head,this.gear);
  this.name=label(person.name,-20,-67,9,0xe6dfbb);this.name.visible=false;this.container.addChild(this.name);this.container.eventMode='static';this.container.cursor='pointer';this.container.on('pointertap',e=>{e.stopPropagation();onSelect(this.current.id);});this.container.on('pointerover',()=>this.name.visible=true);this.container.on('pointerout',()=>this.name.visible=this.chosen);this.update(person,model);this.draw(0,true);
 }
 update(person:ResidentPresentation,model:BuildingPresentation){this.current=person;this.model=model;this.departed=!person.present;const target=person.present?person.roomId:model.layout.entryNode;if(target!==this.destination){this.destination=target;const seed=[...person.id].reduce((n,c)=>n+c.charCodeAt(0),0);this.motion=redirectMotion(this.motion,model.layout,target,person.present?(seed%5-2)*24:0);this.patrol=0;}}
 select(id:string){this.chosen=id===this.current.id;this.name.visible=this.chosen;this.selection.clear();if(this.chosen)this.selection.ellipse(0,-1,16,5).stroke({color:0xe3d7a6,width:2});}
 draw(dt:number,paused:boolean){
  if(!paused){this.phase+=dt;this.motion=moveResident(this.motion,dt,this.current.speed,false);this.patrol+=dt;
   if(!this.motion.walking&&this.patrol>7&&!this.departed&&(this.current.area==='guard'||this.current.area==='materials'||this.current.state==='idle')){const target=this.model.layout.nodes.find(n=>n.id===this.destination);if(target){const step=Math.sin(this.phase)*45;this.motion={...this.motion,route:[{x:target.x+step,y:target.y}],walking:true};}this.patrol=0;}}
  this.container.visible=!this.departed||this.motion.walking;if(!this.container.visible)return;this.container.position.set(this.motion.x,this.motion.y);this.body.scale.x=this.motion.facing;
  const state:AnimationState=this.motion.walking?'walking':this.current.state,p=residentPose(state,this.phase,this.current.area);this.body.rotation=p.lean;this.body.y=p.bob+(p.sit?9:0);this.leftLeg.rotation=p.leftLeg;this.rightLeg.rotation=p.rightLeg;this.leftArm.rotation=p.leftArm;this.rightArm.rotation=p.rightArm;this.gear.clear();
  if(this.current.state==='injured'){rect(this.gear,-6,-31,13,4,0xdbd6b6);this.gear.moveTo(-5,-34).lineTo(7,-23).stroke({color:0xdbd6b6,width:3});}
  if(this.current.area==='materials'){rect(this.gear,7,-26,15,14,0xa39069);this.gear.moveTo(7,-26).lineTo(22,-12).stroke({color:0x5c644b,width:2});}
  if(state==='repairing'){const y=-35+Math.sin(this.phase*6)*10;this.gear.moveTo(13,y+9).lineTo(18,y-7).stroke({color:0xb6a27d,width:3});rect(this.gear,12,y-10,13,5,0xb9b9a1);}
  if(state==='working'&&this.current.area==='food'){rect(this.gear,12,-22,12,9,0x9cae91);this.gear.moveTo(24,-19).lineTo(31,-24).stroke({color:0x9cae91,width:3});}
  if(state==='working'&&this.current.area==='power'){this.gear.moveTo(10,-20).lineTo(22,-34).stroke({color:0xced0ae,width:3});}
 }
 get id(){return this.current.id;} get walking(){return this.motion.walking&&this.container.visible;} get active(){return this.container.visible;}
 destroy(){this.container.destroy({children:true});}
}
