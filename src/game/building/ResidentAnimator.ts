import type {AnimationState} from '../presentation/GamePresentation';
export interface Pose {leftLeg:number;rightLeg:number;leftArm:number;rightArm:number;lean:number;bob:number;sit:boolean}
export function residentPose(state:AnimationState,phase:number,area:string|null):Pose {
 const p:Pose={leftLeg:0,rightLeg:0,leftArm:.08,rightArm:-.08,lean:0,bob:Math.sin(phase*2)*.35,sit:false};
 if(state==='walking'){const wave=Math.sin(phase*8);p.leftLeg=wave*.55;p.rightLeg=-wave*.55;p.leftArm=-wave*.4;p.rightArm=wave*.4;p.bob=Math.abs(Math.cos(phase*8))*1.2;}
 if(state==='working'){p.lean=area==='food'?.15:.05;p.leftArm=-.7+Math.sin(phase*3)*.25;p.rightArm=area==='guard'?.2:-.9+Math.cos(phase*3)*.35;if(area==='materials'){p.leftArm=-1.1;p.rightArm=-1.1;}if(area==='guard'){p.lean=Math.sin(phase*.8)*.04;p.leftArm=-.3;p.rightArm=-.6;}}
 if(state==='repairing'){p.lean=.18;p.rightArm=-1.2+Math.sin(phase*6)*.9;p.leftArm=-.7;}
 if(state==='resting'||state==='injured'){p.sit=true;p.leftLeg=-1.25;p.rightLeg=-1.1;p.lean=state==='injured'?.2:.1;p.rightArm=state==='injured'?-.8:0;}
 return p;
}
