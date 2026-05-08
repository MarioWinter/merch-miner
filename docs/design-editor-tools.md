# PROJ-9 Design Editor — Pipeline Tools (15 Tools) + Export Compression

> Reference catalog of all post-processing tools available in the Design Editor. Authoritative source for tool behavior, parameters, and the typical POD pipeline order.

## Standard (9 tools)
| Tool | Purpose |
|------|---------|
| **Resize & Reposition** | Scale to target (e.g. 4500×5400 MBA). Align within canvas, padding, aspect ratio, background fill |
| **Trim** | Auto-crop transparent/empty borders. Modes: Transparent (alpha) or Auto-Detect (dominant edge color). Threshold + padding |
| **Rotate** | 0°/90°/180°/270° rotation + horizontal/vertical flip |
| **Filters** | Brightness, contrast, saturation, hue shift sliders |
| **Distress** | Vintage look — grain, scratches, edge wear effects |
| **Color Removal** | Remove color → transparent. Auto-detect BG color (8 edge samples). Contiguous mode (flood-fill from edges). Edge Trim (dilate, 0-10px) + Edge Feather (blur, 0-10px) |
| **Speckle Remover** | Remove isolated pixel groups below minSize threshold (connected component labeling) |
| **Transp. Cleaner** | Clean semi-transparent pixels. DELETE mode = force alpha→0 below threshold. VIEW mode = highlight with color overlay (merged Transparency Highlighter) |
| **Watermark** | Text overlay with position, rotation, size, opacity, tiling |

## Edge Cleanup (4 tools)
| Tool | Purpose |
|------|---------|
| **Defringe** | Remove color halos at design edges after BG removal. Auto-detect + manual shrink |
| **Shrink** | Morphological erosion — eat N pixels from visible design edges |
| **Color Defringe** | Replace BG-colored edge pixels with nearest design color (subtler than Shrink) |
| **Edge Cleaner** | Multi-pass anti-aliasing on design edges — smooth jagged/pixelated outlines |

## AI Processing (2 tools — server-side)
| Tool | Purpose |
|------|---------|
| **BG Remove** | rembg (u2net) server-side background removal. Better than Color Removal for complex backgrounds |
| **AI Upscale** | Replicate-based AI upscale to 4500×5400 print-ready PNG. Single + Bulk modes; webhook-driven async; quota-gated (100/month for non-staff, unlimited for staff). See [PROJ-27 spec](../features/PROJ-27-ai-upscaler.md) and [PROJ-27 runbook](./PROJ-27-runbook.md) for operations |

## Export Compression (at download time — NOT a pipeline tool)
| Control | Detail |
|---------|--------|
| **Compression Dropdown** | Off / Low / Medium / High / Very High — UPNG.js PNG quantization (32bit→8bit) in browser |
| **"Preparing Download" Modal** | Spinner + compression badge + progress bar + cancel button (shown during compression/ZIP) |

## Typical POD Pipeline Order
Color Removal → Speckle Remover → Transp. Cleaner → Defringe/Shrink → Trim → Resize & Reposition → **Download with Compression**
