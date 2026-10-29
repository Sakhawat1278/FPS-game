# ASSETS & LICENSES: Warehouse Strike

All assets in **Warehouse Strike** are 100% original, procedurally synthesized in-engine, or built from scratch using open WebGL / Web Audio primitives. There are zero external copyrighted assets, zero binary texture downloads required, and zero dependencies on proprietary game rips.

---

## 🎨 Procedural Texture Inventory

All high-resolution textures are generated procedurally on HTML5 Canvases at runtime with custom noise filters, expansion seams, dirt overlays, and specular/roughness maps:

| Asset Name | Generator File | Dimensions | Features & Details | License |
|---|---|---|---|---|
| **Concrete Floor** | `TextureGenerator.ts` | 1024 × 1024 | Industrial concrete slab with 5m expansion joints, micro-roughness noise, and specular water puddle masks. | MIT / Original |
| **Corrugated Metal** | `TextureGenerator.ts` | 512 × 512 | Industrial shipping container siding with sinusoidal corrugation ribs, edge grime, and rust speckles. | MIT / Original |
| **Hazard Stripes** | `TextureGenerator.ts` | 512 × 512 | OSHA 45-degree diagonal safety yellow & dark charcoal caution stripes for catwalk ledges and ramps. | MIT / Original |
| **Wood Pallet Plank** | `TextureGenerator.ts` | 512 × 512 | Natural wood grain with horizontal fiber noise and nail markings. | MIT / Original |
| **Safety Orange Metal**| `TextureGenerator.ts` | 256 × 256 | High-visibility powder-coated industrial steel rack texture with subtle edge wear. | MIT / Original |
| **Reticle Overlays** | `WeaponHUD.ts` | Scalable Vector / Canvas | High-precision dual-zoom sniper reticle (mil-dot markings, dual outer ring, and crosshair). | MIT / Original |

---

## 🔊 Procedural Audio & Impulse Responses

The audio engine utilizes the **Web Audio API** with procedural oscillator synthesis, shaped noise buffers, and real-time convolution reverb:

| Sound Effect | Generator File | Technique | Duration | License |
|---|---|---|---|---|
| **M416 Gunshot** | `ProceduralAudio.ts` | Low-frequency exponential transient (180 Hz -> 40 Hz) + bandpass filtered white noise burst + reverb tail. | 350 ms | MIT / Original |
| **Operator Sniper Fire**| `ProceduralAudio.ts` | Heavy sub-bass thump (120 Hz -> 20 Hz) + sharp metallic crack (2.5 kHz) + high-power noise impulse. | 650 ms | MIT / Original |
| **Desert Eagle Fire** | `ProceduralAudio.ts` | Punchy mid-kick (160 Hz -> 35 Hz) with high-resonance punch and snappy report. | 400 ms | MIT / Original |
| **Concrete Footsteps** | `MovementAudio.ts` | Bandpass filtered noise bursts (800 Hz) simulating rubber combat boot on concrete. | 120 ms | MIT / Original |
| **Catwalk Footsteps** | `MovementAudio.ts` | High-Q bandpass noise bursts (2.2 kHz) with metallic ring simulating hollow steel grating. | 160 ms | MIT / Original |
| **Jump / Land Thuds** | `MovementAudio.ts` | Low-frequency body impact thud (75 Hz) + quick surface friction rustle. | 220 ms | MIT / Original |
| **Dry Fire / Reload** | `ProceduralAudio.ts` | Dual-click metal latch transients (1.8 kHz & 3.2 kHz). | 90 ms | MIT / Original |
| **Headshot Ding** | `ProceduralAudio.ts` | High-pitch sine ping (1760 Hz, A6) with 0.4s clean decay. | 400 ms | MIT / Original |
| **Hitmarker Tick** | `ProceduralAudio.ts` | Short wood-block acoustic tick (950 Hz) with 45 ms decay. | 45 ms | MIT / Original |
| **Warehouse Impulse Response** | `AudioEngine.ts` | Synthesized 1.8-second exponential decay noise buffer with early reflections and high-frequency wall absorption for convolution reverb. | 1800 ms | MIT / Original |
| **Countdown / Stingers**| `AudioEngine.ts` | Pure sine tactical alert beeps (880 Hz / 1760 Hz) and victory brass chord synthesis. | 250–1200 ms | MIT / Original |

---

## 🧱 3D Models & Geometry

All 3D meshes are built from optimized Three.js BufferGeometries:

| Mesh Group | Generator File | Description | Triangles | License |
|---|---|---|---|---|
| **Warehouse Architecture** | `RealisticWarehouse.ts` | 70m × 45m industrial structure, 8.5m roof with I-beams, skylights, concrete columns, catwalks with safety railings, and loading docks. | ~48,000 | MIT / Original |
| **Cover Props** | `RealisticWarehouse.ts` | Shipping containers (standard 20ft ISO dimensions), 4-tier orange pallet racks, wooden cargo pallets, metal oil drums, and concrete barriers. | ~32,000 | MIT / Original |
| **Remote Soldiers** | `RemotePlayer.ts` | Alpha (Navy/Cyan) and Bravo (Slate/Safety Orange) combat soldiers with tactical vests, helmets with glowing visors, combat boots, and hip ammo pouches. | ~2,400 per soldier | MIT / Original |
| **First-Person Viewmodels** | `Viewmodel.ts` | Tactical first-person viewmodels for M416, Operator, and Desert Eagle with dynamic sway, walk bobbing, and recoil kick animations. | ~1,800 per weapon | MIT / Original |

---

## 📜 Summary of Compliance
* Zero third-party proprietary assets.
* Zero binary audio or texture files that can trigger DMCA or hosting bandwidth limits.
* All assets generated client-side upon initial load; total initial bundle size is strictly under **6 MB** uncompressed and **1.8 MB** gzip compressed, well below the 15 MB specification budget.
