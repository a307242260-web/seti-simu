# Quiet continuation proof composition

Current f97bf463 original008 is complete at577 inputs, V37.5, first card_corner:72914895, shortest10; fixed256 remains incomplete. Read-only replay checked491 graph nodes and all577 inputs. 120 public-scan final choices have identical boundary value, but a separate scan theorem is not yet implemented.

First candidate: compose existing postMainPlanSpec with postMainValueBound. The former already proves every excluded continuation is no better (and shorter retained witnesses preserve ties). Its retained graph has only native data corners, data placement, income and end_turn. Therefore an upper bound on the retained graph is also an upper bound on every original path. This does not establish money monotonicity for additional cards, and knownCardMoneyOrder remains unchanged.

The newer bound currently requires the stronger full-play card model check and rejects all reserved tasks / historical events. When the exact existing quiet proof is available, inactive tasks and its already-checked nonmatching historical events may be admitted. Other bound exclusions (company, blue, special probes, endgame formula, temporary tasks, overflow, threshold, native slots and income codes) stay intact. Unexecuted hand play effects are not re-enabled; stable post-main and quiet-company closure still apply. The bound records its quiet proof dependency.

Preserve exact state equivalence, all necessary competing branches, tie order, Production execution, owner/information boundaries, all payment exits, and global transition/node/frontier/watchdog budgets. No depth/beam/leaf caps. Default factory remains256/257/256/600ms; a single decision must pass before any full game. Cache unchanged.

Acceptance: original008 off/on complete windows must retain V37.5, original first action and shortest10, with a substantial input reduction and the fixed gate measured again. Controlled scopes must retain raw-native optimum, first action, distance, cache parity, input/node/frontier budgets and one real input per agent call. Ready tasks, live historical triggers and temporary tasks must reject composition. No global gate or game claim from a local sample.
