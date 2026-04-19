#import "@preview/cetz:0.3.4": *
#import "@preview/fletcher:0.5.8" as fletcher: diagram, node, edge

#set page(
  paper: "us-letter",
  margin: (x: 1.1in, y: 0.95in),
  numbering: "1",
  number-align: center + bottom,
)

#set text(font: ("New Computer Modern", "Inter", "Libertinus Serif"), size: 11pt, fill: rgb("#111827"))
#set par(justify: true, leading: 0.72em)
#set heading(numbering: "1.", supplement: [Part])

#let muted(body) = text(fill: rgb("#4b5563"), body)
#let chip(t, color: rgb("#2563eb")) = box(
  inset: (x: 8pt, y: 3pt),
  radius: 999pt,
  fill: color.lighten(85%),
  stroke: 0.6pt + color.lighten(35%),
  text(9pt, weight: "semibold", fill: color.darken(15%), t),
)

#align(center)[
  #v(1.3cm)
  #text(38pt, weight: "black", tracking: 1.4pt)[COMMUNITY SIGNALS]
  #v(0.2cm)
  #text(15pt, fill: rgb("#374151"))[How to Find What People Will Pay For by Reading Where They Complain]
  #v(0.8cm)
  #chip([Field Manual Edition], color: rgb("#0f766e"))
  #v(4.4cm)
  #muted[*A practical system for spotting real demand before you build.*]
]
#pagebreak()

= Before You Read This

This is not a founder memoir.

There are no exits here. No origin story about how something started in a garage and ended in a headline. No lessons reverse-engineered from success.

This is a working system for answering a much simpler question:

#align(center)[#text(14pt, weight: "bold")[What is worth building right now?]]

Most founders never answer that question correctly.

They don’t fail because they can’t build.  
They fail because they build something no one needed badly enough.

The default approach:

- Brainstorm ideas
- Ask people what they want
- Analyze competitors
- Start building

This book replaces it with:

- Start with people already struggling
- Read what they say when they’re frustrated
- Identify patterns in their behavior
- Validate before you build

The raw material is already public: Reddit, forums, Slack groups, Discord servers. That’s where broken workflows, failed tools, manual processes, pricing complaints, and hiring attempts show up in the open.

#block(fill: rgb("#eff6ff"), inset: 14pt, radius: 8pt, stroke: 0.8pt + rgb("#bfdbfe"))[
  #text(10pt, weight: "bold", fill: rgb("#1e3a8a"))[Promise]
  There is no guarantee in this process. There is a filter. Run it honestly, and you stop building the wrong thing.
]

#pagebreak()
= Part I — Signal vs Noise

== Why People Tell the Truth When They’re Annoyed

Most market research fails because it asks people to imagine behavior instead of observing it.

#grid(columns: (1fr, 1fr), gutter: 10pt,
  [
    #text(10pt, weight: "bold", fill: rgb("#991b1b"))[Hypothetical]
    “Would you pay for a better solution?”
  ],
  [
    #text(10pt, weight: "bold", fill: rgb("#065f46"))[Behavioral]
    “I spent two hours fixing this because nothing works.”
  ],
)

One is opinion. The other is cost.

== The Signal Ladder

#align(center)[#text(12pt, weight: "bold")[From noise to money-moving evidence]]

#fletcher.diagram(
  spacing: 1.2cm,
  fletcher.node((0, 0), [L1: Noise\
  Vague dissatisfaction], fill: rgb("#fee2e2"), stroke: rgb("#ef4444")),
  fletcher.node((0, -1.6), [L2: Friction\
  Specific annoyance + workaround], fill: rgb("#fef3c7"), stroke: rgb("#f59e0b")),
  fletcher.node((0, -3.2), [L3: Operational Pain\
  Repeated cost in workflow], fill: rgb("#dbeafe"), stroke: rgb("#3b82f6")),
  fletcher.node((0, -4.8), [L4: Purchase Intent\
  Tool search, budget, hiring], fill: rgb("#dcfce7"), stroke: rgb("#16a34a")),
  fletcher.edge((0, 0), (0, -1.6)),
  fletcher.edge((0, -1.6), (0, -3.2)),
  fletcher.edge((0, -3.2), (0, -4.8)),
)

#block(fill: rgb("#ecfdf5"), inset: 10pt, radius: 7pt, stroke: 0.7pt + rgb("#86efac"))[
  #strong[Rule:] Build only for Levels 3 and 4.
]

== The Two Types of Pain

- #strong[Self-Serve Pain:] “I want a tool to solve this.”
- #strong[Outsource Pain:] “I want someone else to handle this.”

A problem can be urgent and expensive yet still fail as software when the default behavior is delegation.

== The Workaround Heuristic

The best opportunities look messy: spreadsheet stacks, email chains as process engines, and private shadow systems around official tools.

#pagebreak()
= Part II — The Extraction System

== Minimum Viable Community Checklist

#table(
  columns: (3fr, 1fr),
  align: (left, center),
  stroke: (x, y) => if y == 0 {0pt} else {0.5pt + rgb("#d1d5db")},
  table.header([Signal], [Pass?]),
  [Readable without gatekeeping], [☐],
  [Detailed complaints], [☐],
  [Mentions of tools/spending], [☐],
  [Clear user identity], [☐],
  [Steady weekly activity], [☐],
)

If two fail, move on.

== Three-Phase Deep Mine

#enum(
  [#strong[Extraction] — harvest exact frustration language, failed tools, and cost mentions. Target 200–400 data points.],
  [#strong[Clustering] — collapse posts into 8–15 recurring problem clusters, each tied to one solveable product shape.],
  [#strong[Reality Score] — rank by weighted criteria so you validate only strong candidates.],
)

== Reality Score Model

#table(
  columns: (2.5fr, 1fr, 3fr),
  align: (left, center, left),
  table.header([Factor], [Weight], [What it captures]),
  [Pain Frequency], [×2], [How often the issue appears],
  [Pain Intensity], [×2], [Operational damage per occurrence],
  [Solution Gap], [×1.5], [Failure of existing tools],
  [Willingness to Pay], [×2], [Evidence that money is already moving],
  [Build Feasibility], [×1], [Can you ship a useful version quickly?],
  [Market Access], [×1.5], [Can you consistently reach buyers?],
  [Defensibility], [×1], [Can this remain hard to copy?],
  [Buyer Alignment], [×2], [Is the complainer also the payer?],
)

#grid(columns: (1fr, 1fr, 1fr), gutter: 8pt,
  box(fill: rgb("#dcfce7"), inset: 8pt, radius: 6pt)[#strong[80+] Validate now],
  box(fill: rgb("#fef9c3"), inset: 8pt, radius: 6pt)[#strong[60–79] Promising],
  box(fill: rgb("#fee2e2"), inset: 8pt, radius: 6pt)[#strong[Under 60] Move on],
)

#pagebreak()
= Part III — Validation (Kill or Commit)

#align(center)[#text(12pt, weight: "bold")[Validation asks one question: will strangers take action?]]

#let test-card(name, goal, metric) = block(
  fill: rgb("#f8fafc"), stroke: 0.6pt + rgb("#cbd5e1"), radius: 8pt, inset: 10pt,
  [#strong[#name]\\ #muted[#goal]\\ #metric]
)

#test-card(
  [Test 1 — Signal Confirmation],
  [Ask: “How are you currently handling this?”],
  [Strong thread engagement = real pain],
)
#v(6pt)
#test-card(
  [Test 2 — Intent Capture],
  [Landing page with one clear action],
  [15%+ waitlist strong; 3%+ paid conversion very strong],
)
#v(6pt)
#test-card(
  [Test 3 — Direct Contact],
  [Message 12 people who already posted],
  [4+ replies, 2+ conversations],
)

#block(fill: rgb("#fffbeb"), inset: 10pt, radius: 7pt, stroke: 0.7pt + rgb("#fcd34d"))[
  Compliments are not validation. Signups are weak validation. #strong[Money is validation.]
]

#pagebreak()
= Part IV — What to Ship

== Product Shape Rule

#table(
  columns: (1fr, 1fr),
  table.header([Complaint pattern], [Natural product format]),
  [Manual recurring task], [SaaS],
  [Custom spreadsheet jungle], [Template pack],
  [Paid human workaround], [Service],
  [Information gap], [Guide],
  [Discovery problem], [Directory],
)

Do not invent the product shape. Extract it from behavior.

== Pricing Lens

Price against cost removed, not features added.

- If pain is ~\$1,000/year, test \$10–50/month.
- If pain is ~\$10,000/year, test around \$100/month.

== Launch Sequence

#enum(numbering: "1.",
  [Contribute to the community before promotion.],
  [Share useful synthesis, not hype.],
  [Build in public using user language.],
  [Launch in the same channels where the signal appeared.],
)

#pagebreak()
= Part V — Case Files

#grid(columns: (1fr, 1fr), gutter: 10pt,
  box(fill: rgb("#f0fdf4"), inset: 10pt, radius: 8pt, stroke: 0.6pt + rgb("#86efac"))[
    #strong[Case 1 — Construction Submittals]
    - Strong operational pain
    - Ugly workaround
    - Weak incumbent tools
    #v(4pt)
    #strong[Outcome:] Validates as simple SaaS
  ],
  box(fill: rgb("#fff7ed"), inset: 10pt, radius: 8pt, stroke: 0.6pt + rgb("#fdba74"))[
    #strong[Case 2 — Tax Tool (Failure)]
    - High stakes, high urgency
    - Behavior is outsourcing
    #v(4pt)
    #strong[Outcome:] Software mismatch
  ],
  box(fill: rgb("#eff6ff"), inset: 10pt, radius: 8pt, stroke: 0.6pt + rgb("#93c5fd"))[
    #strong[Case 3 — Vet Tech Templates]
    - Moderate pain
    - Strong spreadsheet workaround
    #v(4pt)
    #strong[Outcome:] Best delivered as templates
  ],
  box(fill: rgb("#fef2f2"), inset: 10pt, radius: 8pt, stroke: 0.6pt + rgb("#fca5a5"))[
    #strong[Case 4 — False Positive]
    - High engagement, wrong buyer
    - Low willingness to pay
    #v(4pt)
    #strong[Outcome:] Fails conversion, kill
  ],
)

#pagebreak()
= Final Section — The Real Advantage

This is not a one-time tactic. It’s a way of seeing:

- detect recurring patterns
- map visible cost
- recognize urgency
- interpret behavior over stated preference

#align(center)[
  #v(1cm)
  #text(16pt, weight: "bold", fill: rgb("#0f172a"))[Build for problems people are already paying to solve.]
  #v(0.3cm)
  #muted[Everything else is noise.]
]

#v(2cm)
#align(center)[#text(10pt, fill: rgb("#6b7280"))[End]]
