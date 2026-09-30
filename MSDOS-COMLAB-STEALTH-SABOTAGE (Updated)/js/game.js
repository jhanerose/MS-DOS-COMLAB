const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
const statusText=document.getElementById("status");
const WIDTH=canvas.width,HEIGHT=canvas.height;
// localStorage can throw (private mode, file:// restrictions); never let it kill the game.
const store={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
// Event messages stay on screen briefly instead of being overwritten on the next frame.
let statusHoldUntil=0;
function flash(msg,ms=1800){statusText.textContent=msg;statusHoldUntil=performance.now()+ms;}

const bg=new Image();
bg.src="assets/background.png";

const playerIdleImage=new Image();
playerIdleImage.src="assets/player-idle.png";
const playerFrontImage=new Image();
playerFrontImage.src="assets/player-walk-front.gif";
const playerBackImage=new Image();
playerBackImage.src="assets/player-walk-back.gif";
const playerLeftImage=new Image();
playerLeftImage.src="assets/player-walk-left.gif";
const playerRightImage=new Image();
playerRightImage.src="assets/player-walk-right.gif";
const guardRightNormalImage=new Image();
guardRightNormalImage.src="assets/guard-normal-right.gif";
const guardRightSearchingImage=new Image();
guardRightSearchingImage.src="assets/guard-search-right.gif";
const guardLeftSearchingImage=new Image();
guardLeftSearchingImage.src="assets/guard-search-left.gif";
const guardFrontNormalImage=new Image();
guardFrontNormalImage.src="assets/guard-normal-front.gif";
const guardFrontSearchingImage=new Image();
guardFrontSearchingImage.src="assets/guard-search-front.gif";
// Student sabotage animation assets. The GIFs animate automatically in the browser.
const playerCrouchBackImage=new Image();
playerCrouchBackImage.src="assets/student-crouch-back.gif";
const playerCrouchFrontImage=new Image();
playerCrouchFrontImage.src="assets/student-crouch-front.gif";
const playerCrouchLeftImage=new Image();
playerCrouchLeftImage.src="assets/student-crouch-left.gif";
const playerCrouchRightImage=new Image();
playerCrouchRightImage.src="assets/student-crouch-right.gif";

const playerSabotageRightImage=new Image();
playerSabotageRightImage.src="assets/student-sabotage-right.gif";
const playerSabotageLeftImage=new Image();
playerSabotageLeftImage.src="assets/student-sabotage-left.gif";
const playerSabotageFrontImage=new Image();
playerSabotageFrontImage.src="assets/student-sabotage-front.gif";
const playerSabotageBackImage=new Image();
playerSabotageBackImage.src="assets/student-sabotage-back.gif";

// Environmental animation assets. These are drawn over the existing map so they
// stay locked to the supplied background layout instead of becoming world objects.
const computerSabotageImage=new Image();
computerSabotageImage.src="assets/computer-sabotage.gif";
const professorPaperImage=new Image();
professorPaperImage.src="assets/professor-paper.gif";

const guardRightCautionImage=new Image();
guardRightCautionImage.src="assets/guard-caution-right.gif";
const guardLeftCautionImage=new Image();
guardLeftCautionImage.src="assets/guard-caution-left.gif";
const guardFrontCautionImage=new Image();
guardFrontCautionImage.src="assets/guard-caution-front.gif";

const bgm=document.getElementById("bgm");
bgm.src="assets/bgm.mp3";
bgm.volume=0.55;

let player={x:80,y:480,width:42,height:60,speed:190,moving:false,direction:"down"};
const DETECTION_RANGE=180; // How close the player must be for the guard to detect them.
const SABOTAGE_TIME=3.0; // Seconds needed to finish one computer sabotage.
const GUARD_PATROL_SPEED=78; // Slower normal patrol speed.
const GUARD_CHASE_SPEED=92;  // Still slower than the player's 190 speed.

// All guard states use the same on-screen size as the normal guard.
const GUARD_SIDE_WIDTH=204, GUARD_SIDE_HEIGHT=96;
const GUARD_FRONT_WIDTH=116, GUARD_FRONT_HEIGHT=260;
let guard={x:350,y:275,radius:15,speed:GUARD_PATROL_SPEED,direction:1,pathIndex:0,angle:0,aggro:false};

// The four visible computer banks in the supplied background are the sabotage targets.
const computers=[
 {x:364,y:29,width:127,height:207,name:"Computer 1",sabotagedUntil:0},
 {x:540,y:29,width:126,height:207,name:"Computer 2",sabotagedUntil:0},
 {x:364,y:329,width:127,height:206,name:"Computer 3",sabotagedUntil:0},
 {x:540,y:329,width:126,height:206,name:"Computer 4",sabotagedUntil:0}
];
const walls=computers.map(({x,y,width,height})=>({x,y,width,height}));

// Guard patrols the middle aisle and turns into the gaps between the computer rows.
const guardPath=[
 {x:350,y:275},{x:350,y:255},{x:350,y:315},{x:350,y:275},
 {x:530,y:275},{x:530,y:255},{x:530,y:315},{x:530,y:275},
 {x:700,y:275},{x:700,y:255},{x:700,y:315},{x:700,y:275}
];

// ---- Guard navigation: the guard can no longer walk through computers ----
const GR=12,CELL=10,GW=Math.ceil(WIDTH/CELL),GH=Math.ceil(HEIGHT/CELL); // GR = guard collision radius
function blockedR(x,y,r){
 if(x-r<15||x+r>WIDTH-15||y-r<15||y+r>HEIGHT-15)return true;
 return walls.some(w=>x+r>w.x&&x-r<w.x+w.width&&y+r>w.y&&y-r<w.y+w.height);
}
const navOK=new Uint8Array(GW*GH);
for(let gy=0;gy<GH;gy++)for(let gx=0;gx<GW;gx++)navOK[gy*GW+gx]=blockedR(gx*CELL+CELL/2,gy*CELL+CELL/2,GR)?0:1;
const NAV_DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function lineClear(x1,y1,x2,y2){
 const n=Math.ceil(Math.hypot(x2-x1,y2-y1)/5);
 for(let i=1;i<=n;i++){const t=i/n;if(blockedR(x1+(x2-x1)*t,y1+(y2-y1)*t,GR))return false;}
 return true;
}
function nearestOpen(x,y){
 let gx=Math.min(GW-1,Math.max(0,Math.floor(x/CELL))),gy=Math.min(GH-1,Math.max(0,Math.floor(y/CELL)));
 if(navOK[gy*GW+gx])return [gx,gy];
 for(let d=1;d<20;d++)for(let oy=-d;oy<=d;oy++)for(let ox=-d;ox<=d;ox++){
  if(Math.max(Math.abs(ox),Math.abs(oy))!==d)continue;
  const nx=gx+ox,ny=gy+oy;
  if(nx>=0&&ny>=0&&nx<GW&&ny<GH&&navOK[ny*GW+nx])return [nx,ny];
 }
 return null;
}
function findPath(x1,y1,x2,y2){
 const s=nearestOpen(x1,y1),g=nearestOpen(x2,y2);
 if(!s||!g)return [];
 const prev=new Int32Array(GW*GH).fill(-2),si=s[1]*GW+s[0],gi=g[1]*GW+g[0],q=[si];
 prev[si]=-1;
 for(let h=0;h<q.length&&prev[gi]===-2;h++){
  const c=q[h],cx=c%GW,cy=(c/GW)|0;
  for(const [ax,ay] of NAV_DIRS){
   const nx=cx+ax,ny=cy+ay;
   if(nx<0||ny<0||nx>=GW||ny>=GH)continue;
   const ni=ny*GW+nx;
   if(prev[ni]!==-2||!navOK[ni])continue;
   if(ax&&ay&&(!navOK[cy*GW+nx]||!navOK[ny*GW+cx]))continue; // no cutting corners
   prev[ni]=c;q.push(ni);
  }
 }
 if(prev[gi]===-2)return [];
 const pts=[];
 for(let c=gi;c!==-1;c=prev[c])pts.push({x:(c%GW)*CELL+CELL/2,y:((c/GW)|0)*CELL+CELL/2});
 pts.reverse();pts.push({x:x2,y:y2});
 return pts;
}
let guardPathPts=[],guardPathGoal=null,guardRepath=0;
function moveGuard(dx,dy){
 if(!blockedR(guard.x+dx,guard.y,GR))guard.x+=dx;
 if(!blockedR(guard.x,guard.y+dy,GR))guard.y+=dy;
}
// Walk toward (tx,ty): straight if the way is clear, otherwise along a path around the computers.
function guardGoTo(tx,ty,speed,dt){
 let gx=tx,gy=ty;
 if(!lineClear(guard.x,guard.y,tx,ty)){
  guardRepath-=dt;
  if(!guardPathGoal||Math.hypot(guardPathGoal.x-tx,guardPathGoal.y-ty)>12||guardRepath<=0||!guardPathPts.length){
   guardPathPts=findPath(guard.x,guard.y,tx,ty);guardPathGoal={x:tx,y:ty};guardRepath=0.4;
  }
  while(guardPathPts.length>1&&lineClear(guard.x,guard.y,guardPathPts[1].x,guardPathPts[1].y))guardPathPts.shift();
  if(guardPathPts.length>1&&Math.hypot(guardPathPts[0].x-guard.x,guardPathPts[0].y-guard.y)<6)guardPathPts.shift();
  if(guardPathPts.length){gx=guardPathPts[0].x;gy=guardPathPts[0].y;}
 }else{guardPathPts=[];guardPathGoal=null;}
 const dx=gx-guard.x,dy=gy-guard.y,d=Math.hypot(dx,dy);
 if(d>0.1){const step=Math.min(d,speed*dt);moveGuard(dx/d*step,dy/d*step);guard.angle=Math.atan2(dy,dx);}
}

let hiddenUntil=0;
let sabotageTarget=null;
let sabotageProgress=0;
let sabotageCount=0;
// When sabotage starts, the guard investigates that exact computer.
let guardInvestigateTarget=null;
let guardInvestigateUntil=0;
let guardSearching=false;
let keys={},gameOver=false,gameWon=false,lastTime=0;
let paused=false,screen="menu",rafId=null,pauseStarted=0;
const scoreEl=document.getElementById("score");
const leaderboardBody=document.getElementById("leaderboardBody");
const playerNameEl=document.getElementById("playerName");
let playerName=store.get("stealthPlayerName")||"Player";
playerNameEl.value=playerName;

function updateLeaderboard(){
 const data=JSON.parse(store.get("stealthLeaderboard")||"[]");
 const mine=data.find(x=>x.name===playerName);
 if(mine)mine.score=Math.max(mine.score,sabotageCount);
 else if(sabotageCount>0)data.push({name:playerName,score:sabotageCount});
 data.sort((a,b)=>b.score-a.score);
 store.set("stealthLeaderboard",JSON.stringify(data.slice(0,10)));
 leaderboardBody.innerHTML=data.slice(0,10).map((x,i)=>
   `<tr><td>${i+1}</td><td>${escapeHtml(x.name)}</td><td>${x.score}</td></tr>`).join("");
}
function escapeHtml(v){
 return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}
function setPlayerName(){
 playerName=(playerNameEl.value.trim()||"Player").slice(0,16);
 playerNameEl.value=playerName;
 store.set("stealthPlayerName",playerName);
 updateLeaderboard();
}
playerNameEl.addEventListener("change",setPlayerName);
playerNameEl.addEventListener("blur",setPlayerName);

document.addEventListener("keydown",e=>{
  if(e.target&&e.target.tagName==="INPUT")return; // typing a name must not move/hide/pause
  if(screen==="game"&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault(); // no page scrolling
  keys[e.key]=true;
  if((e.key==="e"||e.key==="E")&&!e.repeat) activateHide();
  if((e.key==="p"||e.key==="P"||e.key==="Escape")&&!e.repeat&&screen==="game"&&!gameOver&&!gameWon){
    togglePause();
  }
});
document.addEventListener("keyup",e=>keys[e.key]=false);
window.addEventListener("blur",()=>{keys={};});
// Switching tabs freezes the game (timers use performance.now, so pause instead of letting them run).
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){keys={};if(screen==="game"&&!paused&&!gameOver&&!gameWon)togglePause();}
});

function blocked(x,y){
 const r=16;
 if(x-r<15||x+r>WIDTH-15||y-r<15||y+r>HEIGHT-15)return true;
 return walls.some(w=>x+r>w.x&&x-r<w.x+w.width&&y+r>w.y&&y-r<w.y+w.height);
}
function movePlayer(dx,dy,dt){
 if(!dx&&!dy)return;
 const len=Math.hypot(dx,dy); dx/=len; dy/=len;
 const nx=player.x+dx*player.speed*dt,ny=player.y+dy*player.speed*dt;
 if(!blocked(nx,player.y))player.x=nx;
 if(!blocked(player.x,ny))player.y=ny;
}
function isHidden(){
 return performance.now()<hiddenUntil;
}
function activateHide(){
 if(screen!=="game"||paused||gameOver||gameWon||isHidden())return;
 hiddenUntil=performance.now()+5000;
 flash("HIDDEN for 5 seconds. Reach a computer while the guard checks the row.",1500);
}
function wallBlocksView(x1,y1,x2,y2){
 const steps=Math.ceil(Math.hypot(x2-x1,y2-y1)/7);
 for(let i=1;i<steps;i++){
  const t=i/steps,x=x1+(x2-x1)*t,y=y1+(y2-y1)*t;
  if(walls.some(w=>x>=w.x&&x<=w.x+w.width&&y>=w.y&&y<=w.y+w.height))return true;
 }
 return false;
}
function playerIsInComputerRow(){
 return computers.some(c =>
   player.x>=c.x && player.x<=c.x+c.width &&
   player.y>=c.y && player.y<=c.y+c.height
 );
}

function guardFacingCardinal(){
 const a=((guard.angle%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
 if(a>=Math.PI/4 && a<3*Math.PI/4) return "down";
 if(a>=3*Math.PI/4 && a<5*Math.PI/4) return "left";
 if(a>=5*Math.PI/4 && a<7*Math.PI/4) return "up";
 return "right";
}
function flashlightDetection(){
 const dx=player.x-guard.x,dy=player.y-guard.y;
 const facing=guardFacingCardinal();
 const forward=facing==="right"?dx:facing==="left"?-dx:facing==="down"?dy:-dy;
 const side=(facing==="right"||facing==="left")?dy:dx;
 if(forward<=12)return false;
 const range=(facing==="up"||facing==="down")?235:215;
 if(forward>range)return false;
 const halfWidth=Math.max(10,forward*((facing==="up"||facing==="down")?0.46:0.24));
 return Math.abs(side)<=halfWidth&&!wallBlocksView(guard.x,guard.y,player.x,player.y);
}
function guardSpriteForState(){
 const facing=guardFacingCardinal();
 // Caution sprites are used while the guard is actively chasing the player.
 if(guard.aggro){
   if(facing==="right")return guardRightCautionImage;
   if(facing==="left")return guardLeftCautionImage;
   return guardFrontCautionImage;
 }
 // Searching sprites are used while investigating the computer that made noise.
 if(guardSearching){
   if(facing==="right")return guardRightSearchingImage;
   if(facing==="left")return guardLeftSearchingImage;
   return guardFrontSearchingImage;
 }
 if(facing==="right")return guardRightNormalImage;
 if(facing==="left")return guardRightNormalImage;
 return guardFrontNormalImage;
}
// [drawW, drawH, offsetX, offsetY] from the guard's position. Each GIF keeps its own aspect ratio and is
// scaled so the guard's BODY is the same size and in the same spot as the normal guard (the search/caution
// art is padded and drawn at a different scale, which is why it used to look stretched).
const GUARD_DRAW=new Map([
 [guardFrontNormalImage,[116, 260, -58, -130]],[guardRightNormalImage,[204, 96, -102, -48]],
 [guardFrontSearchingImage,[255.2, 314.1, -91.9, -150.6]],[guardFrontCautionImage,[255.2, 314.1, -95.8, -150.6]],
 [guardRightSearchingImage,[256.0, 128.0, -122.0, -60.0]],[guardRightCautionImage,[256.0, 128.0, -122.0, -60.0]],
 [guardLeftSearchingImage,[256.0, 128.0, -134.0, -60.0]],[guardLeftCautionImage,[256.0, 128.0, -134.0, -60.0]]
]);
function drawGuard(){
 const facing=guardFacingCardinal(),sprite=guardSpriteForState();
 if(!(sprite.complete&&sprite.naturalWidth>1))return;
 const [dw,dh,dx,dy]=GUARD_DRAW.get(sprite);
 ctx.save();ctx.translate(guard.x,guard.y);
 if(facing==="up")ctx.rotate(Math.PI);
 else if(facing==="left"&&sprite===guardRightNormalImage)ctx.scale(-1,1); // dedicated left GIFs are already mirrored
 ctx.drawImage(sprite,dx,dy,dw,dh);
 ctx.restore();
}
function guardCanSeePlayer(){
 if(isHidden())return false;
 return flashlightDetection();
}

function detected(){
 return guardCanSeePlayer();
}
function updateGuard(dt){
 // Hiding or getting behind a computer row breaks an active chase.
 if(guard.aggro && (isHidden() || playerIsInComputerRow() ||
    wallBlocksView(guard.x,guard.y,player.x,player.y))){
   guard.aggro=false;
 }

 // If the player enters the detection cone/range, start chasing.
 if(!guard.aggro && guardCanSeePlayer()){
   guard.aggro=true;
   guardSearching=false;
   flash("DETECTED! The guard is chasing you!");
 }

 if(guard.aggro){
   guardSearching=false;
   const dx=player.x-guard.x,dy=player.y-guard.y,dist=Math.hypot(dx,dy);
   if(dist>0.1)guardGoTo(player.x,player.y,GUARD_CHASE_SPEED,dt);
 }else if(guardInvestigateTarget && performance.now()<guardInvestigateUntil){
   // Sabotage makes noise: leave the patrol and inspect the computer being sabotaged.
   const c=guardInvestigateTarget;
   // If the player is still actively sabotaging this exact computer, the
   // guard investigates the player's real position instead of stopping at
   // the computer. This lets the guard actually reach the saboteur.
   const playerIsSabotagingThisComputer = sabotageTarget===c && !isHidden();
   const approachY=c.y<270 ? c.y+c.height+24 : c.y-24;
   const targetX=playerIsSabotagingThisComputer ? player.x : c.x+c.width/2;
   const targetY=playerIsSabotagingThisComputer ? player.y : approachY;
   const dx=targetX-guard.x,dy=targetY-guard.y,dist=Math.hypot(dx,dy);

   if(dist>10){
     guardSearching=false;
     guardGoTo(targetX,targetY,GUARD_PATROL_SPEED,dt);
   }else{
     // Use the searching animation while investigating. If the player is
     // still sabotaging, face the player and switch to Caution/chase once
     // the guard reaches or sees them.
     guardSearching=true;
     if(playerIsSabotagingThisComputer){
       guard.angle=Math.atan2(player.y-guard.y,player.x-guard.x);
       const distanceToPlayer=Math.hypot(player.x-guard.x,player.y-guard.y);
       if(distanceToPlayer<=Math.max(34,guard.radius+18) || guardCanSeePlayer()){
         guard.aggro=true;
         guardSearching=false;
         flash("DETECTED! The guard found you sabotaging the computer!");
       }
     }else{
       guard.angle=c.y<270 ? -Math.PI/2 : Math.PI/2;
       if(!isHidden() && guardCanSeePlayer()){
         guard.aggro=true;
         guardSearching=false;
         flash("DETECTED! The guard found you near the computer!");
       }
     }
   }
 }else{
   guardInvestigateTarget=null;
   guardSearching=false;
   const target=guardPath[guard.pathIndex];
   const dx=target.x-guard.x,dy=target.y-guard.y,dist=Math.hypot(dx,dy);
   if(dist<4){
     guard.pathIndex=(guard.pathIndex+1)%guardPath.length;
   }else{
     guardGoTo(target.x,target.y,GUARD_PATROL_SPEED,dt);
   }
 }

 // Show which computer row the guard is inspecting.
 guard.row=guard.y<270?"TOP":guard.y>285?"BOTTOM":"MIDDLE";
}
function touchingComputer(c){
 const pad=30;
 return player.x>c.x-pad&&player.x<c.x+c.width+pad&&
        player.y>c.y-pad&&player.y<c.y+c.height+pad;
}
function currentComputer(){
 const now=performance.now();
 return computers.find(c=>now>=c.sabotagedUntil&&touchingComputer(c))||null;
}
function updateSabotage(dt){
 const target=currentComputer();
 if(target!==sabotageTarget){
   sabotageTarget=target;
   sabotageProgress=0;
   if(target){
     guardInvestigateTarget=target;
     guardInvestigateUntil=performance.now()+5000;
     guardSearching=false;
     flash(target.name+" detected activity! The guard is investigating.",1500);
   }
 }
 if(!target){
   sabotageProgress=0;
   return;
 }
 // Stay beside a computer for the full sabotage duration.
 sabotageProgress+=dt;
 if(sabotageProgress>=SABOTAGE_TIME){
   target.sabotagedUntil=performance.now()+15000;
   sabotageTarget=null;
   sabotageProgress=0;
   sabotageCount++;
   scoreEl.textContent=sabotageCount;
   updateLeaderboard();
   flash(target.name+" sabotaged! +1 point. It will reset in 15 seconds.",2500);
 }
}
// These coordinates are in the 1000x550 canvas space and are tied to the
// background.png layout. The paper's visible pixels line up with the small
// paper/device already painted on the professor's table.
const PROFESSOR_PAPER={x:169.5,y:323.9,size:36};

// The sabotage computer GIF has transparent padding. Drawing the full 116x116
// frame puts its visible computer artwork directly over the matching top/
// bottom-row machine in the supplied map.
const COMPUTER_BLINK={
  "Computer 1":{x:345,y:45,size:116},
  "Computer 2":{x:521,y:45,size:116},
  "Computer 3":{x:345,y:345,size:116},
  "Computer 4":{x:521,y:345,size:116}
};

function drawMapAnimations(){
  // Small animated paper permanently sits on the professor's table.
  if(professorPaperImage.complete&&professorPaperImage.naturalWidth>1){
    ctx.drawImage(professorPaperImage,PROFESSOR_PAPER.x,PROFESSOR_PAPER.y,PROFESSOR_PAPER.size,PROFESSOR_PAPER.size);
  }

  // The animated computer is only visible while that computer is being
  // sabotaged. The GIF itself supplies the blinking animation.
  if(sabotageTarget&&computerSabotageImage.complete&&computerSabotageImage.naturalWidth>1){
    const slot=COMPUTER_BLINK[sabotageTarget.name];
    if(slot)ctx.drawImage(computerSabotageImage,slot.x,slot.y,slot.size,slot.size);
  }
}

function draw(){
 ctx.clearRect(0,0,WIDTH,HEIGHT);
 ctx.drawImage(bg,0,0,WIDTH,HEIGHT);
 ctx.fillStyle="rgba(10,8,24,.10)";ctx.fillRect(0,0,WIDTH,HEIGHT);

 // Map-locked environmental animations must be drawn before the gameplay
 // characters so the player/guard can naturally pass in front of them.
 drawMapAnimations();

 for(const c of computers){
   const cooldown=Math.max(0,(c.sabotagedUntil-performance.now())/1000);
   const ready=cooldown<=0;
   ctx.strokeStyle=ready?"rgba(239,68,68,.55)":"#4A44A0";
   ctx.lineWidth=4;ctx.strokeRect(c.x,c.y,c.width,c.height);
   if(!ready){
     ctx.fillStyle="rgba(74,68,160,.28)";ctx.fillRect(c.x,c.y,c.width,c.height);
     ctx.fillStyle="#17133A";ctx.font="bold 13px Arial";
     ctx.fillText("RESET "+cooldown.toFixed(1)+"s",c.x+20,c.y+c.height/2);
   }else{
     ctx.fillStyle="rgba(239,68,68,.12)";ctx.fillRect(c.x,c.y,c.width,c.height);
   }
 }

 // The supplied guard GIFs include the flashlight artwork.
 // The same flashlight-shaped area is used by guardCanSeePlayer().
 drawGuard();
 ctx.fillStyle="#fff";ctx.font="bold 12px Arial";
 ctx.fillText("ROW "+guard.row,guard.x-24,guard.y-22);

 let playerSprite=playerIdleImage;
 if(isHidden()){
   // While hiding (E), show the matching animated crouching GIF.
   if(player.direction==="up") playerSprite=playerCrouchBackImage;
   else if(player.direction==="down") playerSprite=playerCrouchFrontImage;
   else if(player.direction==="left") playerSprite=playerCrouchLeftImage;
   else playerSprite=playerCrouchRightImage;
 }else if(sabotageTarget){
   // While sabotaging, show the matching animated student sabotage GIF.
   if(player.direction==="up") playerSprite=playerSabotageBackImage;
   else if(player.direction==="down") playerSprite=playerSabotageFrontImage;
   else if(player.direction==="left") playerSprite=playerSabotageLeftImage;
   else playerSprite=playerSabotageRightImage;
 }else if(player.moving){
   if(player.direction==="up") playerSprite=playerBackImage;
   else if(player.direction==="down") playerSprite=playerFrontImage;
   else if(player.direction==="left") playerSprite=playerLeftImage;
   else if(player.direction==="right") playerSprite=playerRightImage;
 }
 if(playerSprite.complete&&playerSprite.naturalWidth>1){
  ctx.globalAlpha=isHidden()?.35:1;
  ctx.drawImage(playerSprite,player.x-player.width/2,player.y-player.height/2,player.width,player.height);
  ctx.globalAlpha=1;
 }else{
  ctx.beginPath();ctx.arc(player.x,player.y,15,0,Math.PI*2);ctx.fillStyle="#38bdf8";ctx.fill();
 }

 if(isHidden()&&!gameOver&&!gameWon){
  const remaining=Math.max(0,(hiddenUntil-performance.now())/1000);
  ctx.fillStyle="#fff";ctx.font="bold 14px Arial";ctx.textAlign="center";
  ctx.fillText("HIDDEN "+remaining.toFixed(1)+"s",player.x,player.y-38);ctx.textAlign="left";
 }

 if(sabotageTarget&&!gameOver&&!gameWon){
  const pct=Math.min(100,sabotageProgress/SABOTAGE_TIME*100);
  ctx.fillStyle="rgba(0,0,0,.75)";ctx.fillRect(player.x-48,player.y-58,96,10);
  ctx.fillStyle="#4A44A0";ctx.fillRect(player.x-48,player.y-58,96*pct/100,10);
 }

 if(gameOver){
  ctx.fillStyle="rgba(0,0,0,.76)";ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.textAlign="center";ctx.fillStyle="#fff";ctx.font="bold 38px Arial";
  ctx.fillText("CAUGHT!",WIDTH/2,HEIGHT/2);
  ctx.font="17px Arial";ctx.fillText("Score: "+sabotageCount+" sabotages. Click Restart to play again.",WIDTH/2,HEIGHT/2+38);
  ctx.textAlign="left";
 }
}
function loop(time){
 let dt=Math.min((time-lastTime)/1000,.035);lastTime=time;
 if(screen!=="game"){ return; }
 if(!paused && !gameOver && !gameWon){
  let dx=0,dy=0;
  if(keys["ArrowLeft"]||keys["a"]||keys["A"])dx--;
  if(keys["ArrowRight"]||keys["d"]||keys["D"])dx++;
  if(keys["ArrowUp"]||keys["w"]||keys["W"])dy--;
  if(keys["ArrowDown"]||keys["s"]||keys["S"])dy++;
  player.moving=!!(dx||dy);
  if(player.moving){
    if(Math.abs(dx)>Math.abs(dy)) player.direction=dx<0?"left":"right";
    else player.direction=dy<0?"up":"down";
  }
  movePlayer(dx,dy,dt);updateGuard(dt);updateSabotage(dt);
  const guardDistance=Math.hypot(player.x-guard.x,player.y-guard.y);
  if(guard.aggro && guardDistance<guard.radius+16) {
    gameOver=true;
    statusText.textContent="CAUGHT! The guard caught you.";
  } else if(performance.now()<statusHoldUntil) {
    /* keep the current event message visible */
  } else if(sabotageTarget) {
    statusText.textContent="Sabotaging "+sabotageTarget.name+"... stay here!";
  } else if(isHidden()) {
    statusText.textContent="Hidden. The guard has stopped chasing. Get to a computer before the 5 seconds run out.";
  } else if(guard.aggro) {
    statusText.textContent="DETECTED! Run or hide behind a computer row to break the chase.";
  } else {
    statusText.textContent="Guard is checking ROW "+guard.row+". Stay out of the flashlight beam.";
  }
 }
 draw();
 rafId=requestAnimationFrame(loop);
}

function togglePause(){
 if(screen!=="game"||gameOver||gameWon)return;
 if(!paused){
  paused=true;
  player.moving=false;
  bgm.pause();
  pauseStarted=performance.now();
 }else{
  const delta=performance.now()-pauseStarted;
  hiddenUntil+=delta;
  guardInvestigateUntil+=delta;
  computers.forEach(c=>{if(c.sabotagedUntil)c.sabotagedUntil+=delta;});
  paused=false;
  bgm.play().catch(()=>{});
  pauseStarted=0;
  lastTime=performance.now();
 }
 document.getElementById("pauseOverlay").classList.toggle("show",paused);
 document.getElementById("pauseBtn").textContent=paused?"RESUME [P]":"PAUSE [P]";
}
function startGame(){
 screen="game";
 if(bgm.paused){ bgm.play().catch(()=>{}); }
 document.getElementById("menuScreen").classList.remove("show");
 document.getElementById("howScreen").classList.remove("show");
 document.getElementById("gameScreen").classList.add("show");
 paused=false;
 document.getElementById("pauseOverlay").classList.remove("show");
 document.getElementById("pauseBtn").textContent="PAUSE [P]";
 restartGame();
 lastTime=performance.now();
 cancelAnimationFrame(rafId);
 rafId=requestAnimationFrame(loop);
}
function returnToMenu(){
 screen="menu";
 bgm.pause();
 bgm.currentTime=0;
 paused=false;
 keys={};
 cancelAnimationFrame(rafId);
 document.getElementById("gameScreen").classList.remove("show");
 document.getElementById("howScreen").classList.remove("show");
 document.getElementById("pauseOverlay").classList.remove("show");
 document.getElementById("menuScreen").classList.add("show");
}
function showHowToPlay(){
 document.getElementById("menuScreen").classList.remove("show");
 document.getElementById("howScreen").classList.add("show");
}
function backFromHowToPlay(){
 document.getElementById("howScreen").classList.remove("show");
 document.getElementById("menuScreen").classList.add("show");
}
function restartGame(){
 paused=false;pauseStarted=0;statusHoldUntil=0;
 document.getElementById("pauseOverlay").classList.remove("show");
 document.getElementById("pauseBtn").textContent="PAUSE [P]";
 if(screen==="game"&&bgm.paused)bgm.play().catch(()=>{});
 player.x=80;player.y=480;player.moving=false;player.direction="down";
 guard.x=350;guard.y=275;guard.pathIndex=0;guard.row="MIDDLE";guard.angle=0;guard.aggro=false;
 hiddenUntil=0;sabotageTarget=null;sabotageProgress=0;sabotageCount=0;
 guardInvestigateTarget=null;guardInvestigateUntil=0;guardSearching=false;guardPathPts=[];guardPathGoal=null;
 scoreEl.textContent="0";
 computers.forEach(c=>c.sabotagedUntil=0);
 gameOver=false;gameWon=false;
 setPlayerName(); // after the reset, so an old score is never credited to a newly typed name
 statusText.textContent="Guard is sweeping the middle aisle between the computer rows.";
}
updateLeaderboard();
// Game starts from the menu.
