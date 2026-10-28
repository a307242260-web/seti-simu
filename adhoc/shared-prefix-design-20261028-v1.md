# Shared resource preparation prefixes

Goal: common native preparation is computed/stored once across goal alternatives; physical path length, charged unique work and cache reuse are distinct. All original goals/leaf values remain compared. No budget increase or new policy pruning.

Identity: only reuse an expansion of the exact same immutable source node, input descriptor and planning flags in one opened search. Its full native snapshot/queue/RNG and target-bound control already belong to that node. Do not merge wallets or use goal labels/deficits as state identity. Goal-local protection, demand and next-action policy are recomputed independently; differing inputs fork normally. Reset/close clears the graph.

Resource feasibility/lower-bound pruning and deterministic greedy source/route policies are unchanged. Search graph identities remain exact. Shared prefix DAG records native edges and separate per-goal paths; native edge count is distinct from path cost. Every newly executed edge is admitted against the same global 256 input/257 node/256 frontier/600ms limits; shared state is charged once, reused work still checks time. The first uncached successor reserves a state before execution. Incomplete prefixes contribute realized work/states but produce no action/certificate.

Legacy non-resource macros retain existing conservative accounting. Expose actual native submissionCount separately; resource shared-input accounting must never claim logical path length is actual repeated work. A shared internal state later inserted into the decision graph moves ownership without double-counting.

Acceptance: actual case-105's 20 goals retain all leaf observations/values, have 20 paths of length 8, share 7 native edges and fork into 20 choices (27 edges/28 states). Test cache=0 and 256, exact input/node thresholds, frontier/time interruption including all-reused paths, root/RNG immutability, lifecycle reset and browser/simulation per-click recovery. Single-decision measurements precede any games. Reuse dated checkpoints; no full games in this change.
