'use strict';
// Read-only instrumentation, loaded by NODE_OPTIONS in the standard validation child.
// Never changes a decision, budget, rule state, retry policy, or exception.
if ((process.argv[1] || '').endsWith('/tools/run_research_validation.js')) {
  const fs=require('node:fs'),path=require('node:path');
  const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(process.env.SETI_BASELINE_MANIFEST,'utf8'));
  const prefix=path.join(root,manifest.outputPrefix);
  const modulePath=path.join(root,'randomizer/app/simulation-env.js'),api=require(modulePath),original=api.createSimulationEnv;
  if(fs.existsSync(prefix+'.telemetry.jsonl'))throw Error('Existing baseline telemetry; do not rerun this experiment');
  api.createSimulationEnv=function(options={}){
    let lastTrace=null,steps=0,failed=false,started=performance.now(),lastCheckpointAt=-Infinity;
    const env=original({...options,onAgentDecision(trace){lastTrace=trace;options.onAgentDecision?.(trace);}});
    const decide=env.runAgentDecision.bind(env),reset=env.reset.bind(env),dispose=env.dispose.bind(env);
    env.reset=function(...args){started=performance.now();return reset(...args);};
    env.runAgentDecision=function(){
      const at=performance.now();
      if(steps%20===0||at-lastCheckpointAt>10000){
        const checkpointPath=prefix+`.checkpoint-step-${steps}.json`;
        fs.writeFileSync(checkpointPath,JSON.stringify(env.createCheckpoint())+'\n');
        fs.writeFileSync(prefix+'.progress.json',JSON.stringify({confirmedInputs:steps,checkpointPath:path.relative(root,checkpointPath),elapsedMs:at-started})+'\n');
        lastCheckpointAt=performance.now();
      }
      try{
        const result=decide(),search=result.searches?.[0];steps++;
        fs.appendFileSync(prefix+'.telemetry.jsonl',JSON.stringify({step:steps,decisionMs:performance.now()-at,elapsedMs:performance.now()-started,
          actorId:result.actorPlayerId,actionId:result.actionId,memory:process.memoryUsage(),rootAndSearchMs:search?.rootAndSearchMilliseconds,
          diagnostics:search?.diagnostics,analysis:search?.analysis})+'\n');
        return result;
      }catch(error){
        failed=true;
        const failedAt=performance.now(),checkpoint=env.createCheckpoint(),save=env.saveBrowserSave({name:manifest.experiment+'-failed'});
        const relativeSave=`seti-saves/seti-save-research-${manifest.experiment}-${manifest.identity.gitCommit}-full-failed-v${save.stateVersion}.json`;
        fs.mkdirSync(path.join(root,'seti-saves'),{recursive:true});fs.writeFileSync(path.join(root,relativeSave),JSON.stringify(save,null,2)+'\n');
        fs.writeFileSync(prefix+'.failed-checkpoint.json',JSON.stringify(checkpoint)+'\n');
        fs.writeFileSync(prefix+'.failure.json',JSON.stringify({schemaVersion:'seti-ai-baseline-failure-v1',...manifest,steps,
          wallMs:failedAt-started,failedDecisionMs:failedAt-at,terminal:env.isTerminal(),savePath:relativeSave,
          checkpointPath:path.relative(root,prefix+'.failed-checkpoint.json'),lastTrace,
          error:{message:error.message,code:error.code,cause:error.cause&&{message:error.cause.message,code:error.cause.code,search:error.cause.search},stack:error.stack}},null,2)+'\n');
        throw error;
      }
    };
    env.dispose=function(){fs.writeFileSync(prefix+'.observer-summary.json',JSON.stringify({steps,failed,elapsedThroughDisposeMs:performance.now()-started,manifest},null,2)+'\n');return dispose();};
    return env;
  };
}
