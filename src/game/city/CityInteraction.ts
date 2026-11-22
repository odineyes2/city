// CSS 픽셀 기준 최대 이동량. 원점으로 되돌아오는 드래그도 클릭으로 취급하지 않는다.
export class PointerGesture {
 private x=0;private y=0;private distance=0;
 down(x:number,y:number){this.x=x;this.y=y;this.distance=0;}
 move(x:number,y:number){this.distance=Math.max(this.distance,Math.hypot(x-this.x,y-this.y));}
 get dragged(){return this.distance>=6;}
}
