export function supportsWebGL(factory:()=>HTMLCanvasElement=()=>document.createElement('canvas')) {
 try {const canvas=factory(),context=canvas.getContext('webgl2');if(!context)return false;context.getExtension('WEBGL_lose_context')?.loseContext();return true;}catch{return false;}
}
