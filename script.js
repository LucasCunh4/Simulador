const $=id=>document.getElementById(id);
const canvas=$("sea"),ctx=canvas.getContext("2d"),wheel=$("wheel"),rudderPointer=$("rudderPointer"),frigateRudderPointer=$("frigateRudderPointer"),rudderOrderPointer=$("rudderOrderPointer"),rudderText=$("rudderText"),tankerRudderText=$("tankerRudderText"),frigateRudderText=$("frigateRudderText"),rudderOrderText=$("rudderOrderText"),rotNeedle=$("rotNeedle"),frigateRotNeedle=$("frigateRotNeedle"),rotText=$("rotText"),tankerRotText=$("tankerRotText"),frigateRotText=$("frigateRotText"),headingText=$("heading"),tankerHeading=$("tankerHeading"),frigateHeading=$("frigateHeading"),speedText=$("speedText"),tankerSpeed=$("tankerSpeed"),frigateSpeed=$("frigateSpeed"),shipName=$("shipName"),zoomInput=$("zoom"),scaleText=$("scaleText"),overviewBtn=$("overview"),depthStatus=$("depthStatus"),engineRail=$("engineRail"),engineHandle=$("engineHandle"),engineText=$("engineText");

const settingsOpen=$("settingsOpen"),settingsOverlay=$("settingsOverlay"),settingsClose=$("settingsClose"),cfgRudderTime=$("cfgRudderTime"),cfgRudderTimeRange=$("cfgRudderTimeRange"),rudderTimeExample=$("rudderTimeExample"),cfgGrowth=$("cfgGrowth"),cfgGrowthValue=$("cfgGrowthValue"),settingsStatus=$("settingsStatus"),rotMatrix=$("rotMatrix"),speedGraph=$("speedGraph"),speedGraphCtx=speedGraph.getContext("2d"),rotGraph=$("rotGraph"),rotGraphCtx=rotGraph.getContext("2d"),rotGraphLegend=$("rotGraphLegend"),rotMaxLeft=$("rotMaxLeft"),rotMaxRight=$("rotMaxRight"),rotMidLeft=$("rotMidLeft"),rotMidRight=$("rotMidRight");

const speedConfigInputs=[...document.querySelectorAll(".speedConfigInput")],dynamicInputs=[...document.querySelectorAll(".dynamicInput")];

const KNOT_TO_MPS=.514444,baseTimeScale=4,rudderAngles=[5,10,15,20,25,30,35];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value)),lerp=(a,b,t)=>a+(b-a)*t,norm=value=>(value%360+360)%360;

const ships={
 tanker:{
  name:"NAVIO-TANQUE",
  short:"TANQUE",
  loa:242.8,
  lpp:228,
  beam:32.2,
  draft:12.5,
  cb:.8,
  color:"#82ecff",
  trail:"rgba(130,236,255,.82)",
  wanderFrequency:.018
 },
 frigate:{
  name:"FRAGATA",
  short:"FRAGATA",
  loa:135.6,
  lpp:124.4,
  beam:14.3,
  draft:4.8,
  cb:.45,
  color:"#ffd76a",
  trail:"rgba(255,215,106,.86)",
  wanderFrequency:.022
 }
};

const configDefaults={
 tanker:{
  deepAheadSpeeds:[0,5.5,8.2,11,13.8],
  deepAsternSpeeds:[0,2.8,4.1,5.3,6],
  shallowAheadSpeeds:[0,5.8,8.9,10.9,12.6],
  shallowAsternSpeeds:[0,2.3,4,4.9,5.2],
  rotSpeeds:[3,5,8,10,12,15],
  rotTable:[
   [2.4,3.9,6.3,7.9,9.5,11.8],
   [3.3,5.6,8.9,11.1,13.3,16.7],
   [4,6.6,10.6,13.2,15.8,19.8],
   [4.4,7.3,11.7,14.6,17.5,21.9],
   [4.7,7.8,12.4,15.5,18.6,23.3],
   [4.8,8,12.8,16.1,19.3,24.1],
   [4.9,8.2,13,16.3,19.6,24.5]
  ],
  rudderTravelSeconds:30.2,
  accelerationMps2:.0575,
  coastDecelerationMps2:.006,
  tauRefSec:102,
  tauRefSpeedKn:15,
  rotGrowth:1,
  rudderV50Kn:3,
  turnSpeedLoss:.52,
  turnSpeedExponent:.6,
  maxRotDeep:24.5,
  maxRotShallow:14.7,
  shallowStability:1.5,
  wanderAmplitude:0,
  growth:1
 },
 frigate:{
  deepAheadSpeeds:[0,3,5,10,35],
  deepAsternSpeeds:[0,3,5,10,15],
  shallowAheadSpeeds:[0,3,5,9,28],
  shallowAsternSpeeds:[0,2.8,4.8,8,10],
  rotSpeeds:[5,10,15,20,25],
  rotTable:[
   [12,25,37,49,55],
   [17,33,50,67,75],
   [20,39,59,79,88],
   [22,44,65,87,97],
   [23,47,70,94,105],
   [25,49,74,99,110],
   [26,51,77,102,114]
  ],
  rudderTravelSeconds:7.8,
  accelerationMps2:.75,
  coastDecelerationMps2:.12,
  tauRefSec:5.6,
  tauRefSpeedKn:18,
  rotGrowth:.1,
  rudderV50Kn:2,
  turnSpeedLoss:.26,
  turnSpeedExponent:.8,
  maxRotDeep:114,
  maxRotShallow:84.4,
  shallowStability:1.3,
  wanderAmplitude:3,
  growth:1
 }
};

const CONFIG_KEY="simulador-manobra-config-v5";

const cleanNumber=(value,fallback,min,max)=>{
 const number=Number(value);
 return Number.isFinite(number)?clamp(number,min,max):fallback
};

const cleanSeries=(source,fallback,max)=>fallback.map((value,index)=>index===0?0:cleanNumber(source&&source[index],value,0,max));

const cleanMatrix=(source,fallback)=>fallback.map((row,rowIndex)=>row.map((value,columnIndex)=>cleanNumber(source&&source[rowIndex]&&source[rowIndex][columnIndex],value,0,240)));

function sanitizeConfig(value,fallback){
 value=value||{};

 const maxRotDeep=cleanNumber(value.maxRotDeep,fallback.maxRotDeep,1,240);

 const legacyShallow=value.maxRotShallow===undefined
  ?maxRotDeep*cleanNumber(value.shallowRotFactor,fallback.maxRotShallow/fallback.maxRotDeep,.01,.99)
  :value.maxRotShallow;

 const maxRotShallow=cleanNumber(
  legacyShallow,
  fallback.maxRotShallow,
  .1,
  Math.max(.1,maxRotDeep-.1)
 );

 return{
  deepAheadSpeeds:cleanSeries(value.deepAheadSpeeds,fallback.deepAheadSpeeds,60),
  deepAsternSpeeds:cleanSeries(value.deepAsternSpeeds,fallback.deepAsternSpeeds,40),
  shallowAheadSpeeds:cleanSeries(value.shallowAheadSpeeds,fallback.shallowAheadSpeeds,60),
  shallowAsternSpeeds:cleanSeries(value.shallowAsternSpeeds,fallback.shallowAsternSpeeds,40),
  rotSpeeds:[...fallback.rotSpeeds],
  rotTable:cleanMatrix(value.rotTable,fallback.rotTable),
  rudderTravelSeconds:cleanNumber(value.rudderTravelSeconds,fallback.rudderTravelSeconds,1,60),
  accelerationMps2:cleanNumber(value.accelerationMps2,fallback.accelerationMps2,.001,2),
  coastDecelerationMps2:cleanNumber(value.coastDecelerationMps2,fallback.coastDecelerationMps2,.001,1),
  tauRefSec:cleanNumber(value.tauRefSec,fallback.tauRefSec,.5,600),
  tauRefSpeedKn:cleanNumber(value.tauRefSpeedKn,fallback.tauRefSpeedKn,1,40),
  rotGrowth:cleanNumber(value.rotGrowth,fallback.rotGrowth,.1,3),
  rudderV50Kn:cleanNumber(value.rudderV50Kn,fallback.rudderV50Kn,.1,10),
  turnSpeedLoss:cleanNumber(value.turnSpeedLoss,fallback.turnSpeedLoss,0,.9),
  turnSpeedExponent:cleanNumber(value.turnSpeedExponent,fallback.turnSpeedExponent,.1,2),
  maxRotDeep,
  maxRotShallow:Math.min(maxRotShallow,Math.max(.1,maxRotDeep-.1)),
  shallowStability:cleanNumber(value.shallowStability,fallback.shallowStability,.5,3),
  wanderAmplitude:cleanNumber(value.wanderAmplitude,fallback.wanderAmplitude,0,10),
  growth:cleanNumber(value.growth,fallback.growth,.25,3)
 }
}

const cloneConfig=config=>JSON.parse(JSON.stringify(config));

const copyConfigs=configs=>({
 tanker:cloneConfig(configs.tanker),
 frigate:cloneConfig(configs.frigate)
});

function loadConfigs(){
 let saved={};

 try{
  saved=JSON.parse(localStorage.getItem(CONFIG_KEY)||"{}")||{}
 }catch(error){
  saved={}
 }

 return{
  tanker:sanitizeConfig(saved.tanker,configDefaults.tanker),
  frigate:sanitizeConfig(saved.frigate,configDefaults.frigate)
 }
}

let vesselConfigs=loadConfigs();

function applyVesselConfig(key){
 ships[key].maxROT=vesselConfigs[key].maxRotDeep
}

Object.keys(ships).forEach(applyVesselConfig);

const engineNames={
 "-4":"FULL ASTERN",
 "-3":"HALF ASTERN",
 "-2":"SLOW ASTERN",
 "-1":"DEAD SLOW ASTERN",
 "0":"SEM MÁQUINA",
 "1":"DEAD SLOW AHEAD",
 "2":"SLOW AHEAD",
 "3":"HALF AHEAD",
 "4":"FULL AHEAD"
};

const createState=key=>({
 key,
 x:0,
 y:0,
 heading:0,
 rudder:0,
 rot:0,
 helmRot:0,
 wanderRot:0,
 yawTau:0,
 yawReversing:false,
 speedKnots:0,
 straightTargetKnots:0,
 trail:[],
 trailStep:4
});

const states={
 tanker:createState("tanker"),
 frigate:createState("frigate")
};

let shipMode="tanker",
waterMode="deep",
timeScale=1,
engineOrder=0,
depthMix=0,
rudderOrder=0,
wheelAngle=0,
dragging=false,
engineDragging=false,
lastPointerAngle=0,
lastTime=performance.now(),
seaTime=0,
simulationTime=0,
zoom=1,
cameraMode="follow";

function activeKeys(){
 return shipMode==="compare"?["tanker","frigate"]:[shipMode]
}

function resize(){
 const rect=canvas.getBoundingClientRect();
 const density=devicePixelRatio||1;

 canvas.width=rect.width*density;
 canvas.height=rect.height*density;

 ctx.setTransform(density,0,0,density,0,0);

 if(settingsOverlay.classList.contains("open")){
  drawSettingsGraphs()
 }
}

addEventListener("resize",resize);
resize();

function pointerAngle(event){
 const rect=wheel.getBoundingClientRect();

 return Math.atan2(
  event.clientY-rect.top-rect.height/2,
  event.clientX-rect.left-rect.width/2
 )*180/Math.PI
}

wheel.onpointerdown=event=>{
 dragging=true;
 wheel.setPointerCapture(event.pointerId);
 lastPointerAngle=pointerAngle(event)
};

wheel.onpointermove=event=>{
 if(!dragging)return;

 let angle=pointerAngle(event);
 let delta=angle-lastPointerAngle;

 if(delta>180)delta-=360;
 if(delta<-180)delta+=360;

 wheelAngle=clamp(wheelAngle+delta,-270,270);
 lastPointerAngle=angle;
 rudderOrder=wheelAngle/270*35;

 updateWheel()
};

wheel.onpointerup=wheel.onpointercancel=()=>{
 dragging=false
};

$("midships").onclick=()=>{
 rudderOrder=0;
 wheelAngle=0;
 updateWheel()
};

function updateWheel(){
 wheel.style.rotate=wheelAngle+"deg"
}

function setEngine(value){
 engineOrder=clamp(Math.round(value),-4,4);
 updateEngine()
}

function updateEngine(){
 const name=engineNames[engineOrder];
 const kind=engineOrder>0?"ahead":engineOrder<0?"astern":"stop";

 engineHandle.style.top=50-engineOrder*11.1+"%";
 engineHandle.className="engineHandle "+kind;
 engineHandle.setAttribute("aria-valuenow",engineOrder);
 engineHandle.setAttribute("aria-valuetext",name);

 engineText.textContent=name;
 engineText.className="engineText "+kind;

 document.querySelectorAll(".engineStep").forEach(button=>{
  button.classList.toggle("active",+button.dataset.engine===engineOrder)
 })
}

function engineAtPointer(event){
 const rect=engineRail.getBoundingClientRect();

 return clamp(
  Math.round((.5-clamp((event.clientY-rect.top)/rect.height,0,1))*8),
  -4,
  4
 )
}

engineRail.onpointerdown=event=>{
 engineDragging=true;
 engineRail.setPointerCapture(event.pointerId);
 setEngine(engineAtPointer(event))
};

engineRail.onpointermove=event=>{
 if(engineDragging){
  setEngine(engineAtPointer(event))
 }
};

engineRail.onpointerup=engineRail.onpointercancel=()=>{
 engineDragging=false
};

engineHandle.onkeydown=event=>{
 if(event.key==="ArrowUp"||event.key==="ArrowRight"){
  event.preventDefault();
  setEngine(engineOrder+1)
 }else if(event.key==="ArrowDown"||event.key==="ArrowLeft"){
  event.preventDefault();
  setEngine(engineOrder-1)
 }else if(event.key==="Home"){
  event.preventDefault();
  setEngine(4)
 }else if(event.key==="End"){
  event.preventDefault();
  setEngine(-4)
 }else if(event.key===" "||event.key==="0"){
  event.preventDefault();
  setEngine(0)
 }
};

document.querySelectorAll(".engineStep").forEach(button=>{
 button.onclick=()=>setEngine(+button.dataset.engine)
});

function resetState(key,x=0){
 const state=states[key];

 state.x=x;
 state.y=0;

 state.heading=0;
 state.rudder=0;
 state.rot=0;
 state.helmRot=0;
 state.wanderRot=0;
 state.yawTau=0;
 state.speedKnots=0;
 state.straightTargetKnots=0;

 state.yawReversing=false;

 state.trail=[];
 state.trailStep=4
}

function resetSimulation(){
 rudderOrder=0;
 wheelAngle=0;
 simulationTime=0;
 engineOrder=0;

 const separation=ships.tanker.loa*.72;

 resetState(
  "tanker",
  shipMode==="compare"?-separation:0
 );

 resetState(
  "frigate",
  shipMode==="compare"?separation:0
 );

 cameraMode="follow";

 overviewBtn.classList.remove("active");
 overviewBtn.textContent="VER TRAJETÓRIA";

 updateWheel();
 updateEngine();
 setZoom(1);
 updateInstruments()
}

document.querySelectorAll(".shipBtn").forEach(button=>{
 button.onclick=()=>{
  document.querySelectorAll(".shipBtn").forEach(item=>{
   item.classList.remove("active")
  });

  button.classList.add("active");

  shipMode=button.dataset.mode;

  document.body.classList.toggle(
   "comparison",
   shipMode==="compare"
  );

  shipName.textContent=shipMode==="compare"
   ?"COMPARAÇÃO SIMULTÂNEA"
   :ships[shipMode].name;

  resetSimulation()
 }
});

document.querySelectorAll(".waterBtn").forEach(button=>{
 button.onclick=()=>{
  document.querySelectorAll(".waterBtn").forEach(item=>{
   item.classList.remove("active")
  });

  button.classList.add("active");

  waterMode=button.dataset.water;

  depthStatus.innerHTML=waterMode==="shallow"
   ?"<strong>ÁGUAS RASAS · h/T ≈ 1,2</strong><span>Menor ROT, maior estabilidade e velocidades próprias da tabela</span>"
   :"<strong>ÁGUAS PROFUNDAS</strong><span>Curvas e velocidades de referência</span>"
 }
});

document.querySelectorAll(".speedBtn").forEach(button=>{
 button.onclick=()=>{
  document.querySelectorAll(".speedBtn").forEach(item=>{
   item.classList.remove("active")
  });

  button.classList.add("active");

  timeScale=+button.dataset.speed
 }
});

function speedTargetForOrder(key,config,order,mix=depthMix){
 if(!order)return 0;

 const index=Math.abs(order);
 const direction=order>0?"Ahead":"Astern";

 const deep=config["deep"+direction+"Speeds"][index];
 const shallow=config["shallow"+direction+"Speeds"][index];

 return Math.sign(order)*lerp(deep,shallow,mix)
}

function approachSpeed(currentKnots,targetKnots,dt,config){
 if(Math.abs(targetKnots-currentKnots)<.005){
  return targetKnots
 }

 const current=currentKnots*KNOT_TO_MPS;
 const target=targetKnots*KNOT_TO_MPS;

 const sameDirection=current*target>0;
 const increasing=sameDirection&&Math.abs(target)>Math.abs(current);
 const fromStop=Math.abs(current)<.002&&Math.abs(target)>.002;

 let rate;

 if(Math.abs(target)<.002){
  rate=config.coastDecelerationMps2
 }else if(current*target<0){
  rate=Math.max(
   config.coastDecelerationMps2,
   config.accelerationMps2*.65
  )
 }else if(!increasing&&!fromStop){
  rate=Math.max(
   config.coastDecelerationMps2,
   config.accelerationMps2*.35
  )
 }else{
  const ratio=clamp(
   Math.abs(current)/Math.max(Math.abs(target),.001),
   0,
   .999
  );

  rate=config.accelerationMps2*Math.max(
   .003,
   1-ratio*ratio
  )
 }

 const step=rate*config.growth*dt/KNOT_TO_MPS;

 return currentKnots+
  Math.sign(targetKnots-currentKnots)*
  Math.min(
   Math.abs(targetKnots-currentKnots),
   step
  )
}

function interpolateAtSpeed(axis,values,speed){
 speed=Math.max(0,speed);

 if(speed<=axis[0]){
  return values[0]*speed/axis[0]
 }

 for(let index=1;index<axis.length;index++){
  if(speed<=axis[index]){
   return lerp(
    values[index-1],
    values[index],
    (speed-axis[index-1])/(axis[index]-axis[index-1])
   )
  }
 }

 return values[values.length-1]*Math.min(
  1.2,
  speed/axis[axis.length-1]
 )
}

function lookupROT(config,speed,angle){
 const rudder=Math.abs(angle);

 if(rudder<.0001||speed<.0001){
  return 0
 }

 const rowValues=config.rotTable.map(row=>{
  return interpolateAtSpeed(
   config.rotSpeeds,
   row,
   speed
  )
 });

 if(rudder<=5){
  return rowValues[0]*rudder/5
 }

 const position=rudder/5-1;
 const low=Math.floor(position);
 const high=Math.min(
  rowValues.length-1,
  low+1
 );

 return lerp(
  rowValues[low],
  rowValues[high],
  position-low
 )
}

function rudderEfficiency(speed,v50){
 const speed2=speed*speed;
 const v502=v50*v50;

 const raw=speed2/(speed2+v502);
 const reference=100/(100+v502);

 return clamp(
  raw/reference,
  0,
  1
 )
}

function lowSpeedCorrection(config,speed){
 const first=config.rotSpeeds[0];

 const reference=rudderEfficiency(
  first,
  config.rudderV50Kn
 );

 return clamp(
  rudderEfficiency(
   speed,
   config.rudderV50Kn
  )/Math.max(reference,.001),
  0,
  1
 )
}

function rotLimits(config,rawROT){
 const deep=Math.min(
  Math.max(0,rawROT),
  config.maxRotDeep
 );

 const shallowRatio=
  config.maxRotShallow/
  config.maxRotDeep;

 const shallow=Math.min(
  deep*shallowRatio,
  config.maxRotShallow
 );

 return{
  deep,
  shallow,
  current:lerp(
   deep,
   shallow,
   depthMix
  )
 }
}

function simulateVessel(key,dt){
 const vessel=ships[key];
 const config=vesselConfigs[key];
 const state=states[key];

 const rudderRate=
  70/config.rudderTravelSeconds;

 state.rudder+=clamp(
  rudderOrder-state.rudder,
  -rudderRate*dt,
  rudderRate*dt
 );

 const straightTarget=
  speedTargetForOrder(
   key,
   config,
   engineOrder
  );

 const rudderFraction=clamp(
  Math.abs(state.rudder)/35,
  0,
  1
 );

 const turnFactor=clamp(
  1-config.turnSpeedLoss*
  Math.pow(
   rudderFraction,
   config.turnSpeedExponent
  ),
  .1,
  1
 );

 const speedTarget=
  straightTarget*turnFactor;

 state.straightTargetKnots=
  straightTarget;

 state.speedKnots=approachSpeed(
  state.speedKnots,
  speedTarget,
  dt,
  config
 );

 const absoluteSpeed=
  Math.abs(state.speedKnots);

 const sameTravelDirection=
  Math.sign(state.speedKnots)===
  Math.sign(straightTarget);

 const equivalentUncapped=
  absoluteSpeed/turnFactor;

 const atOrBelowOrderedSpeed=
  absoluteSpeed<=
  Math.abs(straightTarget)+.05;

 const equivalentSpeed=
  engineOrder&&
  sameTravelDirection&&
  atOrBelowOrderedSpeed
   ?Math.min(
     Math.abs(straightTarget),
     equivalentUncapped
    )
   :equivalentUncapped;

 const direction=
  Math.abs(state.speedKnots)<.03
   ?0
   :Math.sign(state.speedKnots);

 const rawROT=
  lookupROT(
   config,
   equivalentSpeed,
   state.rudder
  )*
  lowSpeedCorrection(
   config,
   absoluteSpeed
  );

 const limitedROT=
  rotLimits(
   config,
   rawROT
  );

 const targetROT=
  Math.sign(state.rudder)*
  direction*
  limitedROT.current;

 const referenceSpeed=
  Math.max(
   equivalentSpeed,
   3
  );

 const stability=
  lerp(
   1,
   config.shallowStability,
   depthMix
  );

 const sameYaw=
  targetROT*state.helmRot>=0;

 const building=
  Math.abs(state.helmRot)<.01||
  (
   sameYaw&&
   Math.abs(targetROT)>
   Math.abs(state.helmRot)
  );

 const checking=
  targetROT&&
  sameYaw&&
  Math.abs(targetROT)<
  Math.abs(state.helmRot);

 const baseTau=
  config.tauRefSec*
  config.tauRefSpeedKn/
  referenceSpeed;

 if(targetROT*state.helmRot<-.0001){
  state.yawReversing=true
 }

 const reversalRelease=
  Math.min(
   Math.abs(targetROT)*.12,
   1
  );

 const newSideEstablished=
  state.yawReversing&&
  sameYaw&&
  Math.abs(state.helmRot)>=
  reversalRelease&&
  reversalRelease>.02;

 if(
  newSideEstablished||
  (
   Math.abs(targetROT)<.001&&
   Math.abs(state.helmRot)<.01
  )
 ){
  state.yawReversing=false
 }

 const desiredTau=Math.max(
  .15,
  state.yawReversing
   ?baseTau*.75/stability
   :checking
    ?baseTau*.9/stability
    :baseTau*(
      building
       ?stability
       :1
     )
 );

 state.yawTau=
  state.yawTau>0
   ?state.yawTau+
    (desiredTau-state.yawTau)*
    (
     1-Math.exp(-dt/1.5)
    )
   :desiredTau;

 const yawAlpha=
  1-Math.exp(
   -dt*
   config.rotGrowth/
   state.yawTau
  );

 state.helmRot+=
  (targetROT-state.helmRot)*
  yawAlpha;

 if(
  !state.yawReversing&&
  Math.abs(targetROT)<.001&&
  Math.abs(state.helmRot)<.004
 ){
  state.helmRot=0
 }

 const wanderFlow=
  rudderEfficiency(
   absoluteSpeed,
   config.rudderV50Kn
  );

 const wanderPhase=
  simulationTime*
  vessel.wanderFrequency;

 const wanderWave=
  .72*Math.cos(wanderPhase)+
  .28*Math.cos(wanderPhase*3);

 const wanderTarget=
  config.wanderAmplitude*
  wanderFlow*
  Math.sign(state.speedKnots||1)*
  wanderWave;

 const activeRotCap=
  lerp(
   config.maxRotDeep,
   config.maxRotShallow,
   depthMix
  );

 state.wanderRot=
  wanderTarget/stability;

 state.rot=clamp(
  state.helmRot+
  state.wanderRot,
  -activeRotCap,
  activeRotCap
 );

 state.heading=norm(
  state.heading+
  state.rot/60*dt
 );

 const headingRad=
  state.heading*
  Math.PI/180;

 const distance=
  state.speedKnots*
  KNOT_TO_MPS*
  dt;

 state.x+=
  Math.sin(headingRad)*
  distance;

 state.y-=
  Math.cos(headingRad)*
  distance;

 const last=
  state.trail[
   state.trail.length-1
  ];

 if(
  !last||
  Math.hypot(
   state.x-last.x,
   state.y-last.y
  )>state.trailStep
 ){
  state.trail.push({
   x:state.x,
   y:state.y
  });

  if(state.trail.length>12000){
   state.trail=
    state.trail.filter(
     (point,index)=>
      index%2===0||
      index===state.trail.length-1
    );

   state.trailStep*=2
  }
 }
}

function physics(dt){
 const depthTarget=
  waterMode==="shallow"
   ?1
   :0;

 depthMix+=
  (depthTarget-depthMix)*
  (
   1-Math.exp(-dt/8)
  );

 activeKeys().forEach(key=>{
  simulateVessel(key,dt)
 });

 seaTime+=dt;
 simulationTime+=dt
}

function getBounds(includeTrails){
 const keys=activeKeys();

 let minX=Infinity;
 let maxX=-Infinity;
 let minY=Infinity;
 let maxY=-Infinity;

 const add=(x,y,radius=0)=>{
  minX=Math.min(
   minX,
   x-radius
  );

  maxX=Math.max(
   maxX,
   x+radius
  );

  minY=Math.min(
   minY,
   y-radius
  );

  maxY=Math.max(
   maxY,
   y+radius
  )
 };

 keys.forEach(key=>{
  const state=states[key];

  add(
   state.x,
   state.y,
   ships[key].loa*.58
  );

  if(includeTrails){
   state.trail.forEach(point=>{
    add(point.x,point.y)
   })
  }
 });

 return{
  minX,
  maxX,
  minY,
  maxY
 }
}

function camera(){
 const width=canvas.clientWidth;
 const height=canvas.clientHeight;

 if(
  cameraMode==="follow"&&
  shipMode!=="compare"
 ){
  const vessel=ships[shipMode];
  const state=states[shipMode];

  const baseScale=Math.min(
   width/(vessel.loa*3.3),
   height/(vessel.loa*2.05),
   4
  );

  return{
   x:state.x,
   y:state.y,
   scale:baseScale*zoom
  }
 }

 const bounds=
  getBounds(
   cameraMode==="overview"
  );

 const padding=
  cameraMode==="overview"
   ?62
   :82;

 const spanX=Math.max(
  50,
  bounds.maxX-bounds.minX
 );

 const spanY=Math.max(
  50,
  bounds.maxY-bounds.minY
 );

 const scale=Math.max(
  .001,
  Math.min(
   (width-padding*2)/spanX,
   (height-padding*2)/spanY
  )
 );

 return{
  x:(bounds.minX+bounds.maxX)/2,
  y:(bounds.minY+bounds.maxY)/2,
  scale:
   cameraMode==="overview"
    ?scale
    :scale*zoom
 }
}

function focusPoint(){
 const keys=activeKeys();

 return{
  x:keys.reduce(
   (sum,key)=>
    sum+states[key].x,
   0
  )/keys.length,

  y:keys.reduce(
   (sum,key)=>
    sum+states[key].y,
   0
  )/keys.length
 }
}

function rgb(a,b,t){
 return"rgb("+
  Math.round(lerp(a[0],b[0],t))+","+
  Math.round(lerp(a[1],b[1],t))+","+
  Math.round(lerp(a[2],b[2],t))+
 ")"
}

function drawSea(){
 const width=canvas.clientWidth;
 const height=canvas.clientHeight;

 const gradient=
  ctx.createLinearGradient(
   0,
   0,
   0,
   height
  );

 const deep=[
  [34,160,191],
  [20,132,170],
  [9,94,133]
 ];

 const shallow=[
  [91,203,196],
  [55,178,176],
  [33,143,151]
 ];

 const focus=focusPoint();

 for(let index=0;index<3;index++){
  gradient.addColorStop(
   index/2,
   rgb(
    deep[index],
    shallow[index],
    depthMix
   )
  )
 }

 ctx.fillStyle=gradient;
 ctx.fillRect(
  0,
  0,
  width,
  height
 );

 ctx.lineWidth=1;

 for(
  let row=-60;
  row<height+70;
  row+=38
 ){
  ctx.beginPath();

  for(
   let x=-60;
   x<width+70;
   x+=12
  ){
   const y=
    row+
    Math.sin(
     (x+focus.x*.14)*.021+
     seaTime*.7
    )*4+
    Math.sin(
     x*.009+
     (row+focus.y*.14)*.012-
     seaTime*.35
    )*3;

   x===-60
    ?ctx.moveTo(x,y)
    :ctx.lineTo(x,y)
  }

  ctx.strokeStyle=
   "rgba(235,253,252,"+
   lerp(.14,.25,depthMix)+
   ")";

  ctx.stroke()
 }

 if(depthMix>.02){
  ctx.strokeStyle=
   "rgba(246,231,174,"+
   depthMix*.14+
   ")";

  ctx.lineWidth=1.2;

  for(
   let y=25;
   y<height;
   y+=62
  ){
   ctx.beginPath();
   ctx.moveTo(-20,y);

   ctx.bezierCurveTo(
    width*.3,
    y+12,
    width*.68,
    y-12,
    width+20,
    y+4
   );

   ctx.stroke()
  }
 }
}

function pointToScreen(x,y,cam){
 return{
  x:
   canvas.clientWidth/2+
   (x-cam.x)*cam.scale,

  y:
   canvas.clientHeight/2+
   (y-cam.y)*cam.scale
 }
}

function drawTrail(key,cam){
 const state=states[key];

 if(state.trail.length<2){
  return
 }

 ctx.beginPath();

 state.trail.forEach(
  (point,index)=>{
   const screen=
    pointToScreen(
     point.x,
     point.y,
     cam
    );

   index
    ?ctx.lineTo(
      screen.x,
      screen.y
     )
    :ctx.moveTo(
      screen.x,
      screen.y
     )
  }
 );

 ctx.strokeStyle=
  shipMode==="compare"
   ?ships[key].trail
   :"rgba(255,255,255,.76)";

 ctx.lineWidth=2.2;
 ctx.lineCap="round";
 ctx.lineJoin="round";
 ctx.stroke();

 const start=
  pointToScreen(
   state.trail[0].x,
   state.trail[0].y,
   cam
  );

 ctx.beginPath();
 ctx.arc(
  start.x,
  start.y,
  4,
  0,
  Math.PI*2
 );

 ctx.fillStyle=
  shipMode==="compare"
   ?ships[key].color
   :"white";

 ctx.fill()
}

function drawShip(key,cam){
 const vessel=ships[key];
 const state=states[key];

 const point=
  pointToScreen(
   state.x,
   state.y,
   cam
  );

 const visualScale=
  Math.max(
   cam.scale,
   8/vessel.loa
  );

 const length=
  vessel.loa*
  visualScale;

 const width=
  vessel.beam*
  visualScale;

 ctx.save();
 ctx.translate(
  point.x,
  point.y
 );

 ctx.rotate(
  state.heading*
  Math.PI/180
 );

 ctx.shadowColor=
  "rgba(0,0,0,.5)";

 ctx.shadowBlur=12;
 ctx.shadowOffsetY=6;

 key==="tanker"
  ?drawTanker(
    length,
    width
   )
  :drawFrigate(
    length,
    width
   );

 ctx.restore();

 if(shipMode==="compare"){
  drawShipLabel(
   vessel.short,
   point.x,
   point.y-length*.58-18,
   vessel.color
  )
 }
}

function drawShipLabel(label,x,y,color){
 ctx.save();

 ctx.font="bold 9px Arial";
 ctx.textAlign="center";
 ctx.textBaseline="middle";

 const width=
  ctx.measureText(label).width+
  14;

 ctx.fillStyle=
  "rgba(4,20,27,.82)";

 ctx.strokeStyle=color;
 ctx.lineWidth=1;

 ctx.beginPath();

 ctx.roundRect(
  x-width/2,
  y-10,
  width,
  20,
  5
 );

 ctx.fill();
 ctx.stroke();

 ctx.fillStyle=color;
 ctx.fillText(
  label,
  x,
  y
 );

 ctx.restore()
}

function drawTanker(length,width){
 ctx.beginPath();

 ctx.moveTo(
  0,
  -length/2
 );

 ctx.lineTo(
  width*.46,
  -length*.41
 );

 ctx.lineTo(
  width/2,
  length*.4
 );

 ctx.quadraticCurveTo(
  width*.45,
  length/2,
  0,
  length/2
 );

 ctx.quadraticCurveTo(
  -width*.45,
  length/2,
  -width/2,
  length*.4
 );

 ctx.lineTo(
  -width*.46,
  -length*.41
 );

 ctx.closePath();

 ctx.fillStyle="#a94f46";
 ctx.fill();

 ctx.strokeStyle="#f0a092";
 ctx.stroke();

 ctx.fillStyle="#773633";

 for(
  let y=-length*.3;
  y<length*.2;
  y+=Math.max(
   5,
   length*.105
  )
 ){
  ctx.fillRect(
   -width*.37,
   y,
   width*.74,
   Math.max(
    3,
    length*.06
   )
  )
 }

 ctx.fillStyle="#e0e8e7";

 ctx.fillRect(
  -width*.39,
  length*.22,
  width*.78,
  length*.17
 );

 ctx.fillStyle="#597983";

 ctx.fillRect(
  -width*.3,
  length*.17,
  width*.6,
  length*.06
 )
}

function drawFrigate(length,width){
 ctx.beginPath();

 ctx.moveTo(
  0,
  -length/2
 );

 ctx.lineTo(
  width*.4,
  -length*.31
 );

 ctx.lineTo(
  width/2,
  length*.28
 );

 ctx.lineTo(
  width*.34,
  length/2
 );

 ctx.lineTo(
  -width*.34,
  length/2
 );

 ctx.lineTo(
  -width/2,
  length*.28
 );

 ctx.lineTo(
  -width*.4,
  -length*.31
 );

 ctx.closePath();

 ctx.fillStyle="#9ba9ad";
 ctx.fill();

 ctx.strokeStyle="#eef5f6";
 ctx.stroke();

 ctx.fillStyle="#52666d";

 ctx.fillRect(
  -width*.28,
  -length*.1,
  width*.56,
  length*.24
 );

 ctx.fillStyle="#40535a";

 ctx.beginPath();

 ctx.arc(
  0,
  -length*.29,
  width*.18,
  0,
  Math.PI*2
 );

 ctx.fill()
}

const rotLabel=value=>{
 const absolute=Math.abs(value);

 return absolute<.005
  ?"0.00°/min"
  :absolute.toFixed(
    absolute<1?2:1
   )+
   "°/min "+
   (
    value<0
     ?"BB"
     :"BE"
   )
};

const speedLabel=value=>
 Math.abs(value)<.05
  ?"0.0 kn"
  :(value<0?"−":"")+
   Math.abs(value).toFixed(1)+
   " kn";

const rudderLabel=value=>
 Math.abs(value)<.05
  ?"0°"
  :Math.abs(value).toFixed(1)+
   "° "+
   (
    value<0
     ?"BB"
     :"BE"
   );

function updateSpeed(element,value){
 element.textContent=
  speedLabel(value);

 element.style.color=
  value<-.05
   ?"var(--port)"
   :value>.05
    ?"var(--starboard)"
    :"white"
}

function setRudderMarker(element,value,comparisonColor){
 element.style.left=
  clamp(
   50+
   value/35*50,
   1,
   99
  )+"%";

 if(!comparisonColor){
  element.style.borderBottomColor=
   value<-.05
    ?"var(--port)"
    :value>.05
     ?"var(--starboard)"
     :"white"
 }
}

function updateInstruments(){
 const order=
  Math.abs(rudderOrder)<.05
   ?0
   :rudderOrder;

 rudderOrderPointer.style.left=
  clamp(
   50+
   rudderOrder/35*50,
   1,
   99
  )+"%";

 rudderOrderPointer.style.borderTopColor=
  order<0
   ?"var(--port)"
   :order>0
    ?"var(--starboard)"
    :"#ffd76a";

 rudderOrderText.textContent=
  rudderLabel(order);

 rudderOrderText.style.color=
  order<0
   ?"var(--port)"
   :order>0
    ?"var(--starboard)"
    :"#ffd76a";

 const gaugeMax=Math.max(
  5,
  Math.ceil(
   Math.max(
    ...activeKeys().map(
     key=>
      lerp(
       vesselConfigs[key].maxRotDeep,
       vesselConfigs[key].maxRotShallow,
       depthMix
      )
    )
   )/5
  )*5
 );

 const gaugeMid=
  gaugeMax/2;

 const gaugeMidText=
  Number.isInteger(gaugeMid)
   ?gaugeMid
   :gaugeMid.toFixed(1);

 rotMaxLeft.textContent=
  rotMaxRight.textContent=
  gaugeMax;

 rotMidLeft.textContent=
  rotMidRight.textContent=
  gaugeMidText;

 if(shipMode==="compare"){
  const tanker=states.tanker;
  const frigate=states.frigate;

  setRudderMarker(
   rudderPointer,
   tanker.rudder,
   true
  );

  setRudderMarker(
   frigateRudderPointer,
   frigate.rudder,
   true
  );

  tankerRudderText.textContent=
   rudderLabel(
    tanker.rudder
   );

  frigateRudderText.textContent=
   rudderLabel(
    frigate.rudder
   );

  rotNeedle.style.transform=
   "rotate("+
   clamp(
    tanker.rot/gaugeMax*78,
    -78,
    78
   )+
   "deg)";

  frigateRotNeedle.style.transform=
   "rotate("+
   clamp(
    frigate.rot/gaugeMax*78,
    -78,
    78
   )+
   "deg)";

  tankerRotText.textContent=
   rotLabel(
    tanker.rot
   );

  frigateRotText.textContent=
   rotLabel(
    frigate.rot
   );

  tankerHeading.textContent=
   Math.round(
    tanker.heading
   ).toString().padStart(
    3,
    "0"
   )+"°";

  frigateHeading.textContent=
   Math.round(
    frigate.heading
   ).toString().padStart(
    3,
    "0"
   )+"°";

  updateSpeed(
   tankerSpeed,
   tanker.speedKnots
  );

  updateSpeed(
   frigateSpeed,
   frigate.speedKnots
  )
 }else{
  const state=states[shipMode];

  const rudder=
   Math.abs(state.rudder)<.05
    ?0
    :state.rudder;

  const rotation=
   Math.abs(state.rot)<.005
    ?0
    :state.rot;

  setRudderMarker(
   rudderPointer,
   rudder,
   false
  );

  rudderText.textContent=
   rudderLabel(
    rudder
   );

  rudderText.style.color=
   rudder<0
    ?"var(--port)"
    :rudder>0
     ?"var(--starboard)"
     :"#d9edf2";

  rotNeedle.style.transform=
   "rotate("+
   clamp(
    state.rot/gaugeMax*78,
    -78,
    78
   )+
   "deg)";

  rotNeedle.style.background=
   state.rot<-.005
    ?"var(--port)"
    :state.rot>.005
     ?"var(--starboard)"
     :"var(--cyan)";

  rotText.textContent=
   rotLabel(
    state.rot
   );

  rotText.style.color=
   rotation<0
    ?"var(--port)"
    :rotation>0
     ?"var(--starboard)"
     :"#d9edf2";

  headingText.textContent=
   Math.round(
    state.heading
   ).toString().padStart(
    3,
    "0"
   )+"°";

  updateSpeed(
   speedText,
   state.speedKnots
  )
 }
}

function setZoom(value){
 zoom=clamp(
  value,
  .18,
  1.2
 );

 zoomInput.value=
  Math.round(
   zoom*100
  );

 if(cameraMode==="follow"){
  scaleText.textContent=
   Math.round(
    zoom*100
   )+"%"
 }
}

function followCamera(){
 cameraMode="follow";

 overviewBtn.classList.remove(
  "active"
 );

 overviewBtn.textContent=
  "VER TRAJETÓRIA";

 setZoom(zoom)
}

zoomInput.oninput=()=>{
 followCamera();

 setZoom(
  +zoomInput.value/100
 )
};

$("zoomOut").onclick=()=>{
 followCamera();
 setZoom(zoom-.1)
};

$("zoomIn").onclick=()=>{
 followCamera();
 setZoom(zoom+.1)
};

overviewBtn.onclick=()=>{
 cameraMode=
  cameraMode==="follow"
   ?"overview"
   :"follow";

 overviewBtn.classList.toggle(
  "active",
  cameraMode==="overview"
 );

 overviewBtn.textContent=
  cameraMode==="overview"
   ?"SEGUIR NAVIOS"
   :"VER TRAJETÓRIA";

 scaleText.textContent=
  cameraMode==="overview"
   ?"AUTO"
   :Math.round(
     zoom*100
    )+"%"
};

$("resetTrail").onclick=()=>{
 activeKeys().forEach(key=>{
  states[key].trail=[];
  states[key].trailStep=4
 })
};

let settingsShip="tanker";
let settingsDraft=copyConfigs(vesselConfigs);

const displayNumber=(value,digits=1)=>
 Number(value)
  .toFixed(digits)
  .replace(".",",")
  .replace(/,0+$/,"");

function speedFieldName(input){
 return input.dataset.water+
  (
   input.dataset.direction==="ahead"
    ?"Ahead"
    :"Astern"
  )+
  "Speeds"
}

function renderRotMatrix(){
 const config=
  settingsDraft[settingsShip];

 rotMatrix.style.setProperty(
  "--rot-cols",
  config.rotSpeeds.length
 );

 let html=
  '<div class="rotMatrixRow">'+
  '<span class="rotMatrixCell corner">LEME / STW</span>';

 config.rotSpeeds.forEach(speed=>{
  html+=
   '<span class="rotMatrixCell speedAxis">'+
   displayNumber(speed)+
   ' kn</span>'
 });

 html+="</div>";

 rudderAngles.forEach((angle,row)=>{
  html+=
   '<div class="rotMatrixRow">'+
   '<span class="rotMatrixCell rudderAxis">'+
   angle+
   "°</span>";

  config.rotSpeeds.forEach((speed,column)=>{
   html+=
    '<input class="rotMatrixInput" '+
    'data-row="'+row+'" '+
    'data-column="'+column+'" '+
    'type="number" '+
    'min="0" max="240" '+
    'step="0.1" '+
    'inputmode="decimal" '+
    'value="'+
    config.rotTable[row][column].toFixed(1)+
    '" '+
    'aria-label="ROT a '+
    angle+
    " graus de leme e "+
    speed+
    ' nós">'
  });

  html+="</div>"
 });

 rotMatrix.innerHTML=html;

 rotMatrix
  .querySelectorAll(".rotMatrixInput")
  .forEach(input=>{
   input.oninput=()=>{
    readSettingsForm();
    markSettingsDirty();
    drawSettingsGraphs()
   }
  })
}

function updateRudderTimeExample(){
 const seconds=
  settingsDraft[settingsShip]
   .rudderTravelSeconds;

 const model10=
  seconds*10/70;

 const screen10=
  model10/baseTimeScale;

 rudderTimeExample.textContent=
  "Uma variação de 10° leva "+
  displayNumber(model10)+
  " s no modelo · "+
  displayNumber(screen10)+
  " s na tela em 1×."
}

function readSettingsForm(){
 const candidate=
  cloneConfig(
   settingsDraft[settingsShip]
  );

 speedConfigInputs.forEach(input=>{
  candidate[
   speedFieldName(input)
  ][+input.dataset.regime]=
   input.value
 });

 rotMatrix
  .querySelectorAll(".rotMatrixInput")
  .forEach(input=>{
   candidate.rotTable[
    +input.dataset.row
   ][
    +input.dataset.column
   ]=input.value
  });

 dynamicInputs.forEach(input=>{
  const scale=
   Number(
    input.dataset.scale
   )||1;

  candidate[
   input.dataset.field
  ]=
   Number(input.value)/
   scale
 });

 candidate.rudderTravelSeconds=
  cfgRudderTime.value;

 candidate.growth=
  cfgGrowth.value;

 settingsDraft[settingsShip]=
  sanitizeConfig(
   candidate,
   settingsDraft[settingsShip]
  );

 syncRotLimitInputs();

 cfgGrowthValue.textContent=
  settingsDraft[
   settingsShip
  ].growth.toFixed(2)+"×";

 updateRudderTimeExample()
}

function syncRotLimitInputs(){
 const config=
  settingsDraft[settingsShip];

 const deepInput=
  dynamicInputs.find(
   input=>
    input.dataset.field===
    "maxRotDeep"
  );

 const shallowInput=
  dynamicInputs.find(
   input=>
    input.dataset.field===
    "maxRotShallow"
  );

 if(!deepInput||!shallowInput){
  return
 }

 shallowInput.max=
  Math.max(
   .1,
   config.maxRotDeep-.1
  ).toFixed(1);

 deepInput.value=
  config.maxRotDeep.toFixed(1);

 shallowInput.value=
  config.maxRotShallow.toFixed(1)
}

function fillSettingsForm(){
 const config=
  settingsDraft[settingsShip];

 speedConfigInputs.forEach(input=>{
  input.value=
   config[
    speedFieldName(input)
   ][
    +input.dataset.regime
   ].toFixed(1)
 });

 dynamicInputs.forEach(input=>{
  const scale=
   Number(
    input.dataset.scale
   )||1;

  const precision=
   input.step&&
   input.step.includes(".0001")
    ?4
    :input.step&&
      input.step.includes(".001")
     ?3
     :input.step&&
       input.step.includes(".01")
      ?2
      :1;

  input.value=
   displayNumber(
    config[
     input.dataset.field
    ]*scale,
    precision
   ).replace(",",".")
 });

 cfgGrowth.value=
  config.growth;

 cfgGrowthValue.textContent=
  config.growth.toFixed(2)+"×";

 cfgRudderTime.value=
  config.rudderTravelSeconds;

 cfgRudderTimeRange.value=
  config.rudderTravelSeconds;

 syncRotLimitInputs();
 renderRotMatrix();
 updateRudderTimeExample();

 settingsOverlay
  .querySelector(".settingsDrawer")
  .style
  .setProperty(
   "--graph-rot",
   ships[settingsShip].color
  );

 document
  .querySelectorAll(".configTab")
  .forEach(tab=>{
   const active=
    tab.dataset.configShip===
    settingsShip;

   tab.classList.toggle(
    "active",
    active
   );

   tab.setAttribute(
    "aria-selected",
    active
   )
  });

 drawSettingsGraphs()
}

function markSettingsDirty(){
 settingsStatus.textContent=
  "Alterações ainda não salvas"
}

function selectSettingsShip(key){
 readSettingsForm();

 settingsShip=key;

 settingsStatus.textContent="";

 fillSettingsForm()
}

function openSettings(){
 settingsDraft=
  copyConfigs(vesselConfigs);

 settingsShip=
  shipMode==="frigate"
   ?"frigate"
   :"tanker";

 settingsOverlay.classList.add(
  "open"
 );

 settingsOverlay.setAttribute(
  "aria-hidden",
  "false"
 );

 settingsStatus.textContent="";

 fillSettingsForm();

 requestAnimationFrame(
  drawSettingsGraphs
 );

 settingsClose.focus()
}

function closeSettings(){
 settingsOverlay.classList.remove(
  "open"
 );

 settingsOverlay.setAttribute(
  "aria-hidden",
  "true"
 );

 settingsOpen.focus()
}

document
 .querySelectorAll(".configTab")
 .forEach(tab=>{
  tab.onclick=()=>{
   selectSettingsShip(
    tab.dataset.configShip
   )
  }
 });

[
 ...speedConfigInputs,
 ...dynamicInputs,
 cfgGrowth
].forEach(input=>{
 input.oninput=()=>{
  readSettingsForm();
  markSettingsDirty();
  drawSettingsGraphs()
 }
});

cfgRudderTime.oninput=()=>{
 if(
  String(
   cfgRudderTime.value
  ).trim()!==""
 ){
  settingsDraft[
   settingsShip
  ].rudderTravelSeconds=
   cleanNumber(
    cfgRudderTime.value,
    settingsDraft[
     settingsShip
    ].rudderTravelSeconds,
    1,
    60
   );

  cfgRudderTimeRange.value=
   settingsDraft[
    settingsShip
   ].rudderTravelSeconds;

  updateRudderTimeExample();
  markSettingsDirty()
 }
};

cfgRudderTime.onchange=()=>{
 fillSettingsForm()
};

cfgRudderTimeRange.oninput=()=>{
 settingsDraft[
  settingsShip
 ].rudderTravelSeconds=
  cleanNumber(
   cfgRudderTimeRange.value,
   settingsDraft[
    settingsShip
   ].rudderTravelSeconds,
   1,
   60
  );

 cfgRudderTime.value=
  settingsDraft[
   settingsShip
  ].rudderTravelSeconds;

 updateRudderTimeExample();
 markSettingsDirty()
};

settingsOpen.onclick=
 openSettings;

settingsClose.onclick=
 closeSettings;

settingsOverlay.onclick=event=>{
 if(event.target===settingsOverlay){
  closeSettings()
 }
};

addEventListener("keydown",event=>{
 if(
  event.key==="Escape"&&
  settingsOverlay
   .classList
   .contains("open")
 ){
  closeSettings()
 }
});

$("resetConfig").onclick=()=>{
 settingsDraft[
  settingsShip
 ]=
  cloneConfig(
   configDefaults[
    settingsShip
   ]
  );

 fillSettingsForm();

 settingsStatus.textContent=
  "Padrão de referência carregado — clique em salvar para aplicar"
};

$("saveConfig").onclick=()=>{
 readSettingsForm();

 vesselConfigs={
  tanker:sanitizeConfig(
   settingsDraft.tanker,
   configDefaults.tanker
  ),

  frigate:sanitizeConfig(
   settingsDraft.frigate,
   configDefaults.frigate
  )
 };

 Object.keys(ships).forEach(
  applyVesselConfig
 );

 let persisted=true;

 try{
  localStorage.setItem(
   CONFIG_KEY,
   JSON.stringify(
    vesselConfigs
   )
  )
 }catch(error){
  persisted=false
 }

 settingsDraft=
  copyConfigs(
   vesselConfigs
  );

 settingsStatus.textContent=
  persisted
   ?"Configurações salvas e aplicadas"
   :"Aplicadas, mas o navegador não permitiu salvar";

 updateInstruments();
 drawSettingsGraphs()
};

function setupGraph(canvasElement,context){
 const box=
  canvasElement.getBoundingClientRect();

 const width=
  Math.max(
   280,
   box.width||500
  );

 const height=
  Math.max(
   180,
   box.height||220
  );

 const density=
  Math.min(
   devicePixelRatio||1,
   2
  );

 canvasElement.width=
  Math.round(
   width*density
  );

 canvasElement.height=
  Math.round(
   height*density
  );

 context.setTransform(
  density,
  0,
  0,
  density,
  0,
  0
 );

 context.clearRect(
  0,
  0,
  width,
  height
 );

 context.fillStyle=
  "#071a22";

 context.fillRect(
  0,
  0,
  width,
  height
 );

 context.font=
  "8px Arial";

 return{
  w:width,
  h:height,
  left:39,
  right:13,
  top:18,
  bottom:31
 }
}

function drawSignedGrid(context,area,maxValue,unit){
 const plotW=
  area.w-
  area.left-
  area.right;

 const plotH=
  area.h-
  area.top-
  area.bottom;

 const zeroY=
  area.top+
  plotH/2;

 context.lineWidth=1;
 context.setLineDash([3,4]);

 [-1,-.5,0,.5,1].forEach(scale=>{
  const y=
   zeroY-
   scale*
   plotH/2;

  context.beginPath();

  context.moveTo(
   area.left,
   y
  );

  context.lineTo(
   area.w-area.right,
   y
  );

  context.strokeStyle=
   scale===0
    ?"rgba(225,241,244,.42)"
    :"rgba(150,190,201,.15)";

  context.stroke();

  context.fillStyle="#78959e";
  context.textAlign="right";

  context.fillText(
   (scale*maxValue).toFixed(0),
   area.left-5,
   y+3
  )
 });

 context.setLineDash([]);

 context.fillStyle="#78959e";
 context.textAlign="left";

 context.fillText(
  unit,
  area.left,
  10
 );

 return{
  plotW,
  plotH,
  zeroY
 }
}

function drawPositiveGrid(context,area,maxValue,unit){
 const plotW=
  area.w-
  area.left-
  area.right;

 const plotH=
  area.h-
  area.top-
  area.bottom;

 context.lineWidth=1;
 context.setLineDash([3,4]);

 [0,.25,.5,.75,1].forEach(scale=>{
  const y=
   area.top+
   plotH*
   (1-scale);

  context.beginPath();

  context.moveTo(
   area.left,
   y
  );

  context.lineTo(
   area.w-area.right,
   y
  );

  context.strokeStyle=
   scale===0
    ?"rgba(225,241,244,.42)"
    :"rgba(150,190,201,.15)";

  context.stroke();

  context.fillStyle="#78959e";
  context.textAlign="right";

  context.fillText(
   (scale*maxValue).toFixed(0),
   area.left-5,
   y+3
  )
 });

 context.setLineDash([]);

 context.fillStyle="#78959e";
 context.textAlign="left";

 context.fillText(
  unit,
  area.left,
  10
 );

 return{
  plotW,
  plotH
 }
}

function drawLine(context,points,color,dashed=false,pointsVisible=true){
 context.beginPath();

 points.forEach(
  (point,index)=>{
   index
    ?context.lineTo(
      point.x,
      point.y
     )
    :context.moveTo(
      point.x,
      point.y
     )
  }
 );

 context.strokeStyle=color;
 context.lineWidth=2.2;
 context.lineJoin="round";
 context.lineCap="round";

 context.setLineDash(
  dashed
   ?[5,4]
   :[]
 );

 context.stroke();
 context.setLineDash([]);

 if(pointsVisible){
  points.forEach(point=>{
   context.beginPath();

   context.arc(
    point.x,
    point.y,
    2.6,
    0,
    Math.PI*2
   );

   context.fillStyle=color;
   context.fill()
  })
 }
}

function drawSpeedGraph(){
 const config=
  settingsDraft[
   settingsShip
  ];

 const area=
  setupGraph(
   speedGraph,
   speedGraphCtx
  );

 const maxValue=Math.max(
  5,
  Math.ceil(
   Math.max(
    ...config.deepAheadSpeeds,
    ...config.deepAsternSpeeds,
    ...config.shallowAheadSpeeds,
    ...config.shallowAsternSpeeds
   )/5
  )*5
 );

 const grid=
  drawSignedGrid(
   speedGraphCtx,
   area,
   maxValue,
   "kn"
  );

 const orders=[
  -4,-3,-2,-1,
  0,
  1,2,3,4
 ];

 const labels=[
  "FULL",
  "HALF",
  "SLOW",
  "D.S.",
  "0",
  "D.S.",
  "SLOW",
  "HALF",
  "FULL"
 ];

 const x=index=>
  area.left+
  index/
  (orders.length-1)*
  grid.plotW;

 const y=value=>
  grid.zeroY-
  value/maxValue*
  grid.plotH/2;

 const plotPair=(
  ahead,
  astern,
  colorAhead,
  colorAstern,
  dashed
 )=>{
  const values=
   orders.map(order=>
    order<0
     ?-astern[Math.abs(order)]
     :order>0
      ?ahead[order]
      :0
   );

  const asternPoints=
   values
    .slice(0,5)
    .map((value,index)=>({
     x:x(index),
     y:y(value)
    }));

  const aheadPoints=
   values
    .slice(4)
    .map((value,index)=>({
     x:x(index+4),
     y:y(value)
    }));

  drawLine(
   speedGraphCtx,
   asternPoints,
   colorAstern,
   dashed
  );

  drawLine(
   speedGraphCtx,
   aheadPoints,
   colorAhead,
   dashed
  )
 };

 plotPair(
  config.deepAheadSpeeds,
  config.deepAsternSpeeds,
  "#00df67",
  "#ff2438",
  false
 );

 plotPair(
  config.shallowAheadSpeeds,
  config.shallowAsternSpeeds,
  "#8cf6bb",
  "#ff8b97",
  true
 );

 labels.forEach(
  (label,index)=>{
   speedGraphCtx.fillStyle=
    index<4
     ?"#ff7986"
     :index>4
      ?"#62e89e"
      :"#b7ccd2";

   speedGraphCtx.textAlign="center";

   speedGraphCtx.fillText(
    label,
    x(index),
    area.h-10
   )
  }
 );

 speedGraph.setAttribute(
  "aria-label",
  "Velocidades de "+
  ships[
   settingsShip
  ].name.toLowerCase()+
  " por regime de máquina em águas profundas e rasas"
 )
}

function drawRotGraph(){
 const config=
  settingsDraft[
   settingsShip
  ];

 const area=
  setupGraph(
   rotGraph,
   rotGraphCtx
  );

 const maxValue=
  Math.max(
   5,
   Math.ceil(
    config.maxRotDeep/10
   )*10
  );

 const grid=
  drawPositiveGrid(
   rotGraphCtx,
   area,
   maxValue,
   "°/min"
  );

 const colors=[
  "#82ecff",
  "#00df67",
  "#ffd76a",
  "#ff9b61",
  "#ff6073",
  "#b88cff"
 ];

 const x=index=>
  area.left+
  index/
  (rudderAngles.length-1)*
  grid.plotW;

 const y=value=>
  area.top+
  grid.plotH-
  value/maxValue*
  grid.plotH;

 config.rotSpeeds.forEach(
  (speed,column)=>{
   const color=
    colors[
     column%
     colors.length
    ];

   const limits=
    rudderAngles.map(
     (angle,row)=>
      rotLimits(
       config,
       config.rotTable[
        row
       ][
        column
       ]
      )
    );

   const deepPoints=
    limits.map(
     (limit,row)=>({
      x:x(row),
      y:y(limit.deep)
     })
    );

   const shallowPoints=
    limits.map(
     (limit,row)=>({
      x:x(row),
      y:y(limit.shallow)
     })
    );

   drawLine(
    rotGraphCtx,
    shallowPoints,
    color,
    true,
    false
   );

   drawLine(
    rotGraphCtx,
    deepPoints,
    color,
    false
   )
  }
 );

 rudderAngles.forEach(
  (angle,index)=>{
   rotGraphCtx.fillStyle=
    "#9bb4bb";

   rotGraphCtx.textAlign=
    "center";

   rotGraphCtx.fillText(
    angle+"°",
    x(index),
    area.h-10
   )
  }
 );

 rotGraphLegend.innerHTML=
  '<span><i style="background:#dcebed"></i>DEEP</span>'+
  '<span class="shallowLegend"><i></i>SHALLOW</span>'+
  config.rotSpeeds.map(
   (speed,index)=>
    '<span><i style="background:'+
    colors[
     index%
     colors.length
    ]+
    '"></i>'+
    displayNumber(speed)+
    ' kn</span>'
  ).join("");

 rotGraph.setAttribute(
  "aria-label",
  "Curvas de ROT deep e shallow de "+
  ships[
   settingsShip
  ].name.toLowerCase()+
  " por velocidade e ângulo de leme"
 )
}

function drawSettingsGraphs(){
 if(
  !settingsDraft||
  !settingsDraft[
   settingsShip
  ]
 ){
  return
 }

 drawSpeedGraph();
 drawRotGraph()
}

function advanceSimulation(duration){
 let remaining=duration;

 while(remaining>0){
  const step=
   Math.min(
    remaining,
    .05
   );

  physics(step);

  remaining-=step
 }
}

function snapshot(){
 return{
  mode:shipMode,
  water:waterMode,
  engineOrder,
  rudderOrder,
  depthMix,
  time:simulationTime,

  tanker:{
   ...states.tanker,
   trail:undefined
  },

  frigate:{
   ...states.frigate,
   trail:undefined
  }
 }
}

window.__maneuverSim={
 configDefaults:
  copyConfigs(
   configDefaults
  ),

 sanitizeConfig,
 lookupROT,
 rotLimits,
 rudderEfficiency,
 lowSpeedCorrection,
 advanceSimulation,
 resetSimulation,
 setEngine,

 setRudderOrder:value=>{
  rudderOrder=
   clamp(
    value,
    -35,
    35
   );

  wheelAngle=
   rudderOrder/
   35*
   270;

  updateWheel()
 },

 snapshot
};

function animate(now){
 const realDt=
  Math.min(
   (now-lastTime)/1000,
   .08
  );

 lastTime=now;

 advanceSimulation(
  realDt*
  baseTimeScale*
  timeScale
 );

 drawSea();

 const cam=camera();

 activeKeys().forEach(key=>{
  drawTrail(
   key,
   cam
  )
 });

 activeKeys().forEach(key=>{
  drawShip(
   key,
   cam
  )
 });

 updateInstruments();

 requestAnimationFrame(
  animate
 )
}

resetSimulation();
requestAnimationFrame(animate);
