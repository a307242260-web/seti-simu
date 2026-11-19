'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const whiteFull=require('./research-human405-full'),first=require('./research-human405-round1');
const ID='v661-free-analyze-random20-v1',STRICT_ID='free-analyze-random20-guarded-v1',CONTROL_ID='free-analyze-known-scan-control-v1',IDS=Object.freeze([ID,STRICT_ID,CONTROL_ID]),FILE='reports/fixed-boards/free-analyze-random20-20261104-v1.json';
const raw=fs.readFileSync(path.resolve(__dirname,'..',FILE)),catalog=JSON.parse(raw),hash=crypto.createHash('sha256').update(raw).digest('hex');
const LEARNER='player-white',COMPANY='industry:深空探测.png',SETUP=['start_initial_setup','select_initial_card','confirm_initial_setup','discard-hand-cards'];
const sorted=(a,key)=>[...a].sort((x,y)=>key(x).localeCompare(key(y)));
assert.equal(catalog.boards.length,20);assert.equal(new Set(catalog.boards.map(x=>x.seed)).size,20);
function controlledScanSource(){
 const file='reports/ai-foundation-20261119/income-scan-control-preparation-20261119-v2.json',bytes=fs.readFileSync(path.resolve(__dirname,'..',file)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 assert.equal(sha(bytes),'c26c297e3f9c2f844b46ba07cba08bd571158f0613657c86b87e8f5a6f450011','SCAN_CONTROL_PREPARATION_DRIFT');const proof=JSON.parse(bytes);
 for(const[p,h]of Object.entries(proof.runtimeSourceHashes))assert.equal(sha(fs.readFileSync(path.resolve(__dirname,'..',p))),h,'SCAN_CONTROL_POLICY_DRIFT:'+p);
 const saveBytes=fs.readFileSync(path.resolve(__dirname,'..',proof.savePath));assert.equal(sha(saveBytes),proof.saveSha256,'SCAN_CONTROL_SAVE_DRIFT');
 const archive=fs.readFileSync(path.resolve(__dirname,'..',proof.archivePath));assert.equal(sha(archive),proof.archiveSha256,'SCAN_CONTROL_NATIVE_PROOF_DRIFT');
 const save=JSON.parse(saveBytes),state=JSON.parse(save.committedState);assert.equal(save.seed,proof.seed);assert.equal(save.replaySteps.length,138);assert.equal(save.session,null);assert(save.machineAI[LEARNER]);assert.equal(state.turn.roundNumber,3);assert(!state.turn.gameEnded);assert.equal(state.turn.currentPlayerId,LEARNER);
 return{save,provenance:{sourcePolicyCommit:proof.sourcePolicyCommit,savePath:proof.savePath,saveSha256:proof.saveSha256,preparationPath:file,preparationSha256:sha(bytes),nativeArchive:proof.archivePath,nativeArchiveSha256:proof.archiveSha256,originalInputs:114,fixedPurposeInputs:23,controlledPrefixInputs:138,inheritedAutonomousInputs:1,completedRoundsBeforeContinuation:2}};
}
function describe(identity,{full}={}){
 if(!full||identity.agentType!=='search'||identity.activePlayerCount!==4)throw Error('RANDOM20_REQUIRES_FOUR_SEAT_SEARCH_FULL_MODE');
 const board=catalog.boards.find(x=>x.seed===identity.seed);
 if(!board)throw Error('RANDOM20_SEED_NOT_IN_ORIGINAL_CATALOG');
 const control=identity.flags?.scenario===CONTROL_ID,prepared=control?controlledScanSource():null;
 if(control)assert.equal(identity.seed,prepared.save.seed,'SCAN_CONTROL_SEED_MISMATCH');
 const strict=identity.flags?.scenario===STRICT_ID||control;
 return {id:control?CONTROL_ID:strict?STRICT_ID:ID,learnerSeat:LEARNER,learnerAgentType:'search',hostAgentFactory:'custom-seat-roles',
  boardNumber:board.number,boardName:board.name,catalog:FILE,catalogSha256:hash,
  setupPolicy:'deep-space-white-then-first-offered-initial-cards-and-required-discard-v1',
  opponentPolicyVersion:'seti-human405-pass-only-v1',opponentReserveRule:'historical-preference-if-offered-otherwise-stable-action-id',
  roles:{'player-white':'shared-search','player-green':'pass-only','player-blue':'pass-only','player-brown':'pass-only'},
  comparisonScope:'white-only-full-game',scoreSemantics:'terminal-score-with-passive-opponents',
  roundEndPhase:'before-pass-card-and-income',baselineEligible:false,stopAfterRound:null,
  decisionGate:{nativeInputs:256,milliseconds:600,enforcement:strict?'reject-before-input':'measure-only'},gameMillisecondsTarget:180000,
  ...(control?{openingInputs:138,originalOpeningInputs:24,controlledPurposePrefix:prepared.provenance,autonomousScope:'after-fixed137-and-one-committed-autonomous-input',comparisonScope:'white-only-fixed-scan-route-intervention',scoreSemantics:'terminal-score-with-fixed-known-scan-purpose-prefix'}:{})};
}
function initialize(env,config,metadata,{checkpointFromSave}={}){
 if(metadata.id===CONTROL_ID){
  const prepared=controlledScanSource();assert.deepEqual(metadata.controlledPurposePrefix,prepared.provenance);assert.equal(config.seed,prepared.save.seed);
  env.loadCheckpoint(checkpointFromSave(prepared.save,{...config,agentType:'custom',seat:LEARNER,opponentIdentity:metadata.opponentPolicyVersion}));
  const restored=env.saveBrowserSave();assert.equal(restored.committedState,prepared.save.committedState);assert.deepEqual(restored.session,prepared.save.session);assert.deepEqual(restored.replaySteps,prepared.save.replaySteps);assert.deepEqual(restored.machineAI,prepared.save.machineAI);return restored.replaySteps;
 }
 const board=catalog.boards.find(x=>x.seed===config.seed);
 assert(board&&metadata.catalogSha256===hash&&metadata.boardNumber===board.number);
 env.reset({...config,agentType:'custom',seat:LEARNER,opponentIdentity:metadata.opponentPolicyVersion});
 const seen=new Map(),prefix=[];
 for(let i=0;i<36;i++){
  const menu=env.legalActions();
  if(!menu.some(x=>SETUP.includes(x.target?.kind)))break;
  assert(menu.every(x=>SETUP.includes(x.target?.kind)));
  const player=menu[0].actorId,taken=seen.get(player)||[];
  if(i===1){
   const e=env.createCheckpoint().coreState.compositionEnvelope,s=e.session?.session?.workingState;
   const offer=s.match.initialSetup.offersByPlayerId[LEARNER];
   assert.deepEqual(offer.industryOptions.map(x=>x.value.replace(/\.png$/,'')),board.companies);
   assert.deepEqual(offer.initialOptions.map(x=>x.value),board.initialOptions);
   assert.deepEqual(s.cards.publicCards.map(x=>x?.cardId),board.publicCards);
   assert.equal(s.meta.worldVersion,board.worldVersion);
  }
  const find=(kind,p=()=>true)=>menu.find(x=>x.target?.kind===kind&&p(x));
  const a=find('start_initial_setup')||find('confirm_initial_setup')
   ||(!taken.some(x=>x.startsWith('industry:'))&&find('select_initial_card',x=>x.target.selectionKind==='industry'
       &&(player!==LEARNER||x.target.cardId===COMPANY)))
   ||find('select_initial_card',x=>x.target.selectionKind==='initial'&&!taken.includes(x.target.cardId))
   ||sorted(menu.filter(x=>x.target?.kind==='discard-hand-cards'),x=>x.actionId)[0];
  assert(a,'RANDOM20_REQUIRED_SETUP_ACTION_MISSING:'+player);
  if(a.target.cardId)taken.push(a.target.cardId);seen.set(player,taken);
  const result=env.step(a);assert(result.ok,JSON.stringify(result));prefix.push({actorPlayerId:player,action:a});
 }
 assert(seen.get(LEARNER)?.includes(COMPANY));assert.equal(seen.size,4);
 assert(!env.legalActions().some(x=>SETUP.includes(x.target?.kind)),'RANDOM20_SETUP_NOT_CLOSED');
 const p=env.observe(LEARNER).selfState;
 assert(p,'RANDOM20_WHITE_OBSERVATION_UNAVAILABLE');
 return prefix;
}
function createEnvironment(options,metadata){
 return [STRICT_ID,CONTROL_ID].includes(metadata?.id)?first.createEnvironment(options,metadata):whiteFull.createEnvironment(options,metadata);
}
module.exports={ID,IDS,CONTROL_ID,controlledScanSource,describe,initialize,createEnvironment,settled:whiteFull.settled};
