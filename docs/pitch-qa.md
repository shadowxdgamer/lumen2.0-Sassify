# Jury Q&A — Simple Answers (No Maths)

Each answer is short on purpose. Say the first sentence. Add the second only if the judge wants more.

## The problem

**Why is dust such a big problem on the Moon?**
Moon dust is sharp, fine and electrically charged, so it sticks to everything. On a radiator it acts like a blanket and stops the heat from leaving.

**Where does the dust come from?**
Mostly from spacecraft landing nearby. Their engines throw dust far across the surface. Moving rovers and natural electric charging also lift dust.

**Why does a dirty radiator matter so much?**
The reactor can only make power if it can get rid of its waste heat. If the radiator cannot cool, the reactor gets hot and must cut its power to protect itself.

**Who gets hurt if nobody solves this?**
The crew. Life support, heating and communication all depend on that power. Earth is too far away to fix things quickly.

**Doesn't anyone already clean solar panels and radiators on the Moon?**
Dust-cleaning electrodes exist and have been tested on the Moon. What is missing is a system that connects detection, cleaning and power management, so the plant can protect itself without waiting for help.

## The solution

**What does your product do, in one sentence?**
It watches a Moon reactor, blocks dust, finds dirty radiators by heat, cleans them, and makes sure the crew always gets power first.

**What is a "digital twin"?**
It is a live software copy of a real machine. It behaves like the real plant, so operators can see problems and test responses safely.

**What is the electric mesh net?**
It is an electrically charged wire dome around the reactor. Dust grains carry charge, so the net pushes most of them away before they land.

**What happens when the net breaks?**
That is our fourth scenario. The system switches off the ice drills by itself, so life support, heating and communication keep full power. One button then cleans the radiator and brings the drills back.

**Why do you switch off the ice drills and not something else?**
Ice mining can wait a few days. Air, heat and the link to Earth cannot wait at all.

**How does the cleaning work?**
Thin electrodes on the radiator send a moving electric wave across the surface. The wave pushes the dust off, like a broom made of electricity.

**Why clean only one radiator?**
Because the heat camera tells us exactly which one is dirty. Cleaning only that one saves energy and time.

## The technology

**Is the "AI" a neural network?**
No. It is classic image analysis: the software looks at every pixel of the heat image, finds the hottest connected area and draws a box around it. We chose this because it is predictable and easy to check, which matters for a nuclear system.

**Is the heat camera real?**
In this prototype the heat image is simulated from our physics model. The same analysis code could take a real thermal camera image.

**Is the physics real or just an animation?**
The numbers come from a real simulation that updates 10 times a second. Nothing on the screen is a fixed picture; every value changes with the physics.

**Why does it run in the browser with no server?**
So the demo always works, even without internet. It also shows the software is light enough to run on a small computer at a Moon base.

**How accurate are your numbers?**
They are realistic estimates, tuned to match published targets such as a 40-kilowatt lunar reactor. It is a simplified model, not a certified engineering tool, and we say that openly.

**Why did you make the time run faster?**
Real heating and cooling take minutes to hours. We speed time up so the jury can see the whole story in seconds.

## Product and business

**Who would pay for this?**
Space agencies and companies that will run power plants on the Moon. Each new base or reactor is a new customer site.

**Why is it a SaaS product?**
The same software can watch many sites at once, get updates, and give one control screen to every team. Operators pay to use it, not to build it.

**What would you build next?**
Connect it to real sensor data, add a real thermal camera, and test it with a hardware model of a radiator and a dust-cleaning panel.

## Limits (be honest — the jury rewards it)

**What can't your prototype do yet?**
It uses simulated sensors, a simplified heat model and a scripted dust storm. It has not been tested on real hardware.

**What was the hardest part?**
Making all the parts affect each other correctly. The dust changes the heat, the heat changes the power, and the power changes who gets electricity.

**Did you use AI tools to build it?**
Yes, an AI coding assistant helped write code. We designed the story, chose the numbers and the rules, and we can explain every part of how it works.

## If a judge asks something you do not know

Say: "Good question — our prototype does not model that yet. Here is how we would add it: …" Then give one sentence. Honest limits score better than guesses.
