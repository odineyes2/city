import {Container,Graphics,Text} from 'pixi.js';
import type {RoomLayout} from './BuildingLayout';
import type {RoomPresentation} from '../presentation/GamePresentation';
export const rect=(g:Graphics,x:number,y:number,w:number,h:number,c:number,a=1)=>g.rect(x,y,w,h).fill({color:c,alpha:a});
export function label(text:string,x:number,y:number,size=12,color=0xc5c9b0){const t=new Text({text,style:{fontFamily:'"Noto Sans KR",sans-serif',fontSize:size,fill:color}});t.position.set(x,y);return t;}
const colors={entry:0x39463b,security:0x344347,stores:0x484a39,housing:0x4c4840,infirmary:0x444f49,hydro:0x324a3f,workshop:0x49483b,pump:0x334a4d,generator:0x4c493c,repair:0x343a33};
export class RoomRenderer {
 readonly container=new Container();readonly art=new Container();readonly lamp=new Graphics();readonly activity=new Graphics();readonly highlight=new Graphics();private title:Text;private data:RoomPresentation;private phase=0;
 constructor(readonly layout:RoomLayout,data:RoomPresentation,onSelect:(id:string)=>void){
  this.data=data;this.container.position.set(layout.x,layout.y);this.container.addChild(this.art);this.art.scale.x=layout.width/300;
  const g=new Graphics();this.art.addChild(g);rect(g,0,0,300,136,colors[layout.kind]);
  for(let y=15;y<120;y+=18){g.moveTo(0,y).lineTo(300,y).stroke({color:0x111b18,width:1,alpha:.26});for(let x=(y%36?0:25);x<300;x+=50)g.moveTo(x,y).lineTo(x,y+18).stroke({color:0x101912,width:1,alpha:.2});}
  rect(g,0,120,300,16,0x606451);for(let x=0;x<300;x+=25)g.moveTo(x,120).lineTo(x-15,136).stroke({color:0x2b392e,width:1});
  // Back-wall utility runs, door lintels and fluorescent housings.
  g.moveTo(0,25).lineTo(280,25).lineTo(280,100).stroke({color:0x75816b,width:3});g.moveTo(0,29).lineTo(278,29).stroke({color:0x202c24,width:2});
  rect(g,12,54,32,66,0x1e2b26);rect(g,14,57,27,60,0x596457);rect(g,17,60,20,17,0x233b35);rect(g,35,89,3,6,0xa4a58b);
  rect(g,105,9,90,7,0x14251e);rect(g,109,11,82,3,0xb6c7a0);
  const k=layout.kind;
  if(k==='hydro'){
   for(let row=0;row<2;row++){const y=74+row*34;rect(g,61,y,225,8,0x9dada1);rect(g,65,y+8,4,17,0x536c5a);rect(g,275,y+8,4,17,0x536c5a);for(let j=0;j<9;j++){const x=74+j*24;rect(g,x,y-6,16,6,0x354335);g.moveTo(x+8,y-7).lineTo(x+8,y-21).stroke({color:0x71966b,width:2});g.ellipse(x+4,y-16,6,3).fill(0x89a66b);g.ellipse(x+12,y-21,6,3).fill(0x627e4d);}}
   rect(g,54,37,232,4,0xd1d1a2);g.moveTo(53,41).lineTo(53,112).lineTo(288,112).stroke({color:0x7eaaa4,width:3});
  }else if(k==='workshop'){
   rect(g,75,44,160,38,0x2d352f);for(let i=0;i<8;i++){const x=85+i*18;g.moveTo(x,51).lineTo(x+3,70).stroke({color:0xb6b7a4,width:3});g.circle(x,50,3).stroke({color:0xb6b7a4,width:2});}rect(g,58,91,212,9,0x948168);rect(g,65,100,6,20,0x303d33);rect(g,256,100,6,20,0x303d33);rect(g,185,78,31,13,0x5f6f66);rect(g,192,73,7,17,0xa3a598);rect(g,85,82,20,8,0xb09b66);rect(g,230,103,31,17,0x8c7959);rect(g,235,106,20,3,0x5c5740);
  }else if(k==='generator'){
   for(let i=0;i<2;i++){const x=65+i*108;rect(g,x,78,94,42,0x333d35);g.roundRect(x+7,65,73,47,10).fill(0x7a816b);g.circle(x+46,88,19).fill(0x29382e);g.circle(x+46,88,12).stroke({color:0xa6aa8a,width:4});for(let j=0;j<5;j++)rect(g,x+13+j*12,68,3,15,0x4c5c4e);rect(g,x+6,108,81,8,0x96977b);}g.moveTo(275,30).lineTo(275,111).lineTo(164,111).stroke({color:0xc0a66c,width:4});rect(g,245,43,30,29,0x242f29);for(let i=0;i<3;i++)rect(g,251+i*7,50,4,6,i?0x748571:0xc8c68d);
  }else if(k==='pump'){
   for(let i=0;i<3;i++){const x=68+i*61;g.roundRect(x,44,39,73,13).fill(0x7e9590);g.ellipse(x+19,52,14,6).fill(0xadc1b2);rect(g,x+8,73,23,27,0x416760);rect(g,x+10,88,19,10,0x659488);g.moveTo(x+18,113).lineTo(x+18,123).stroke({color:0xb2bca4,width:4});}g.moveTo(55,38).lineTo(278,38).lineTo(278,112).lineTo(58,112).stroke({color:0x92a7a1,width:5});g.circle(273,83,9).fill(0x273d35).stroke({color:0xc4c6a4,width:2});g.moveTo(273,83).lineTo(278,78).stroke({color:0xb9c49e,width:2});
  }else if(k==='housing'||k==='infirmary'){
   for(let i=0;i<(k==='housing'?3:2);i++){const x=57+i*78;rect(g,x,85,65,6,0x9b9780);rect(g,x,116,65,4,0x938e79);rect(g,x+2,74,4,47,0x505d4e);rect(g,x+60,74,4,47,0x505d4e);rect(g,x+6,77,53,8,0xb5b09b);rect(g,x+6,105,53,11,k==='housing'?0x798a6c:0xb0bdac);rect(g,x+7,106,12,6,0xc9ccb7);rect(g,x+7,77,13,6,0xc4c5aa);if(k==='housing')rect(g,x+22,78,34,6,0x878875);}
   rect(g,254,60,32,60,0x6b7767);rect(g,269,63,1,54,0x394b3d);for(let i=0;i<3;i++)rect(g,259,68+i*15,4,2,0xb2b697);if(k==='infirmary'){rect(g,139,40,23,7,0xb29b85);rect(g,147,32,7,23,0xb29b85);}
  }else if(k==='security'){
   rect(g,68,90,130,8,0x8a8a70);rect(g,75,98,5,22,0x425145);rect(g,185,98,5,22,0x425145);for(let i=0;i<2;i++){rect(g,85+i*52,59,44,29,0x172b25);rect(g,89+i*52,63,36,20,0x5f7f6c);g.moveTo(92+i*52,77).lineTo(103+i*52,68).lineTo(119+i*52,75).stroke({color:0xa2b88f,width:1});}rect(g,220,50,53,70,0x38473b);for(let i=0;i<3;i++){g.moveTo(230+i*15,59).lineTo(233+i*15,104).stroke({color:0xa0a48b,width:4});}rect(g,57,30,8,15,0xbdaf7a);
  }else if(k==='stores'){
   for(let row=0;row<2;row++)for(let i=0;i<4;i++){const x=67+i*53,y=59+row*32;rect(g,x,y,45,28,0x8e7c59);rect(g,x+2,y+2,41,2,0xb09b73);g.moveTo(x,y).lineTo(x+45,y+28).stroke({color:0x5d5e43,width:2});}for(let x=60;x<290;x+=110)rect(g,x,47,4,73,0x8c9b86);rect(g,56,88,230,3,0x9caa91);
  }else if(k==='repair'){
   g.moveTo(100,5).lineTo(130,30).lineTo(120,49).lineTo(155,70).lineTo(134,91).stroke({color:0x131f19,width:5});for(let i=0;i<17;i++){const x=58+(i*43)%220,y=101+(i*7)%19;g.poly([x,y,x+17,y-8,x+31,y+7,x+8,y+10]).fill(i%2?0x727462:0x5d6758);}rect(g,72,39,4,72,0x988d6b);rect(g,247,39,4,72,0x988d6b);rect(g,69,56,186,5,0x9f9170);g.moveTo(73,112).lineTo(249,59).stroke({color:0x9a8b65,width:2});rect(g,164,58,15,10,0xc4ad6c);
  }else{
   rect(g,90,35,92,85,0x202c25);rect(g,97,43,78,77,0x5f6b58);rect(g,105,55,63,10,0x9cae8e);rect(g,109,58,49,3,0x425442);for(let i=0;i<5;i++){rect(g,93-i*8,119+i*2,96+i*16,3,0x8a8f77);}rect(g,230,67,28,53,0x8c926b);rect(g,235,71,18,7,0x3f5846);rect(g,259,80,20,40,0x4d6352);
  }
  this.art.addChild(this.lamp,this.activity);this.container.addChild(this.highlight);this.title=label(layout.label,12,32,11);this.container.addChild(this.title);this.container.eventMode='static';this.container.cursor='pointer';this.container.on('pointertap',()=>onSelect(layout.id));this.update(data,false);
 }
 update(data:RoomPresentation,selected:boolean){this.data=data;this.art.alpha=data.active?.99:.57;this.lamp.clear();if(data.active){this.lamp.poly([109,17,191,17,260,119,40,119]).fill({color:0xcdd7a0,alpha:.055});rect(this.lamp,110,10,80,4,0xe0e3bb);}this.title.alpha=data.active?1:.65;this.highlight.clear();if(selected)this.highlight.rect(1,1,this.layout.width-2,134).stroke({color:0xd0cb96,width:2});}
 tick(dt:number,paused:boolean){if(paused)return;this.phase+=dt;const g=this.activity;g.clear();if(!this.data.active||!this.data.workers.length)return;const a=.35+Math.sin(this.phase*3)*.25;if(this.layout.kind==='generator'){for(let i=0;i<2;i++){const x=111+i*108;g.moveTo(x-10*Math.cos(this.phase*4),88-10*Math.sin(this.phase*4)).lineTo(x+10*Math.cos(this.phase*4),88+10*Math.sin(this.phase*4)).stroke({color:0xc2bb85,width:3});}}else if(this.layout.kind==='pump'){for(let i=0;i<3;i++)g.circle(80+i*61,104-(this.phase*13+i*12)%45,2).fill({color:0xc2d2b6,alpha:.6});}else if(this.layout.kind==='repair'){g.circle(169,68,15).fill({color:0xe3c886,alpha:a*.2});}}
}
