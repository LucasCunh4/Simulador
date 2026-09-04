const $=id=>document.getElementById(id),canvas=$("sea"),ctx=canvas.getContext("2d"),wheel=$("wheel"),rudderPointer=$("rudderPointer"),rudderOrderPointer=$("rudderOrderPointer"),rudderText=$("rudderText"),rudderOrderText=$("rudderOrderText"),rotNeedle=$("rotNeedle"),frigateRotNeedle=$("frigateRotNeedle"),rotText=$("rotText"),tankerRotText=$("tankerRotText"),frigateRotText=$("frigateRotText"),headingText=$("heading"),tankerHeading=$("tankerHeading"),frigateHeading=$("frigateHeading"),speedText=$("speedText"),tankerSpeed=$("tankerSpeed"),frigateSpeed=$("frigateSpeed"),shipName=$("shipName"),zoomInput=$("zoom"),scaleText=$("scaleText"),overviewBtn=$("overview"),depthStatus=$("depthStatus"),engineRail=$("engineRail"),engineHandle=$("engineHandle"),engineText=$("engineText"),settingsOpen=$("settingsOpen"),settingsOverlay=$("settingsOverlay"),settingsClose=$("settingsClose"),cfgRudderTime=$("cfgRudderTime"),cfgRudderTimeRange=$("cfgRudderTimeRange"),rudderTimeExample=$("rudderTimeExample"),cfgGrowth=$("cfgGrowth"),cfgGrowthValue=$("cfgGrowthValue"),settingsStatus=$("settingsStatus"),speedGraph=$("speedGraph"),speedGraphCtx=speedGraph.getContext("2d"),rotGraph=$("rotGraph"),rotGraphCtx=rotGraph.getContext("2d"),rotMaxLeft=$("rotMaxLeft"),rotMaxRight=$("rotMaxRight"),rotMidLeft=$("rotMidLeft"),rotMidRight=$("rotMidRight");
const speedConfigInputs=[...document.querySelectorAll(".speedConfigInput")],rotConfigInputs=[...document.querySelectorAll(".rotConfigInput")];

const ships={
 tanker:{name:"NAVIO-TANQUE",short:"TANQUE",length:165,width:32,speed:38,maxKnots:15,asternRatio:.55,engineRamp:60,engineMinRate:.0012,engineMaxRate:.012,coastRamp:70,coastMinRate:.0008,coastMaxRate:.006,coastFallRate:.018,maxROT:7,buildTime:55,minRise:.003,maxRise:.035,fallRate:.055,brakeZone:1,wander:0,wanderResponse:12,wanderFrequency:.028,shallow:{speed:.78,rot:.68,response:.72},color:"#82ecff",trail:"rgba(130,236,255,.78)"},
 frigate:{name:"FRAGATA",short:"FRAGATA",length:115,width:19,speed:38,maxKnots:28,asternRatio:.62,engineRamp:45,engineMinRate:.0025,engineMaxRate:.020,coastRamp:55,coastMinRate:.0015,coastMaxRate:.010,coastFallRate:.05,maxROT:22,buildTime:30,minRise:.012,maxRise:.12,fallRate:.16,brakeZone:2.4,wander:3,wanderResponse:4.5,wanderFrequency:.020,shallow:{speed:.84,rot:.76,response:.80},color:"#ffd76a",trail:"rgba(255,215,106,.82)"}
};

const CONFIG_KEY="simulador-manobra-config-v3",DEFAULT_RUDDER_TRAVEL_TIME=5,regimeFractions=[0,.22,.4,.65,1],rotFractions=[0,.07,.16,.27,.4,.56,.76,1],configDefaults={
 tanker:{aheadSpeeds:[0,3.3,6,9.8,15],asternSpeeds:[0,1.8,3.3,5.4,8.3],rotByRudder:[0,.5,1.1,1.9,2.8,4,5.4,7],growth:1},
 frigate:{aheadSpeeds:[0,6.2,11.2,18.2,28],asternSpeeds:[0,3.8,7,11.3,17.4],rotByRudder:[0,1,2.5,4.8,7.5,11,16,22],growth:1}
};
const cleanNumber=(value,fallback,min,max)=>{const number=Number(value);return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback};
const sanitizeSeries=(source,fallback,max)=>fallback.map((value,index)=>index?cleanNumber(source?.[index],value,0,max):0);
function sanitizeConfig(value={},fallback){
 const aheadSource=value.aheadSpeeds||(value.maxAhead?regimeFractions.map(f=>f*value.maxAhead):null),asternSource=value.asternSpeeds||(value.maxAstern?regimeFractions.map(f=>f*value.maxAstern):null),rotSource=value.rotByRudder||(value.maxROT?rotFractions.map(f=>f*value.maxROT):null);
 return{aheadSpeeds:sanitizeSeries(aheadSource,fallback.aheadSpeeds,60),asternSpeeds:sanitizeSeries(asternSource,fallback.asternSpeeds,40),rotByRudder:sanitizeSeries(rotSource,fallback.rotByRudder,60),growth:cleanNumber(value.growth,fallback.growth,.25,3)}
}
let rudderTravelSeconds=DEFAULT_RUDDER_TRAVEL_TIME;
function loadConfigs(){let saved={};try{saved=JSON.parse(localStorage.getItem(CONFIG_KEY)||localStorage.getItem("simulador-manobra-config-v2")||localStorage.getItem("simulador-manobra-config-v1")||"{}")||{}}catch(error){saved={}}rudderTravelSeconds=cleanNumber(saved.global?.rudderTravelSeconds,DEFAULT_RUDDER_TRAVEL_TIME,1,60);return{tanker:sanitizeConfig(saved.tanker,configDefaults.tanker),frigate:sanitizeConfig(saved.frigate,configDefaults.frigate)}}
let vesselConfigs=loadConfigs();
function applyVesselConfig(key){const vessel=ships[key],config=vesselConfigs[key];vessel.speedTargets=config;vessel.maxKnots=Math.max(...config.aheadSpeeds);vessel.powerScale=Math.max(.5,...config.aheadSpeeds,...config.asternSpeeds);vessel.maxROT=Math.max(...config.rotByRudder);vessel.growthRate=config.growth}
Object.keys(ships).forEach(applyVesselConfig);

const engineNames={"-4":"FULL ASTERN","-3":"HALF ASTERN","-2":"SLOW ASTERN","-1":"DEAD SLOW ASTERN","0":"SEM MÁQUINA","1":"DEAD SLOW AHEAD","2":"SLOW AHEAD","3":"HALF AHEAD","4":"FULL AHEAD"};
const createState=key=>({key,x:0,y:0,heading:0,rot:0,helmRot:0,wanderRot:0,turnBuild:0,enginePower:0,engineTarget:0,enginePhase:0,speedKnots:0,trail:[],trailStep:1.8});
const states={tanker:createState("tanker"),frigate:createState("frigate")};
let shipMode="tanker",waterMode="deep",timeScale=1,engineOrder=0,depthMix=0,rudderOrder=0,rudder=0,wheelAngle=0,dragging=false,engineDragging=false,lastPointerAngle=0,lastTime=performance.now(),seaTime=0,simulationTime=0,zoom=1,cameraMode="follow";
const baseTimeScale=4,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),norm=v=>(v%360+360)%360,lerp=(a,b,t)=>a+(b-a)*t,progressiveGrowth=(value,intensity=9)=>{const t=clamp(value,0,1);return 1-Math.log(1+intensity*(1-t))/Math.log(1+intensity)};
function targetKnotsForOrder(config,order){return order>0?config.aheadSpeeds[order]:order<0?-config.asternSpeeds[-order]:0}
function rotForRudder(config,angle){const position=clamp(Math.abs(angle),0,35)/5,low=Math.floor(position),high=Math.min(7,low+1);return lerp(config.rotByRudder[low],config.rotByRudder[high],position-low)}

function activeKeys(){return shipMode==="compare"?["tanker","frigate"]:[shipMode]}
function resize(){const r=canvas.getBoundingClientRect(),d=devicePixelRatio||1;canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);if(settingsOverlay.classList.contains("open"))drawSettingsGraphs()}
addEventListener("resize",resize);resize();

function pointerAngle(e){const r=wheel.getBoundingClientRect();return Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2)*180/Math.PI}
wheel.onpointerdown=e=>{dragging=true;wheel.setPointerCapture(e.pointerId);lastPointerAngle=pointerAngle(e)};
wheel.onpointermove=e=>{if(!dragging)return;let a=pointerAngle(e),d=a-lastPointerAngle;if(d>180)d-=360;if(d<-180)d+=360;wheelAngle=clamp(wheelAngle+d,-270,270);lastPointerAngle=a;rudderOrder=wheelAngle/270*35;updateWheel()};
wheel.onpointerup=wheel.onpointercancel=()=>dragging=false;
$("midships").onclick=()=>{rudderOrder=wheelAngle=0;updateWheel()};
function updateWheel(){wheel.style.rotate=wheelAngle+"deg"}

function setEngine(value){engineOrder=clamp(Math.round(value),-4,4);updateEngine()}
function updateEngine(){
 const name=engineNames[engineOrder],kind=engineOrder>0?"ahead":engineOrder<0?"astern":"stop";
 engineHandle.style.top=50-engineOrder*11.1+"%";engineHandle.className="engineHandle "+kind;engineHandle.setAttribute("aria-valuenow",engineOrder);engineHandle.setAttribute("aria-valuetext",name);
 engineText.textContent=name;engineText.className="engineText "+kind;document.querySelectorAll(".engineStep").forEach(btn=>btn.classList.toggle("active",+btn.dataset.engine===engineOrder))
}
function engineAtPointer(e){const r=engineRail.getBoundingClientRect();return clamp(Math.round((.5-clamp((e.clientY-r.top)/r.height,0,1))*8),-4,4)}
engineRail.onpointerdown=e=>{engineDragging=true;engineRail.setPointerCapture(e.pointerId);setEngine(engineAtPointer(e))};
engineRail.onpointermove=e=>{if(engineDragging)setEngine(engineAtPointer(e))};
engineRail.onpointerup=engineRail.onpointercancel=()=>engineDragging=false;
engineHandle.onkeydown=e=>{if(e.key==="ArrowUp"||e.key==="ArrowRight"){e.preventDefault();setEngine(engineOrder+1)}else if(e.key==="ArrowDown"||e.key==="ArrowLeft"){e.preventDefault();setEngine(engineOrder-1)}else if(e.key==="Home"){e.preventDefault();setEngine(4)}else if(e.key==="End"){e.preventDefault();setEngine(-4)}else if(e.key===" "||e.key==="0"){e.preventDefault();setEngine(0)}};
document.querySelectorAll(".engineStep").forEach(btn=>btn.onclick=()=>setEngine(+btn.dataset.engine));

function resetState(key,x=0){const s=states[key];s.x=x;s.y=0;s.heading=s.rot=s.helmRot=s.wanderRot=s.turnBuild=s.enginePower=s.engineTarget=s.enginePhase=s.speedKnots=0;s.trail=[];s.trailStep=1.8}
function resetSimulation(){
 rudderOrder=rudder=wheelAngle=simulationTime=0;engineOrder=0;
 resetState("tanker",shipMode==="compare"?-14:0);resetState("frigate",shipMode==="compare"?14:0);
 cameraMode="follow";overviewBtn.classList.remove("active");overviewBtn.textContent="VER TRAJETÓRIA";updateWheel();updateEngine();setZoom(1);updateInstruments()
}

document.querySelectorAll(".shipBtn").forEach(btn=>btn.onclick=()=>{
 document.querySelectorAll(".shipBtn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");
 shipMode=btn.dataset.mode;document.body.classList.toggle("comparison",shipMode==="compare");
 shipName.textContent=shipMode==="compare"?"COMPARAÇÃO SIMULTÂNEA":ships[shipMode].name;resetSimulation()
});

document.querySelectorAll(".waterBtn").forEach(btn=>btn.onclick=()=>{
 document.querySelectorAll(".waterBtn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");waterMode=btn.dataset.water;
 depthStatus.innerHTML=waterMode==="shallow"?"<strong>ÁGUAS RASAS</strong><span>Menor velocidade, resposta e ROT</span>":"<strong>ÁGUAS PROFUNDAS</strong><span>Resposta normal de manobra</span>"
});

document.querySelectorAll(".speedBtn").forEach(btn=>btn.onclick=()=>{
 document.querySelectorAll(".speedBtn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");timeScale=+btn.dataset.speed
});

const cloneConfig=config=>({...config,aheadSpeeds:[...config.aheadSpeeds],asternSpeeds:[...config.asternSpeeds],rotByRudder:[...config.rotByRudder]}),copyConfigs=configs=>({tanker:cloneConfig(configs.tanker),frigate:cloneConfig(configs.frigate)});
let settingsShip="tanker",settingsDraft=copyConfigs(vesselConfigs),rudderTravelDraft=rudderTravelSeconds;
const displaySeconds=value=>Number(value).toFixed(1).replace(".",",").replace(",0","");
function updateRudderTimeExample(){rudderTimeExample.textContent="Uma variação de 10° levará "+displaySeconds(rudderTravelDraft*10/70)+" s no modo 1×."}
function setRudderTravelDraft(value,syncNumber=true){if(String(value).trim()==="")return;rudderTravelDraft=cleanNumber(value,rudderTravelDraft,1,60);if(syncNumber)cfgRudderTime.value=rudderTravelDraft;cfgRudderTimeRange.value=rudderTravelDraft;updateRudderTimeExample()}
function readSettingsForm(){
 const fallback=settingsDraft[settingsShip],candidate={aheadSpeeds:[0,0,0,0,0],asternSpeeds:[0,0,0,0,0],rotByRudder:[0,0,0,0,0,0,0,0],growth:cfgGrowth.value};
 speedConfigInputs.forEach(input=>candidate[input.dataset.direction+"Speeds"][+input.dataset.regime]=input.value);rotConfigInputs.forEach(input=>candidate.rotByRudder[+input.dataset.rudderIndex]=input.value);
 settingsDraft[settingsShip]=sanitizeConfig(candidate,fallback);if(cfgRudderTime.value.trim()!=="")rudderTravelDraft=cleanNumber(cfgRudderTime.value,rudderTravelDraft,1,60);cfgGrowthValue.textContent=settingsDraft[settingsShip].growth.toFixed(2)+"×";updateRudderTimeExample()
}
function fillSettingsForm(){
 const config=settingsDraft[settingsShip];speedConfigInputs.forEach(input=>input.value=config[input.dataset.direction+"Speeds"][+input.dataset.regime].toFixed(1));rotConfigInputs.forEach(input=>input.value=config.rotByRudder[+input.dataset.rudderIndex].toFixed(1));cfgGrowth.value=config.growth;cfgGrowthValue.textContent=config.growth.toFixed(2)+"×";cfgRudderTime.value=rudderTravelDraft;cfgRudderTimeRange.value=rudderTravelDraft;updateRudderTimeExample();
 settingsOverlay.querySelector(".settingsDrawer").style.setProperty("--graph-rot",ships[settingsShip].color);document.querySelectorAll(".configTab").forEach(tab=>{const active=tab.dataset.configShip===settingsShip;tab.classList.toggle("active",active);tab.setAttribute("aria-selected",active)});drawSettingsGraphs()
}
function selectSettingsShip(key,keepCurrent=true){if(keepCurrent)readSettingsForm();settingsShip=key;settingsStatus.textContent="";fillSettingsForm()}
function openSettings(){settingsDraft=copyConfigs(vesselConfigs);rudderTravelDraft=rudderTravelSeconds;settingsShip=shipMode==="frigate"?"frigate":"tanker";settingsOverlay.classList.add("open");settingsOverlay.setAttribute("aria-hidden","false");settingsStatus.textContent="";fillSettingsForm();requestAnimationFrame(drawSettingsGraphs);settingsClose.focus()}
function closeSettings(){settingsOverlay.classList.remove("open");settingsOverlay.setAttribute("aria-hidden","true");settingsOpen.focus()}
document.querySelectorAll(".configTab").forEach(tab=>tab.onclick=()=>selectSettingsShip(tab.dataset.configShip));
[...speedConfigInputs,...rotConfigInputs,cfgGrowth].forEach(input=>input.oninput=()=>{readSettingsForm();settingsStatus.textContent="Alterações ainda não salvas";drawSettingsGraphs()});
cfgRudderTime.oninput=()=>{setRudderTravelDraft(cfgRudderTime.value,false);settingsStatus.textContent="Alterações ainda não salvas"};
cfgRudderTime.onchange=()=>setRudderTravelDraft(cfgRudderTime.value||rudderTravelDraft);
cfgRudderTimeRange.oninput=()=>{setRudderTravelDraft(cfgRudderTimeRange.value);settingsStatus.textContent="Alterações ainda não salvas"};
settingsOpen.onclick=openSettings;settingsClose.onclick=closeSettings;
settingsOverlay.onclick=e=>{if(e.target===settingsOverlay)closeSettings()};
addEventListener("keydown",e=>{if(e.key==="Escape"&&settingsOverlay.classList.contains("open"))closeSettings()});
$("resetConfig").onclick=()=>{settingsDraft[settingsShip]=cloneConfig(configDefaults[settingsShip]);fillSettingsForm();settingsStatus.textContent="Padrão carregado — clique em salvar para aplicar"};
$("saveConfig").onclick=()=>{
 readSettingsForm();vesselConfigs={tanker:sanitizeConfig(settingsDraft.tanker,configDefaults.tanker),frigate:sanitizeConfig(settingsDraft.frigate,configDefaults.frigate)};rudderTravelSeconds=cleanNumber(rudderTravelDraft,DEFAULT_RUDDER_TRAVEL_TIME,1,60);Object.keys(ships).forEach(applyVesselConfig);
 let persisted=true;try{localStorage.setItem(CONFIG_KEY,JSON.stringify({tanker:vesselConfigs.tanker,frigate:vesselConfigs.frigate,global:{rudderTravelSeconds}}))}catch(error){persisted=false}
 settingsDraft=copyConfigs(vesselConfigs);rudderTravelDraft=rudderTravelSeconds;settingsStatus.textContent=persisted?"Configurações salvas e aplicadas":"Aplicadas, mas o navegador não permitiu salvar";updateInstruments();drawSettingsGraphs()
};

function setupGraph(canvas,context){const box=canvas.getBoundingClientRect(),w=Math.max(280,box.width||500),h=Math.max(180,box.height||220),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);context.setTransform(d,0,0,d,0,0);context.clearRect(0,0,w,h);context.fillStyle="#071a22";context.fillRect(0,0,w,h);context.font="8px Arial";return{w,h,left:38,right:12,top:18,bottom:30}}
function drawSignedGrid(context,area,maxValue,unit){
 const{w,h,left,right,top,bottom}=area,plotW=w-left-right,plotH=h-top-bottom,zeroY=top+plotH/2;context.lineWidth=1;context.setLineDash([3,4]);
 [-1,-.5,0,.5,1].forEach(scale=>{const y=zeroY-scale*plotH/2;context.beginPath();context.moveTo(left,y);context.lineTo(w-right,y);context.strokeStyle=scale===0?"rgba(225,241,244,.42)":"rgba(150,190,201,.15)";context.stroke();context.fillStyle="#78959e";context.textAlign="right";context.fillText((scale*maxValue).toFixed(scale&&maxValue<10?1:0),left-5,y+3)});context.setLineDash([]);context.fillStyle="#78959e";context.textAlign="left";context.fillText(unit,left,10);return{plotW,plotH,zeroY}
}
function drawLine(context,points,color){context.beginPath();points.forEach((point,index)=>index?context.lineTo(point.x,point.y):context.moveTo(point.x,point.y));context.strokeStyle=color;context.lineWidth=2.5;context.lineJoin=context.lineCap="round";context.stroke();points.forEach(point=>{context.beginPath();context.arc(point.x,point.y,3,0,Math.PI*2);context.fillStyle=color;context.fill()})}
function drawSpeedGraph(){
 const config=settingsDraft[settingsShip],area=setupGraph(speedGraph,speedGraphCtx),maxValue=Math.max(5,Math.ceil(Math.max(...config.aheadSpeeds,...config.asternSpeeds)/5)*5),grid=drawSignedGrid(speedGraphCtx,area,maxValue,"kn"),orders=[-4,-3,-2,-1,0,1,2,3,4],labels=["FULL","HALF","SLOW","D.S.","0","D.S.","SLOW","HALF","FULL"],x=index=>area.left+index/(orders.length-1)*grid.plotW,y=value=>grid.zeroY-value/maxValue*grid.plotH/2;
 const values=orders.map(order=>order<0?-config.asternSpeeds[Math.abs(order)]:order>0?config.aheadSpeeds[order]:0),portPoints=values.slice(0,5).map((value,index)=>({x:x(index),y:y(value)})),aheadPoints=values.slice(4).map((value,index)=>({x:x(index+4),y:y(value)}));drawLine(speedGraphCtx,portPoints,"#ff2438");drawLine(speedGraphCtx,aheadPoints,"#00df67");
 labels.forEach((label,index)=>{speedGraphCtx.fillStyle=index<4?"#ff7986":index>4?"#62e89e":"#b7ccd2";speedGraphCtx.textAlign="center";speedGraphCtx.fillText(label,x(index),area.h-10)});speedGraph.setAttribute("aria-label","Velocidades de "+ships[settingsShip].name.toLowerCase()+" por regime de máquina, de full astern a full ahead")
}
function drawRotGraph(){
 const config=settingsDraft[settingsShip],area=setupGraph(rotGraph,rotGraphCtx),maxValue=Math.max(5,Math.ceil(Math.max(...config.rotByRudder)/5)*5),grid=drawSignedGrid(rotGraphCtx,area,maxValue,"°/min"),indexes=[-7,-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7],x=index=>area.left+index/(indexes.length-1)*grid.plotW,y=value=>grid.zeroY-value/maxValue*grid.plotH/2;
 const values=indexes.map(index=>Math.sign(index)*config.rotByRudder[Math.abs(index)]),portPoints=values.slice(0,8).map((value,index)=>({x:x(index),y:y(value)})),starboardPoints=values.slice(7).map((value,index)=>({x:x(index+7),y:y(value)}));drawLine(rotGraphCtx,portPoints,"#ff2438");drawLine(rotGraphCtx,starboardPoints,"#00df67");
 indexes.forEach((index,position)=>{rotGraphCtx.fillStyle=index<0?"#ff7986":index>0?"#62e89e":"#b7ccd2";rotGraphCtx.textAlign="center";rotGraphCtx.fillText(index===0?"0":Math.abs(index*5)+"°",x(position),area.h-10)});rotGraph.setAttribute("aria-label","ROT de "+ships[settingsShip].name.toLowerCase()+" para ângulos de leme de 5 a 35 graus em bombordo e boreste")
}
function drawSettingsGraphs(){if(!settingsDraft?.[settingsShip])return;drawSpeedGraph();drawRotGraph()}

function setZoom(v){zoom=clamp(v,.18,1.2);zoomInput.value=Math.round(zoom*100);if(cameraMode==="follow")scaleText.textContent=Math.round(zoom*100)+"%"}
function followCamera(){cameraMode="follow";overviewBtn.classList.remove("active");overviewBtn.textContent="VER TRAJETÓRIA";setZoom(zoom)}
zoomInput.oninput=()=>{followCamera();setZoom(+zoomInput.value/100)};
$("zoomOut").onclick=()=>{followCamera();setZoom(zoom-.1)};
$("zoomIn").onclick=()=>{followCamera();setZoom(zoom+.1)};
overviewBtn.onclick=()=>{cameraMode=cameraMode==="follow"?"overview":"follow";overviewBtn.classList.toggle("active",cameraMode==="overview");overviewBtn.textContent=cameraMode==="overview"?"SEGUIR NAVIOS":"VER TRAJETÓRIA";scaleText.textContent=cameraMode==="overview"?"AUTO":Math.round(zoom*100)+"%"};
$("resetTrail").onclick=()=>activeKeys().forEach(key=>{states[key].trail=[];states[key].trailStep=1.8});

function simulateVessel(key,dt){
 const vessel=ships[key],s=states[key],sm=vessel.shallow,config=vessel.speedTargets,growth=vessel.growthRate||1,rotFactor=lerp(1,sm.rot,depthMix),responseFactor=lerp(1,sm.response,depthMix),speedFactor=lerp(1,sm.speed,depthMix),targetKnots=targetKnotsForOrder(config,engineOrder),targetPower=targetKnots/vessel.powerScale;
 if(Math.abs(targetPower-s.engineTarget)>.0001){s.engineTarget=targetPower;s.enginePhase=0}
 const powerError=targetPower-s.enginePower;
 if(Math.abs(powerError)<.0005)s.enginePower=targetPower;
 else{
  const reducing=engineOrder===0||targetPower*s.enginePower<0||(targetPower*s.enginePower>=0&&Math.abs(targetPower)<Math.abs(s.enginePower)),rampTime=reducing?vessel.coastRamp:vessel.engineRamp;
  s.enginePhase=clamp(s.enginePhase+dt*growth/rampTime,0,1);
  const ease=progressiveGrowth(s.enginePhase,9),minRate=reducing?vessel.coastMinRate:vessel.engineMinRate,maxRate=reducing?vessel.coastMaxRate:vessel.engineMaxRate,rate=lerp(minRate,maxRate,ease)*growth;
  s.enginePower+=Math.sign(powerError)*Math.min(Math.abs(powerError),rate*dt)
 }
 const flow=clamp(Math.abs(s.enginePower),0,1),direction=Math.sign(s.enginePower),effectiveHelm=engineOrder===0?0:rudder/35*flow*direction,desiredROT=engineOrder===0?0:Math.sign(rudder)*direction*rotForRudder(config,rudder)*flow*rotFactor;
 const buildAlpha=1-Math.exp(-dt*growth/(vessel.buildTime/responseFactor));s.turnBuild+=(effectiveHelm-s.turnBuild)*buildAlpha;
 const error=desiredROT-s.helmRot,sameDirection=desiredROT*s.helmRot>=0,growing=Math.abs(s.helmRot)<.01||(sameDirection&&Math.abs(desiredROT)>Math.abs(s.helmRot));
 if(Math.abs(error)<.002){s.helmRot=desiredROT}
 else{
  const aligned=Math.sign(s.turnBuild)===Math.sign(error)?Math.abs(s.turnBuild):0,ease=progressiveGrowth(clamp(aligned,0,1),11),riseRate=lerp(vessel.minRise,vessel.maxRise,ease)*responseFactor*growth;
  const distanceFactor=clamp(Math.abs(error)/vessel.brakeZone,0,1),softBrake=.08+.92*(distanceFactor*distanceFactor*(3-2*distanceFactor));
  const normalRate=growing?riseRate*softBrake:vessel.fallRate*responseFactor*growth,rate=engineOrder===0?Math.min(normalRate,vessel.coastFallRate*growth):normalRate,step=Math.min(Math.abs(error),rate*dt);s.helmRot+=Math.sign(error)*step
 }
 if(Math.abs(rudder)<.04&&Math.abs(s.helmRot)<.012)s.helmRot=0;
 const wanderTarget=vessel.wander*flow*(.72*Math.sin(simulationTime*vessel.wanderFrequency+.55)+.28*Math.sin(simulationTime*vessel.wanderFrequency*.28+1.2))*lerp(1,.7,depthMix);
 s.wanderRot+=(wanderTarget-s.wanderRot)*(1-Math.exp(-dt/vessel.wanderResponse));s.rot=clamp(s.helmRot+s.wanderRot,-vessel.maxROT*rotFactor,vessel.maxROT*rotFactor);
 s.heading=norm(s.heading+s.rot/60*dt);
 s.speedKnots=vessel.powerScale*speedFactor*s.enginePower;
 const rad=s.heading*Math.PI/180,move=vessel.speed*speedFactor*s.enginePower*.18*dt;s.x+=Math.sin(rad)*move;s.y-=Math.cos(rad)*move;
 const last=s.trail[s.trail.length-1];
 if(!last||Math.hypot(s.x-last.x,s.y-last.y)>s.trailStep){s.trail.push({x:s.x,y:s.y});if(s.trail.length>12000){s.trail=s.trail.filter((_,i)=>i%2===0||i===s.trail.length-1);s.trailStep*=2}}
}

function physics(dt){
 depthMix+=((waterMode==="shallow"?1:0)-depthMix)*Math.min(1,dt*1.5);
 const rudderStep=70/(rudderTravelSeconds*baseTimeScale)*dt;rudder+=clamp(rudderOrder-rudder,-rudderStep,rudderStep);
 activeKeys().forEach(key=>simulateVessel(key,dt));seaTime+=dt;simulationTime+=dt
}

function getBounds(includeTrails){
 const keys=activeKeys();let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 const add=(x,y)=>{minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)};
 keys.forEach(key=>{const s=states[key];add(s.x,s.y);if(includeTrails)s.trail.forEach(p=>add(p.x,p.y))});
 return{minX,maxX,minY,maxY}
}

function camera(){
 const w=canvas.clientWidth,h=canvas.clientHeight;
 if(cameraMode==="follow"&&shipMode!=="compare"){const s=states[shipMode];return{x:s.x,y:s.y,scale:5*zoom,shipScale:Math.max(.35,zoom)}}
 const b=getBounds(cameraMode==="overview"),pad=cameraMode==="overview"?65:90,spanX=Math.max(cameraMode==="overview"?24:34,b.maxX-b.minX),spanY=Math.max(cameraMode==="overview"?24:34,b.maxY-b.minY),maxScale=cameraMode==="overview"?5:5*zoom,scale=clamp(Math.min((w-pad*2)/spanX,(h-pad*2)/spanY,maxScale),.025,maxScale);
 return{x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2,scale,shipScale:clamp(scale/5,.28,1)}
}

function focusPoint(){const keys=activeKeys();return{x:keys.reduce((n,k)=>n+states[k].x,0)/keys.length,y:keys.reduce((n,k)=>n+states[k].y,0)/keys.length}}
function rgb(a,b,t){return"rgb("+Math.round(lerp(a[0],b[0],t))+","+Math.round(lerp(a[1],b[1],t))+","+Math.round(lerp(a[2],b[2],t))+")"}
function drawSea(){
 const w=canvas.clientWidth,h=canvas.clientHeight,g=ctx.createLinearGradient(0,0,0,h),deep=[[24,151,184],[14,118,158],[7,82,121]],shallow=[[80,194,190],[47,166,168],[29,132,143]],focus=focusPoint();
 for(let i=0;i<3;i++)g.addColorStop(i/2,rgb(deep[i],shallow[i],depthMix));ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.lineWidth=1;
 for(let row=-60;row<h+70;row+=38){ctx.beginPath();for(let x=-60;x<w+70;x+=12){const y=row+Math.sin((x+focus.x*.25)*.021+seaTime*.7)*4+Math.sin(x*.009+(row+focus.y*.25)*.012-seaTime*.35)*3;x===-60?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.strokeStyle="rgba(235,253,252,"+lerp(.13,.24,depthMix)+")";ctx.stroke()}
 if(depthMix>.02){ctx.strokeStyle="rgba(246,231,174,"+(depthMix*.13)+")";ctx.lineWidth=1.2;for(let y=25;y<h;y+=62){ctx.beginPath();ctx.moveTo(-20,y);ctx.bezierCurveTo(w*.3,y+12,w*.68,y-12,w+20,y+4);ctx.stroke()}}
}

function pointToScreen(x,y,cam){return{x:canvas.clientWidth/2+(x-cam.x)*cam.scale,y:canvas.clientHeight/2+(y-cam.y)*cam.scale}}
function drawTrail(key,cam){
 const s=states[key];if(s.trail.length<2)return;ctx.beginPath();
 s.trail.forEach((p,i)=>{const q=pointToScreen(p.x,p.y,cam);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});
 ctx.strokeStyle=shipMode==="compare"?ships[key].trail:"rgba(255,255,255,.72)";ctx.lineWidth=clamp(cam.scale*.7,1.4,4);ctx.lineCap=ctx.lineJoin="round";ctx.stroke();
 const start=pointToScreen(s.trail[0].x,s.trail[0].y,cam);ctx.beginPath();ctx.arc(start.x,start.y,4,0,Math.PI*2);ctx.fillStyle=shipMode==="compare"?ships[key].color:"white";ctx.fill()
}

function drawShip(key,cam){
 const vessel=ships[key],s=states[key],p=pointToScreen(s.x,s.y,cam),scale=cam.shipScale,L=(key==="tanker"?vessel.length*.72:vessel.length*.78)*scale,W=vessel.width*.85*scale;
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(s.heading*Math.PI/180);ctx.shadowColor="rgba(0,0,0,.5)";ctx.shadowBlur=12;ctx.shadowOffsetY=6;key==="tanker"?drawTanker(L,W):drawFrigate(L,W);ctx.restore();
 if(shipMode==="compare")drawShipLabel(vessel.short,p.x,p.y-L*.58-18,vessel.color)
}

function drawShipLabel(label,x,y,color){
 ctx.save();ctx.font="bold 9px Arial";ctx.textAlign="center";ctx.textBaseline="middle";const width=ctx.measureText(label).width+14;
 ctx.fillStyle="rgba(4,20,27,.82)";ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x-width/2,y-10,width,20,5);ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.fillText(label,x,y);ctx.restore()
}

function drawTanker(L,W){
 ctx.beginPath();ctx.moveTo(0,-L/2);ctx.lineTo(W*.46,-L*.41);ctx.lineTo(W/2,L*.4);ctx.quadraticCurveTo(W*.45,L/2,0,L/2);ctx.quadraticCurveTo(-W*.45,L/2,-W/2,L*.4);ctx.lineTo(-W*.46,-L*.41);ctx.closePath();ctx.fillStyle="#a94f46";ctx.fill();ctx.strokeStyle="#f0a092";ctx.stroke();ctx.fillStyle="#773633";
 for(let y=-L*.3;y<L*.2;y+=Math.max(5,L*.105))ctx.fillRect(-W*.37,y,W*.74,Math.max(3,L*.06));
 ctx.fillStyle="#e0e8e7";ctx.fillRect(-W*.39,L*.22,W*.78,L*.17);ctx.fillStyle="#597983";ctx.fillRect(-W*.3,L*.17,W*.6,L*.06)
}

function drawFrigate(L,W){
 ctx.beginPath();ctx.moveTo(0,-L/2);ctx.lineTo(W*.4,-L*.31);ctx.lineTo(W/2,L*.28);ctx.lineTo(W*.34,L/2);ctx.lineTo(-W*.34,L/2);ctx.lineTo(-W/2,L*.28);ctx.lineTo(-W*.4,-L*.31);ctx.closePath();ctx.fillStyle="#9ba9ad";ctx.fill();ctx.strokeStyle="#eef5f6";ctx.stroke();ctx.fillStyle="#52666d";ctx.fillRect(-W*.28,-L*.1,W*.56,L*.24);ctx.fillStyle="#40535a";ctx.beginPath();ctx.arc(0,-L*.29,W*.18,0,Math.PI*2);ctx.fill()
}

const rotLabel=value=>Math.abs(value)<.05?"0.0°/min":Math.abs(value).toFixed(1)+"°/min "+(value<0?"BB":"BE"),speedLabel=value=>Math.abs(value)<.05?"0.0 kn":(value<0?"−":"")+Math.abs(value).toFixed(1)+" kn";
function updateSpeed(el,value){el.textContent=speedLabel(value);el.style.color=value<-.05?"var(--port)":value>.05?"var(--starboard)":"white"}
function updateInstruments(){
 const p=clamp(50+rudder/35*50,1,99),orderP=clamp(50+rudderOrder/35*50,1,99),r=Math.abs(rudder)<.05?0:rudder,order=Math.abs(rudderOrder)<.05?0:rudderOrder;
 rudderPointer.style.left=p+"%";rudderPointer.style.borderBottomColor=r<0?"var(--port)":r>0?"var(--starboard)":"white";rudderText.style.color=r<0?"var(--port)":r>0?"var(--starboard)":"#d9edf2";rudderText.textContent=!r?"0°":Math.abs(r).toFixed(1)+"° "+(r<0?"BB":"BE");
 rudderOrderPointer.style.left=orderP+"%";rudderOrderText.textContent=!order?"0°":Math.abs(order).toFixed(1)+"° "+(order<0?"BB":"BE");
 const gaugeMax=Math.max(5,Math.ceil(Math.max(...activeKeys().map(key=>ships[key].maxROT))/5)*5),gaugeMid=gaugeMax/2,gaugeMidText=Number.isInteger(gaugeMid)?gaugeMid:gaugeMid.toFixed(1);rotMaxLeft.textContent=rotMaxRight.textContent=gaugeMax;rotMidLeft.textContent=rotMidRight.textContent=gaugeMidText;
 if(shipMode==="compare"){
  const tank=states.tanker,frig=states.frigate;rotNeedle.style.transform="rotate("+clamp(tank.rot/gaugeMax*78,-78,78)+"deg)";frigateRotNeedle.style.transform="rotate("+clamp(frig.rot/gaugeMax*78,-78,78)+"deg)";
  tankerRotText.textContent=rotLabel(tank.rot);frigateRotText.textContent=rotLabel(frig.rot);tankerHeading.textContent=Math.round(tank.heading).toString().padStart(3,"0")+"°";frigateHeading.textContent=Math.round(frig.heading).toString().padStart(3,"0")+"°";updateSpeed(tankerSpeed,tank.speedKnots);updateSpeed(frigateSpeed,frig.speedKnots)
 }else{
  const s=states[shipMode],rr=Math.abs(s.rot)<.05?0:s.rot;rotNeedle.style.transform="rotate("+clamp(s.rot/gaugeMax*78,-78,78)+"deg)";rotNeedle.style.background=s.rot<-.05?"var(--port)":s.rot>.05?"var(--starboard)":"var(--cyan)";
  rotText.textContent=rotLabel(s.rot);rotText.style.color=rr<0?"var(--port)":rr>0?"var(--starboard)":"#d9edf2";headingText.textContent=Math.round(s.heading).toString().padStart(3,"0")+"°";updateSpeed(speedText,s.speedKnots)
 }
}

function advanceSimulation(duration){
 let remaining=duration;while(remaining>0){const step=Math.min(remaining,.05);physics(step);remaining-=step}
}

function animate(now){
 const realDt=Math.min((now-lastTime)/1000,.08);lastTime=now;advanceSimulation(realDt*baseTimeScale*timeScale);drawSea();const cam=camera();activeKeys().forEach(key=>drawTrail(key,cam));activeKeys().forEach(key=>drawShip(key,cam));updateInstruments();requestAnimationFrame(animate)
}

resetSimulation();requestAnimationFrame(animate);