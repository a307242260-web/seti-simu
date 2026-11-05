'use strict';
// Controlled policy ablation only: retain the exact native root/rules/value,
// remove the new computer-prefix catalog purpose without changing any state.
const modulePath=require.resolve('../randomizer/game/ai/resource-demand'),demand=require(modulePath);
require.cache[modulePath].exports=Object.freeze({...demand,catalog:input=>demand.catalog(input).filter(goal=>goal.kind!=='computer-prefix')});
