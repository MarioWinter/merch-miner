# Merch Miner — Design System v1.1
> Single source of truth for all 16 features. PROJ-16 is background-only (no sidebar route). Do not deviate without explicit approval.
> Last updated: 2026-02-28 | Changes: FIX 1–6 applied (error color, mono font stack, sidebar collapse, mode toggle, nav, easing)

---

## 1. Design Philosophy

**Concept: "Liquid Intelligence"**
A high-density SaaS OS that feels like mission control for POD sellers. The aesthetic sits at the intersection of Linear's surgical minimalism and Bloomberg Terminal's data density — but humanized with warmth. Every surface breathes data; every interaction is purposeful.

**Principles:**
- **Signal over noise** — only show what the user needs right now
- **Trust through density** — a full screen of well-organized data signals power
- **Liquid depth** — glassmorphism layers create hierarchy without hard borders
- **Red thread** — the coral accent (`#FF5A4F`) guides CTAs, active states, and focus rings — never used for errors (see FIX 1)

---

## 2. Color System

### 2.1 Dark Mode (Default / Primary Mode)

```
BACKGROUND
  default         #071E26   Page canvas (deep ocean)
  paper           #0B2731   Cards, panels, sidebars
  elevated        #0F3040   Hover surfaces, dropdowns
  sunken          #051820   Input fills, code blocks

SURFACE OVERLAYS (glassmorphism)
  glass-sm        rgba(11,39,49, 0.60) + blur(8px)
  glass-md        rgba(11,39,49, 0.75) + blur(16px)
  glass-lg        rgba(7,30,38,  0.85) + blur(24px)

PRIMARY (brand coral)
  main            #FF5A4F
  dark            #E84B42
  light           #FF7A72
  subtle          rgba(255,90,79, 0.12)
  glow            0 0 24px rgba(255,90,79, 0.30)

SECONDARY (data cyan)
  main            #00C8D7
  dark            #00A8B5
  light           #33D5E2
  subtle          rgba(0,200,215, 0.10)

TEXT
  primary         #E8F4F8   Main readable text
  secondary       #7BAAB8   Labels, captions, metadata
  disabled        #3D6A7A   Placeholder, inactive
  hint            #4F8090   Helper text

BORDERS
  subtle          rgba(255,255,255, 0.06)
  default         rgba(255,255,255, 0.10)
  strong          rgba(255,255,255, 0.18)
  focus           #FF5A4F

STATUS COLORS
  success.main    #22D3A3   (mint) BSR up, job done
  success.dark    #18B08A
  success.subtle  rgba(34,211,163, 0.12)

  warning.main    #F59E0B   (amber) pending, caution
  warning.dark    #D97706
  warning.subtle  rgba(245,158,11, 0.12)

  error.main      #F43F3A   (destructive actions + validation errors ONLY — distinct from primary)
  error.dark      #D93530
  error.subtle    rgba(244,63,58, 0.12)

  info.main       #38BDF8   (sky) informational
  info.subtle     rgba(56,189,248, 0.10)

  neutral.main    #7BAAB8   (secondary text color)

DATA VISUALIZATION PALETTE
  chart[0]        #FF5A4F   primary coral
  chart[1]        #00C8D7   data cyan
  chart[2]        #22D3A3   mint
  chart[3]        #F59E0B   amber
  chart[4]        #818CF8   indigo
  chart[5]        #FB7185   rose
  chart[6]        #34D399   emerald
  chart[7]        #60A5FA   blue
```

### 2.2 Light Mode

```
BACKGROUND
  default         #F0F6F8   Page canvas (soft arctic)
  paper           #FFFFFF   Cards, panels
  elevated        #F7FBFC   Hover surfaces
  sunken          #E8F0F3   Input fills

SURFACE OVERLAYS
  glass-sm        rgba(255,255,255, 0.70) + blur(8px)
  glass-md        rgba(255,255,255, 0.85) + blur(16px)

PRIMARY
  main            #FF5A4F   (same — brand is fixed)
  dark            #E84B42
  light           #FF7A72
  subtle          rgba(255,90,79, 0.08)

SECONDARY
  main            #0097A7
  dark            #00838F
  light           #00BCD4
  subtle          rgba(0,151,167, 0.08)

TEXT
  primary         #071E26   Mirror of dark background
  secondary       #3D6A7A
  disabled        #8AADB8
  hint            #5A8A9A

BORDERS
  subtle          rgba(7,30,38, 0.06)
  default         rgba(7,30,38, 0.12)
  strong          rgba(7,30,38, 0.22)
  focus           #FF5A4F

STATUS (same hues, lighter backgrounds)
  success.main    #059669
  warning.main    #D97706
  error.main      #DC2626
  info.main       #0284C7
```

---

## 3. Typography

**Font:** `Inter` — load via `@fontsource/inter` (self-hosted, weights 400/500/600/700)

| Token | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| `h1` | 2.25rem (36px) | 700 | 1.15 | -0.02em | Page titles |
| `h2` | 1.75rem (28px) | 700 | 1.20 | -0.015em | Section headers |
| `h3` | 1.375rem (22px) | 600 | 1.25 | -0.01em | Card titles |
| `h4` | 1.125rem (18px) | 600 | 1.30 | -0.005em | Subsection titles |
| `h5` | 1rem (16px) | 600 | 1.35 | 0 | Labels, sidebar items |
| `h6` | 0.875rem (14px) | 600 | 1.40 | 0 | Table headers, captions |
| `body1` | 0.9375rem (15px) | 400 | 1.60 | 0 | Main body text |
| `body2` | 0.8125rem (13px) | 400 | 1.55 | 0 | Secondary body, metadata |
| `subtitle1` | 0.9375rem (15px) | 500 | 1.50 | 0 | Emphasized body |
| `subtitle2` | 0.8125rem (13px) | 500 | 1.45 | 0.01em | Form labels |
| `caption` | 0.75rem (12px) | 400 | 1.50 | 0.02em | Timestamps, hints |
| `overline` | 0.6875rem (11px) | 600 | 1.40 | 0.08em | Section labels, badges |
| `button` | 0.875rem (14px) | 600 | 1 | 0.01em | Buttons (NO uppercase) |
| `mono` | 0.8125rem (13px) | 400 | 1.55 | 0 | ASIN codes, tokens |

**Mono font fallback stack** — for ASIN codes, API keys, numeric data:
```
font-family: 'JetBrains Mono', 'IBM Plex Mono', 'Fira Code',
             ui-monospace, 'Cascadia Code', 'Courier New', monospace;
```
Load: `@fontsource/jetbrains-mono` (weight 400). Use `font-display: swap` to prevent FOUT on ASIN columns.

---

## 4. Spacing System

MUI default spacing unit: **4px**

| Token | Value | Usage |
|-------|-------|-------|
| `0.5` | 2px | Icon gaps, border widths |
| `1` | 4px | Tight inline spacing |
| `1.5` | 6px | Badge padding |
| `2` | 8px | Small padding |
| `2.5` | 10px | Chip padding |
| `3` | 12px | Input padding, card gap |
| `4` | 16px | Standard component padding |
| `5` | 20px | List item padding |
| `6` | 24px | Card padding (default) |
| `8` | 32px | Section padding |
| `10` | 40px | Large section gap |
| `12` | 48px | Page-level vertical rhythm |
| `16` | 64px | Hero spacing |

---

## 5. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Badges, tags |
| `sm` | 6px | Chips, small buttons |
| `md` | 8px | Inputs, standard buttons |
| `lg` | 12px | Cards, panels |
| `xl` | 16px | Large cards, modals |
| `2xl` | 24px | Full-width feature cards |
| `full` | 9999px | Pills, avatar indicators |

**MUI theme override:** `shape.borderRadius = 8` (md is default)

---

## 6. Elevation & Shadow System

Dark mode uses **inner glow + border** instead of drop shadows:

```
elevation.0    none (flat, background-level)
elevation.1    border: 1px solid rgba(255,255,255,0.06)
elevation.2    border: 1px solid rgba(255,255,255,0.10)
               box-shadow: 0 4px 16px rgba(0,0,0,0.30)
elevation.3    border: 1px solid rgba(255,255,255,0.14)
               box-shadow: 0 8px 32px rgba(0,0,0,0.40)
elevation.4    border: 1px solid rgba(255,90,79,0.20)   (accent glow)
               box-shadow: 0 0 0 1px rgba(255,90,79,0.15),
                           0 8px 32px rgba(0,0,0,0.50)
focus-ring     0 0 0 2px rgba(255,90,79,0.50)
```

Light mode uses standard drop shadows:
```
elevation.1    box-shadow: 0 1px 3px rgba(7,30,38,0.08)
elevation.2    box-shadow: 0 4px 12px rgba(7,30,38,0.10)
elevation.3    box-shadow: 0 8px 24px rgba(7,30,38,0.12)
```

---

## 7. App Shell Layout

### 7.1 Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  TOPBAR  h=56px  bg=glass-md  border-bottom=subtle          │
│  [Logo]  [Workspace selector ▾]        [User avatar]  [⚙]  │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│   SIDEBAR    │           MAIN CONTENT AREA                 │
│   w=220px    │           flex: 1                           │
│   (collapsed │           overflow-y: auto                  │
│    w=60px)   │           padding: 24px                     │
│              │                                              │
│  ──────────  │  ┌─ PAGE HEADER ──────────────────────────┐ │
│  Nav items   │  │  h1 title   [action buttons]           │ │
│  w/ icons    │  └────────────────────────────────────────┘ │
│              │                                              │
│  ──────────  │  ┌─ CONTENT ───────────────────────────────┐│
│  Section     │  │                                         ││
│  labels      │  │   Feature-specific content              ││
│              │  │                                         ││
│  ──────────  │  └─────────────────────────────────────────┘│
│  [User]      │                                              │
│  [Settings]  │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### 7.2 Topbar Specs

```
height:          56px
background:      glass-md (rgba(11,39,49,0.75) + blur(16px))
border-bottom:   1px solid rgba(255,255,255,0.08)
position:        fixed, top: 0, z-index: 1200
padding:         0 24px

Left:   Logo (24px icon + "Merch Miner" wordmark, h5 weight 700)
Center: Workspace selector (outlined chip-style dropdown, max-w: 200px)
Right:  [Color mode toggle] [Notification bell] [User avatar 32px] [Settings icon]

COLOR MODE TOGGLE:
  Icon:      DarkMode (when light) / LightMode (when dark) / SettingsBrightness (when system)
  Size:      20px icon, 32px IconButton
  Default:   'system' — respects prefers-color-scheme
  Cycle:     system → light → dark → system
  Persist:   localStorage key = 'mm-color-mode'  values: 'light' | 'dark' | 'system'
  Flash fix: Inline <script> in <head> reads localStorage before React hydration,
             sets data-color-scheme on <html> element to prevent mode flash on reload
  MUI API:   extendTheme() + CssVarsProvider (from @mui/material/styles)
             Use useColorScheme() hook in toggle component to read/set mode
```

### 7.3 Sidebar Specs

```
width:             220px (expanded) / 60px (collapsed)
top:               56px (below topbar)
background:        background.paper (#0B2731 dark / #FFFFFF light)
border-right:      1px solid rgba(255,255,255,0.08)
padding:           12px 0
transition:        width 200ms ease

Nav item height:   40px
Nav item padding:  0 16px
Nav item radius:   8px
Nav item margin:   2px 8px
Active state:      bg=primary.subtle, color=primary.main,
                   left-border: 2px solid primary.main (visible in both expanded + collapsed)
Hover state:       bg=rgba(255,255,255,0.04)
Icon size:         20px
Label:             body2, weight 500

COLLAPSED STATE (width=60px):
  Labels:          hidden (opacity:0, width:0, overflow:hidden)
  Section labels:  hidden entirely (display:none — not truncated)
  Each nav item:   MUI Tooltip title={label} placement="right"
  Tooltip style:   bg=background.elevated, body2, no arrow
  Toggle button:   position absolute, bottom:12px, left:14px
                   icon: ChevronLeft (expanded) / ChevronRight (collapsed)
                   size: 32px, border-radius: 9999px

Sections (PROJ-1 through PROJ-15; PROJ-16 is background-only, no sidebar entry):
  [Control Room]
    ─ Dashboard        /dashboard          (Dashboard icon)
    ─ Reports          /reports            (BarChart icon)
  [Pipeline]
    ─ Niche Claims     /niches             (ListAlt icon)
    ─ Product Drilling /research           (Search icon)
    ─ Slogan Refinery  /slogans            (Lightbulb icon)
    ─ Design Forge     /designs            (Brush icon)
    ─ Listing Loadout  /listings           (Article icon)
  [Drilling Zone]
    ─ Amazon Deep Dive /amazon/research    (QueryStats icon)
    ─ Keyword Lode     /amazon/keywords    (Key icon)
  [Surface Ops]
    ─ Upload Rig       /uploads            (CloudUpload icon)
    ─ Team Kanban      /kanban             (ViewKanban icon)
```

### 7.4 Main Content Area

```
margin-left:    220px (sidebar) / 60px (collapsed)
margin-top:     56px (topbar)
padding:        24px
min-height:     calc(100vh - 56px)
background:     background.default
```

---

## 8. Component Patterns

### 8.1 Cards

**Standard Card**
```
background:     background.paper
border:         1px solid rgba(255,255,255,0.08)  [dark]
                1px solid rgba(7,30,38,0.08)      [light]
border-radius:  12px
padding:        20px 24px
```

**Glass Card** (used for feature panels, overlays)
```
background:     rgba(11,39,49,0.60)
backdrop-filter: blur(16px)
border:         1px solid rgba(255,255,255,0.10)
border-radius:  12px
padding:        20px 24px
```

**KPI Card** (used in Dashboard, Niche List, Research)
```
Layout:
  ┌────────────────────────────┐
  │ LABEL          [icon]      │
  │                            │
  │ BIG NUMBER                 │
  │ ▲ +12.4%   vs last month  │
  └────────────────────────────┘

label:     overline (11px, 600, letter-spacing 0.08em, text.secondary)
value:     h2 or h3 (bold, text.primary)
trend:     caption with colored arrow icon
           green = success.main, red = error.main
icon:      20px, in top-right, color = primary.subtle bg + primary.main icon
padding:   20px
min-width: 160px
```

**Niche Card** (PROJ-5, PROJ-6 — the core list item)
```
Layout: horizontal, full-width row card
  ┌──────────────────────────────────────────────────────────┐
  │ [status badge]  Niche Title (h5)           [BSR badge]  │
  │ Category · Sub · [tags]              [stage chip]  [⋮]  │
  └──────────────────────────────────────────────────────────┘

hover: elevation.2, slight translateY(-1px)
cursor: pointer → opens detail drawer
```

### 8.2 Buttons

**Primary Button**
```
background:    primary.main (#FF5A4F)
color:         #FFFFFF
border-radius: 8px
padding:       8px 20px
height:        36px
font:          button (14px, 600, no uppercase)
hover:         background = primary.dark (#E84B42), slight glow
active:        scale(0.98)
```

**Secondary Button** (outlined)
```
border:        1px solid rgba(255,255,255,0.16)  [dark]
               1px solid rgba(7,30,38,0.20)      [light]
color:         text.primary
background:    transparent
hover:         background = rgba(255,255,255,0.04)
```

**Ghost Button** (text-only actions)
```
color:         text.secondary
hover:         color = text.primary, bg = rgba(255,255,255,0.04)
```

**Icon Button**
```
size:          32px × 32px
border-radius: 8px
color:         text.secondary
hover:         bg = rgba(255,255,255,0.08), color = text.primary
```

**Destructive Button** (delete, remove — NEVER use primary.main here)
```
color:         error.main (#F43F3A dark / #DC2626 light)
border:        1px solid rgba(244,63,58,0.30)
hover:         bg = error.subtle
icon:          Always pair with DeleteOutline or similar trash icon (color alone is not enough)
```

**AI Action Button** (trigger n8n workflows)
```
background:    linear-gradient(135deg, #FF5A4F 0%, #E84B42 100%)
               + subtle shimmer animation on hover
border-radius: 8px
icon:          AutoAwesome or Bolt (18px)
label:         "Run AI Analysis" / "Generate Slogans" / etc.
```

### 8.3 Forms & Inputs

```
MUI TextField variant: "outlined"
background:    background.sunken (#051820 dark / #E8F0F3 light)
border:        1px solid rgba(255,255,255,0.12) → focus: primary.main
border-radius: 8px
height:        40px (default), 36px (dense)
label:         floating, subtitle2 (13px, 500)
helper text:   caption (12px), text.secondary
error state:   border = error.main, helper = error.main

Select dropdown:
  background:  background.elevated
  option hover: rgba(255,90,79,0.08)
  selected:    primary.subtle bg, primary.main text
```

### 8.4 Tables

**Dense Data Table** (Niche List, Research results, Listings)
```
MUI DataGrid or custom Table component

Row height:    44px (compact) / 52px (default)
Header:        background.elevated, overline text, sortable
Row hover:     rgba(255,255,255,0.03)
Row selected:  primary.subtle bg
Border:        horizontal lines only (1px solid rgba(255,255,255,0.06))
Pagination:    bottom, compact, text.secondary

Columns for Niche List:
  Niche Name | Category | BSR | Competition | Stage | Updated | Actions
```

### 8.5 Status Badges & Chips

```
Stage Pipeline Chips (Niche → Design → Listing):
  "Researching"  bg=info.subtle,    color=info.main,    icon=Search
  "Ideating"     bg=warning.subtle, color=warning.main, icon=Lightbulb
  "Designing"    bg=secondary subtle, color=secondary.main, icon=Brush
  "Listing"      bg=success.subtle, color=success.main, icon=CheckCircle
  "Published"    bg=primary.subtle, color=primary.main, icon=Rocket
  "Paused"       bg=neutral subtle, color=neutral, icon=Pause

BSR Badge (numeric, color-coded by rank):
  BSR < 10k:    success.main (hot)
  BSR 10k-50k:  warning.main (warm)
  BSR > 50k:    text.secondary (cool)

Job Status Badge:
  "Pending"     neutral
  "Running"     info.main + pulse animation
  "Done"        success.main
  "Failed"      error.main
```

### 8.6 Workflow Progress (n8n Jobs)

```
Linear progress bar: MUI LinearProgress, color = secondary.main
Stepper: horizontal, compact
  Step states: pending (neutral) / active (primary + pulse) / done (success)

Example (PROJ-6 Research):
  ① Scraping → ② AI Analysis → ③ Saving Results
```

### 8.7 Empty States

```
Icon:    64px, text.disabled
Title:   h5, text.secondary
Body:    body2, text.disabled
CTA:     Primary button (if actionable)
Layout:  Centered in content area, py: 8 (64px top/bottom)
```

### 8.8 Drawers (Detail Panels)

```
width:         480px (right-side)
background:    background.paper
border-left:   1px solid rgba(255,255,255,0.08)
padding:       24px
header:        h4 title + close IconButton
body:          scrollable, py: 3 between sections
```

---

## 9. Auth Page Layout

```
Full-screen centered layout (no sidebar, no topbar)
background: background.default

Card:
  width:         440px
  background:    glass-md (rgba(11,39,49,0.75) + blur(16px))  [dark]
                 #FFFFFF  [light]
  border:        1px solid rgba(255,255,255,0.10)
  border-radius: 16px
  padding:       40px

Above card:
  Logo + "Merch Miner" wordmark
  mb: 32px

Background effect (dark):
  Radial gradient blob: rgba(255,90,79,0.08) top-right
  Radial gradient blob: rgba(0,200,215,0.06) bottom-left
  Both blurred (blur: 80px), behind the card

Pages using this layout:
  /login              LoginPage
  /register           RegisterPage
  /activate           ActivatePage
  /password-reset     PasswordResetPage
  /password-reset/confirm  PasswordConfirmPage
```

---

## 10. Feature-Specific Patterns

| Feature | Layout | Key Components |
|---------|--------|----------------|
| PROJ-1 Auth | Full-screen centered | Glass auth card, Google OAuth button |
| PROJ-4 Workspace | Settings-style | Member table, invite chip input |
| PROJ-5 Niche List | Table + right drawer | Niche row cards, stage chips, filter toolbar |
| PROJ-6 Research | Niche detail + job progress | Progress stepper, research result cards |
| PROJ-7 Amazon Research | Search bar + results table | BSR badges, dense data table, KPI row |
| PROJ-8 Slogans | Split: niches left / slogans right | Slogan cards with approve/reject actions |
| PROJ-9 Design Gen | Grid of design previews | Design cards, regenerate button, approve flow |
| PROJ-10 Keyword Bank | Searchable tag cloud | Keyword chips, filter sidebar, copy batch |
| PROJ-11 Listings | Form + preview panel | Multi-field form, keyword tag input, copy button |
| PROJ-12 Dashboard | KPI grid + activity feed | KPI cards (2×3 grid), recent activity list |
| PROJ-13 Upload Manager | Queue table + status | Job status badges, CSV upload zone |
| PROJ-14 Team Kanban | Full-width drag board | Stage columns, draggable niche cards |
| PROJ-15 Analytics | Chart-heavy dashboard | Line chart, bar chart, KPI grid |
| PROJ-16 Scraper | Background only — no sidebar route. Future: admin job log | Log table, run button, status feed |

---

## 11. MUI Theme Config Summary

```ts
// Canonical token values for MUI extendTheme() + CssVarsProvider
// import { extendTheme, CssVarsProvider } from '@mui/material/styles'
// Inside styled() use theme.vars.palette.* (not theme.palette.*)

shape.borderRadius = 8

typography.fontFamily = '"Inter", sans-serif'
typography.button.textTransform = 'none'
typography.button.fontWeight = 600

// Dark palette (colorSchemes.dark):
palette.background.default  = '#071E26'
palette.background.paper    = '#0B2731'
palette.primary.main        = '#FF5A4F'
palette.primary.dark        = '#E84B42'
palette.primary.light       = '#FF7A72'
palette.secondary.main      = '#00C8D7'
palette.secondary.dark      = '#00A8B5'
palette.success.main        = '#22D3A3'
palette.warning.main        = '#F59E0B'
palette.error.main          = '#F43F3A'   // FIX 1 — distinct from primary.main
palette.info.main           = '#38BDF8'
palette.text.primary        = '#E8F4F8'
palette.text.secondary      = '#7BAAB8'
palette.divider             = 'rgba(255,255,255,0.08)'

// Light palette (colorSchemes.light):
palette.background.default  = '#F0F6F8'
palette.background.paper    = '#FFFFFF'
palette.primary.main        = '#FF5A4F'
palette.primary.dark        = '#E84B42'
palette.secondary.main      = '#0097A7'
palette.success.main        = '#059669'
palette.warning.main        = '#D97706'
palette.error.main          = '#DC2626'
palette.info.main           = '#0284C7'
palette.text.primary        = '#071E26'
palette.text.secondary      = '#3D6A7A'
palette.divider             = 'rgba(7,30,38,0.08)'

// Component overrides:
MuiButton:         no uppercase, border-radius 8px
MuiCard:           border-radius 12px, border on dark
MuiTextField:      outlined variant, border-radius 8px
MuiChip:           border-radius 6px
MuiTableCell:      dense padding, subtle borders
MuiDrawer:         border-radius 0
MuiDialog:         border-radius 16px
MuiTooltip:        bg=background.elevated, body2
```

---

## 12. Animation Standards

```
Transition speed:
  fast:    150ms ease     (hover states, color changes)
  default: 200ms ease     (size changes, layout shifts)
  slow:    300ms ease     (drawers, modals, page transitions)

Easing:
  enter    cubic-bezier(0.0, 0.0, 0.2, 1)   element arrives, decelerates to stop
  exit     cubic-bezier(0.4, 0.0, 1, 1)     element leaves, accelerates away
  standard cubic-bezier(0.4, 0.0, 0.2, 1)   repositioning — both phases

  TypeScript export (style/constants.ts):
    export const EASING = {
      enter:    'cubic-bezier(0.0, 0.0, 0.2, 1)',
      exit:     'cubic-bezier(0.4, 0.0, 1, 1)',
      standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    } as const;

    export const DURATION = { fast: 150, default: 200, slow: 300 } as const;

Patterns:
  hover lift:      translateY(-1px), 150ms
  card enter:      fadeIn + translateY(8px→0), 200ms
  pulse (running): opacity 0.6↔1.0, 1.2s infinite
  shimmer (AI btn): bg-position shift, 2s infinite
  focus ring:      0→2px ring, 150ms ease
```

---

## 13. Accessibility Standards

```
Contrast ratio:  4.5:1 minimum for body text (AA)
                 3:1 minimum for large text and UI components
Focus visible:   Always visible — 2px coral ring on all interactive elements
Color meaning:   Never convey info by color alone — always pair with icon or label
Motion:          Respect prefers-reduced-motion (wrap animations in media query)
Touch targets:   Minimum 44×44px for all interactive elements
```

---

## 14. Do Not Deviate Rules

The following require **explicit user approval** before changing:
1. Dark mode background tokens: `background.default` (#071E26), `background.paper` (#0B2731)
2. Brand colors: `primary.main` (#FF5A4F), `primary.dark` (#E84B42)
3. Error color: `error.main` (#F43F3A dark / #DC2626 light) — must NEVER equal primary.main
4. Font family (Inter for UI, JetBrains Mono fallback stack for mono)
5. App shell layout dimensions: sidebar 220px/60px, topbar 56px
6. Pipeline stage chip colors (business process semantics)
7. Color mode persistence key: `localStorage['mm-color-mode']`
8. This file — any design decision change must be reflected here first
