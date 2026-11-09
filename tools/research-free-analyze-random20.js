'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const whiteFull=require('./research-human405-full'),first=require('./research-human405-round1');
const ID='v661-free-analyze-random20-v1',FILE='reports/fixed-boards/free-analyze-random20-20261104-v1.json';
const raw=fs.readFileSync(path.resolve(__dirname,'..',FILE)),catalog=JSON.parse(raw),hash=crypto.createHash('sha256').update(raw).digest('hex');
const LEARNER='player-white',COMPANY='industry:深空探测.png',SETUP=['start_initial_setup','select_initial_card','confirm_initial_setup','discard-hand-cards'];
const sorted=(a,key)=>[...a].sort((x,y)=>key(x).localeCompare(key(y)));
assert.equal(catalog.boards.length,20);assert.equal(new Set(catalog.boards.map(x=>x.seed)).size,20);
function describe(identity,{full}={}){
 if(!full||identity.agentType!=='search'||identity.activePlayerCount!==4)throw Error('RANDOM20_REQUIRES_FOUR_SEAT_SEARCH_FULL_MODE');
 const board=catalog.boards.find(x=>x.seed===identity.seed);
 if(!board)throw Error('RANDOM20_SEED_NOT_IN_ORIGINAL_CATALOG');
 return {id:ID,learnerSeat:LEARNER,learnerAgentType:'search',hostAgentFactory:'custom-seat-roles',
  boardNumber:board.number,boardName:board.name,catalog:FILE,catalogSha256:hash,
  setupPolicy:'deep-space-white-then-first-offered-initial-cards-and-required-discard-v1',
  opponentPolicyVersion:'seti-human405-pass-only-v1',opponentReserveRule:'historical-preference-if-offered-otherwise-stable-action-id',
  roles:{'player-white':'shared-search','player-green':'pass-only','player-blue':'pass-only','player-brown':'pass-only'},
  comparisonScope:'white-only-full-game',scoreSemantics:'terminal-score-with-passive-opponents',
  roundEndPhase:'before-pass-card-and-income',baselineEligible:false,stopAfterRound:null,
  decisionGate:{nativeInputs:256,milliseconds:600,enforcement:'measure-only'},gameMillisecondsTarget:180000};
}
function initialize(env,config,metadata){
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
module.exports={ID,describe,initialize,createEnvironment:whiteFull.createEnvironment,settled:whiteFull.settled};
