export default function Bg() {
  return (
    <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}}>
      <div style={{position:'absolute',width:600,height:600,borderRadius:'50%',left:-200,top:-150,background:'radial-gradient(circle,var(--orb1,rgba(30,70,140,.35)) 0%,transparent 70%)',animation:'orb1 18s ease-in-out infinite'}}/>
      <div style={{position:'absolute',width:500,height:500,borderRadius:'50%',right:-150,bottom:-100,background:'radial-gradient(circle,var(--orb2,rgba(20,90,80,.25)) 0%,transparent 70%)',animation:'orb2 22s ease-in-out infinite'}}/>
      <div style={{position:'absolute',inset:0,backgroundImage:'radial-gradient(var(--dot-color,rgba(255,255,255,.05)) 1px,transparent 1px)',backgroundSize:'32px 32px',maskImage:'radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%)',WebkitMaskImage:'radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%)'}}/>
    </div>
  );
}
