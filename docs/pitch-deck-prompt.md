# Pitch Deck Prompt — HELIOSCORE 2030

Copy everything inside the box below into your slide tool (Claude, Gamma, Canva AI, Google Slides with Gemini, or similar).

```text
You are a pitch-deck designer for a student hackathon team. Build a slide deck for a
3-minute pitch (hard maximum: 5 minutes, and the live demo counts inside that time).

## Event and audience
- Event: IEEE Lumen 2.0 "Beyond 2030" hackathon. Theme: problems that appear as humans
  build on the Moon, Mars and in space.
- Audience: a jury of engineers and professors. They score:
  Innovation 25, Solution quality 30, Future relevance 20, Problem significance 10,
  Technical understanding 15.
- The jury hears many pitches. Keep every slide simple enough to understand in 5 seconds.

## The product (use these facts exactly; do not invent numbers)
Name: HELIOSCORE 2030 — a "digital twin" (a live software copy) of a nuclear power
plant on the Moon that protects the plant from lunar dust and keeps the crew safe.

The story, in plain words:
1. By about 2030, NASA plans a small nuclear reactor on the Moon (about 40 kilowatts of
   electricity). It powers the crew habitat and the machines that mine ice for water and
   oxygen.
2. The reactor must dump its waste heat into space through big flat panels called
   radiators.
3. When a spacecraft lands nearby, its engine blasts lunar dust everywhere. The dust sticks
   to the radiators like a blanket.
4. A dusty radiator cannot cool. The reactor gets hotter, so it must cut its power output
   to protect itself.
5. Less power puts the crew at risk: life support, heating and communication all need
   power, and Earth is too far away to help in real time.

Our solution is "defense in depth": four layers, each one shown by one demo button.
- Layer 1 — Normal operation: 40 kW, clean radiators, three ice drills running.
- Layer 2 — Protect: when a dust storm starts, an electric "mesh net" around the reactor
  turns on by itself and pushes away 85 out of every 100 dust grains. Only a little dust
  sticks (about 29%). Power only dips a little.
- Layer 3 — Detect and clean: a heat camera finds the dusty radiator by itself and draws a
  green box around it. Then an electric pulse cleans only that one radiator. Power returns
  to 40 kW.
- Layer 4 — Survive: in the worst case the net breaks during a storm. The radiator gets very
  dirty (89%), the reactor gets hot, and power drops to 24.5 kW. The system then switches
  off the ice drills automatically, so life support, heating and communication keep 100%
  of their power. One button cleans the radiator and brings the drills back.

Technology, in plain words (no formulas on slides):
- A web app. It runs completely in the browser, with no server and no internet needed.
- A physics simulation updates 10 times every second.
- A 3D view of the crater, the reactor, the radiators, the habitat and the ice drills.
- A heat-camera image that the software analyses pixel by pixel to find the hot radiator.
  Be honest: this is classic image analysis, not a trained neural network.
- Automatic power sharing ("triage") that always protects the crew first.

## Deck structure (follow this order: Problem → Future → Idea → Technology → Product → Impact)
Make exactly 8 slides. Times are for the 3-minute version.

1. Title (10 s) — "HELIOSCORE 2030". Subtitle: "Keeping the first Moon reactor — and its
   crew — alive through dust storms." Team name placeholder.
2. Problem (25 s) — Headline: "Dust can switch off the Moon's power plant."
   Visual: a radiator panel going from clean to covered. Three short points: landers blast
   dust; dust blocks cooling; the reactor must cut power.
3. Future (20 s) — Headline: "2030: the first reactor on the Moon."
   Visual: simple timeline 2026 → 2030 → 2035 (reactor test → first lunar reactor →
   permanent base with ice mining). One line: "More landings means more dust."
4. Idea (30 s) — Headline: "Defense in depth: Protect → Detect → Clean → Survive."
   Visual: four stacked layers or a shield diagram, one icon and 3–5 words per layer.
5. Technology (20 s) — Headline: "A live digital twin in the browser."
   Visual: a simple flow: Physics simulation → 3D view + heat camera → automatic actions.
   Max 4 boxes. No code, no equations.
6. Product / Demo (60 s) — Headline: "Live demo: four buttons, one story."
   Layout: four screenshot placeholders labelled [1] Normal, [2] Dust storm,
   [3] AI cleaning, [4] Shield failure. Speaker note: switch to the live app here.
7. Impact (15 s) — Headline: "The crew stays safe, even when the shield fails."
   Three big numbers: "85% of dust blocked", "100% power for life support",
   "1 button to recover".
8. Close (10 s) — "HELIOSCORE 2030 — power that defends itself." Thank you + one line
   offer: "Ask us to break it live."

For a 5-minute version, keep the same 8 slides and expand: Problem 40 s, Idea 45 s,
Demo 2 min 30 s, Impact 30 s.

## Writing rules
- Maximum 12 words of body text per slide (headline not included).
- No formulas, no units harder than "kW", no acronyms on slides except "AI" and "3D".
- One main visual per slide. Big type. Lots of empty space.
- Use the words "dust", "radiator", "net", "heat camera", "clean", "crew". Avoid jargon such
  as "emissivity", "Stirling", "EDS", "ISRU" on slides (they may appear in speaker notes,
  each explained in one short sentence).
- Do not claim the product is flight-proven or uses machine learning. It is a working
  prototype simulation.

## Design direction
- Dark "mission control" style: near-black blue background (#070d14), cyan accents
  (#22d3ee) for "safe / system", amber (#fbbf24) for "warning", red (#ef4444) for "danger".
- Clean sans-serif font (for example Bahnschrift, Barlow or Inter). Numbers in a monospace font.
- Thin cyan line icons. No stock photos of astronauts. Simple shapes are fine.

## Output
For every slide give: slide title, on-slide text, visual description, and speaker notes
(what to say, 2–4 short sentences, written to be spoken aloud, matching the time budget).
At the end, give a one-line timing check that the total is 3:00.
```

## Tips for using the prompt

- Take the four demo screenshots from the live app: open `/?scenario=1`, `/?scenario=2`, `/?scenario=3` and `/?scenario=4`, wait about 15 seconds each, then capture the screen. Put them on slide 6.
- Rehearse with a timer. If you go over 3 minutes, shorten slides 3 and 5 first, not the demo.
- The demo carries the most points (solution quality is 30 of 100). Do not cut it.
