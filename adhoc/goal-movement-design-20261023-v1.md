# Goal movement final design, 2026-10-23

The implementation contract and scope/acceptance matrix are in
[ai-goal-movement-20261023.md](../docs/ai-goal-movement-20261023.md).

Movement is a goal-plan execution, not an independent direction candidate. Current-turn
endpoints execute route, canonical native payments and the exact endpoint. Future positioning
compares prefixes of this one selected route with waiting for one explicitly assumed native
solar rotation, including expiring free movement. Only a strictly cheaper prefix is advanced.
Goals/payout preferences are deterministic policy, not equivalence proofs. Cross-state money
and resource dominance are disabled in this mode. Full rule identities remain intact and goal
intent is added to control identity; native Session history reconstructs it after restoration.
All native inputs, macro internal states, time and frontier remain globally budgeted.

No integration of the paused direction-tree-bound prototype. No full-game or 180-second claim.
Final cold benchmark, fixed corpus, full Node, four Chrome smokes and valuation-input audit
are independently checkpointed and bound to the final source in the delivery manifest.
