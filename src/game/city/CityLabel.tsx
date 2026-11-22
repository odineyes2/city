import {useEffect,useMemo} from 'react';
import {CanvasTexture} from 'three';
export default function CityLabel({name,detail,height}:{name:string;detail:string;height:number}){
 const texture=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=150;const g=canvas.getContext('2d')!;g.fillStyle='#1b3027ee';g.fillRect(0,0,640,150);g.strokeStyle='#acbd8c';g.lineWidth=3;g.strokeRect(2,2,636,146);g.textAlign='center';g.fillStyle='#e5e6c9';g.font='30px sans-serif';g.fillText(name,320,60);g.fillStyle='#b3c0a1';g.font='22px sans-serif';g.fillText(detail,320,110);return new CanvasTexture(canvas);},[name,detail]);
 useEffect(()=>()=>texture.dispose(),[texture]);return <sprite position={[0,height+5,0]} scale={[22,5.1,1]} renderOrder={10}><spriteMaterial map={texture} transparent depthTest={false}/></sprite>;
}
