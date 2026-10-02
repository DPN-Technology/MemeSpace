# MemeSpace 2.5 — Neon Arcade

The requested redesign replaces the small game picker with a full arcade lobby and three new playable cabinets: Reactor Pinball, After Hours Pool, and Quantum Reels. Existing memory, binary and sequence games remain as classics. Games render live, work with keyboard and touch, support pause/mute, and store personal records under the current identity on this browser. They do not claim competitive or server-verified scores.

Pinball uses fixed-step ball/capsule collisions, moving flippers, bumpers, lane targets, a plunger, a short ball saver, three-ball rounds, nudges/tilt and earned multiball. Pool uses fixed-step equal-mass collisions, cushions, pocket capture, cue placement, aiming guides and power control. Modes are solo clearance, local two-player eight-ball and a computer opponent. Its explicit arcade house rules include ball-in-hand after fouls, assigned groups, called-pocket eight-ball, and re-spotting eight on a break. It is not marketed as a certified competition simulation.

The slot cabinet uses five fixed paylines across nine independently sampled symbols. A displayed paytable defines all awards. Credits are local, free, resettable and have no cash value. There is no payment, purchase, transfer, withdrawal, wallet transaction or prize. Outcomes are resolved exactly once before animation, so leaving the page cannot consume a spin without its result being credited.

The separate Control Center gains a games permission and a catalog view to enable/pause individual games with an audited reason. Public catalog refreshes reflect availability; already open cabinets stay playable for that visit. Availability is a user-experience control rather than an anti-cheat boundary for client-side games.

Deliver the full local source as v2.5 with unchanged runtime/dependencies, updated migration, tests, documentation and existing launchers. Verification covers physics invariants, scoring/rules, complete-round lifecycles, slot evaluation and persisted settlement, admin authorization and catalog integration, TypeScript and production build. Browser verification uses the supported environment if local addresses are reachable.
