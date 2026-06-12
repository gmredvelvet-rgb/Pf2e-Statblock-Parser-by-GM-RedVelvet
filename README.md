# Starfinder Statblock Parser

A simple FoundryVTT module that allows GMs to parse the statblocks of Starfinder NPCs so they can quickly create NPCs.

## Use

To use simply go to the actors tab in FoundryVTT, and click the Parse Statblock button at the bottom. Paste in the statblock text, and click ok.

The main focus of this module is to support Paizo-style statblocks, this means you must include the category headers like defense, offense, statistics, etc. However, to some extent, HeroLab statblocks are also supported, as they are very similar to Paizo-style. Finally, there is a basic implementation for PCGen XML and VTTES JSON exported characters.

An example Paizo-style statblock:
~~~
Simple Mook CR 1/2
LE Medium humanoid (human)
Init +4; Perception +10
DEFENSE HP 13
EAC 10; KAC 12
Fort +2; Ref +4; Will +0
OFFENSE
Speed 30 ft.
Melee club +3 (1d6+2 B)
Ranged azimuth laser pistol +6 (1d4+1 F; critical burn 1d4)
STATISTICS
Str +2; Dex +3; Con +1; Int –1; Wis +0; Cha –1
Skills Athletics +4, Bluff +5, Intimidate +9, Stealth +5
Languages Common
Gear flight suit stationwear, azimuth laser pistol with
battery (20 charges), club, credstick (150 credits)
~~~

## Issues

If you have any issues or concerns, please don't hesitate to open an issue on the tracker https://gitlab.com/TimToxopeus/sfrpg-statblock-parser/-/issues or reach out to me on the Foundry discord server: Deepflame#0875.
