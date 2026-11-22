import {useMemo} from 'react';
import {BoxBatch,Block,Cylinder,noise,type BoxItem} from './CityGeometry';
function Wreck({x,z,angle,color}:{x:number;z:number;angle:number;color:string}) {return <group position={[x,.18,z]} rotation={[0,angle,0]}><Block at={[0,.6,0]} size={[1.8,.7,3.5]} color={color} rotation={[0,0,.04]}/><Block at={[0,1.17,-.15]} size={[1.5,.65,1.8]} color="#3d4944"/><Block at={[0,1.05,-1.02]} size={[1.42,.5,.05]} color="#82918a" opacity={.6}/><Block at={[0,.68,1.7]} size={[1.6,.16,.1]} color="#7b6c52"/>{[-.94,.94].map((xx,i)=>[-1,1].map((zz,j)=><Cylinder key={i+'-'+j} at={[xx,.35,zz]} radius={.36} height={.16} color="#242e28" rotation={[0,0,Math.PI/2]}/>))}</group>;}
export default function CityTerrain() {
 const {curbs,markings,crossings,rubble,shrubs,treeTrunks,canopy,distant}=useMemo(()=>{
  const curbs:BoxItem[]=[],markings:BoxItem[]=[],crossings:BoxItem[]=[],rubble:BoxItem[]=[],shrubs:BoxItem[]=[],treeTrunks:BoxItem[]=[],canopy:BoxItem[]=[],distant:BoxItem[]=[];
  for(let y=0;y<4;y++)for(let x=0;x<5;x++)curbs.push({position:[(x-2)*20,.08,(y-1.5)*20],scale:[15.8,.32,15.8],color:noise(x+y*5)>.5?'#68705e':'#737666'});
  for(let i=0;i<6;i++)for(let j=0;j<22;j++)markings.push({position:[-50+i*20,.018,-51+j*5],scale:[.08,.018,1.8],color:'#a59d70'});
  for(let i=0;i<5;i++)for(let j=0;j<24;j++)markings.push({position:[-58+j*5,.019,-40+i*20],scale:[1.8,.02,.08],color:'#999574'});
  for(let i=0;i<5;i++)for(let j=0;j<3;j++)for(let k=0;k<5;k++)crossings.push({position:[-50+i*20+.65*k,.025,-40+j*20+5.8],scale:[.38,.02,2],color:'#aba88b'});
  for(let i=0;i<150;i++){const x=-56+noise(i+3)*114,z=-45+noise(i+77)*91;rubble.push({position:[x,.25+noise(i)*.3,z],scale:[.35+noise(i+11)*1.5,.3+noise(i+12)*.8,.3+noise(i+14)*1.1],rotation:[noise(i)*.3,noise(i+4)*6,.1],color:i%3?'#7b7b63':'#5b6551'});}
  for(let i=0;i<105;i++){const x=-54+noise(i+135)*108,z=-42+noise(i+31)*84;shrubs.push({position:[x,.3,z],scale:[.8+noise(i)*2,.3+noise(i+1)*.6,.5+noise(i+2)*1.2],rotation:[0,noise(i)*6,0],color:i%3?'#4e6348':'#66734b'});}
  for(let i=0;i<27;i++){const x=-53+noise(i+811)*108,z=-43+noise(i+350)*88;treeTrunks.push({position:[x,1.6,z],scale:[.2,3.4,.2],color:'#514f3a'});canopy.push({position:[x,3.6,z],scale:[2+noise(i)*2,2.1+noise(i)*2,2+noise(i+1)*2],rotation:[0,noise(i)*5,.12],color:i%2?'#4f654c':'#65734d'});}
  for(let i=0;i<25;i++){const x=(i%13-6)*13,z=i<13?-66:68,height=9+noise(i+140)*38;distant.push({position:[x,height/2,z],scale:[7+noise(i)*6,height,7+noise(i+3)*5],color:i%3?'#686f61':'#717568'});}
  return {curbs,markings,crossings,rubble,shrubs,treeTrunks,canopy,distant};
 },[]);
 return <group><mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[310,290]}/><meshStandardMaterial color="#68705c" roughness={1}/></mesh><Block at={[0,-.16,0]} size={[124,.25,104]} color="#333d36"/><BoxBatch items={curbs} castShadow/><BoxBatch items={markings}/><BoxBatch items={crossings}/><BoxBatch items={rubble} castShadow/><BoxBatch items={shrubs}/><BoxBatch items={treeTrunks} castShadow/><BoxBatch items={canopy} castShadow/><BoxBatch items={distant} castShadow/>
  {Array.from({length:13},(_,i)=><Wreck key={i} x={-50+(i%6)*20+(i%2?2:-1)} z={-30+Math.floor(i/6)*26+i%3*4} angle={i*.72} color={['#655b44','#525d58','#7e7158'][i%3]}/>)}
  <Block at={[0,8,-54]} size={[132,1.5,5.5]} color="#6b6d5a"/>{[-50,-25,0,25,50].map(x=><Block key={x} at={[x,3.7,-54]} size={[2.4,8,3]} color="#666b58"/>)}
  <Block at={[0,8.9,-55.4]} size={[132,.25,.16]} color="#3c493e"/><Block at={[0,8.9,-52.6]} size={[132,.25,.16]} color="#3c493e"/>
 </group>;
}
