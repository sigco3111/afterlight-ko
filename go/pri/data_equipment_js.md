64 | ).replace(/[^a-z0-9]+/g,
64 | ).replace(/^_/_$/g,
84 | ? p * 1.0 : weight ===
84 | ? p * 0.7 : p * 0.45; const res = weight ===
85 | ? p * 0.35 : weight ===
87 | , armor: weight, tier, price: Math.round(TIER_PRICE[tier] * 0.9), def: Math.round(def + 2), res: Math.round(res + 1), mag: weight ===
88 | ? Math.round(p * 0.2) : 0, mods: weight ===
90 | : weight ===
100 | , armor: weight, tier, price: Math.round(TIER_PRICE[tier] * 0.6), def: Math.round(p * (weight ===
101 | ? 0.5 : weight ===
101 | ? 0.35 : 0.2) + 1), res: Math.round(p * (weight ===
102 | ? 0.5 : 0.25) + 1), mag: weight ===
113 | , armor:
121 | , price: 120, def: 3, desc:
122 | , price: 200, res: 5, desc:
123 | , price: 500, str: 6, desc:
124 | , price: 500, mag: 6, desc:
125 | , price: 900, spd: 5, desc:
128 | , price: 300, immune: [
128 | ], desc:
129 | , price: 400, immune: [
130 | , price: 600, immune: [
132 | , price: 0, immune: [
139 | s Eye
