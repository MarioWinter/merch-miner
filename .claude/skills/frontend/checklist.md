# Frontend Implementation Checklist

Before marking frontend as complete:

## MUI v7
- [ ] Checked MUI v7 for EVERY UI component needed (use @mui/mcp)
- [ ] No custom duplicates of MUI components created
- [ ] Only `Grid` used (never `GridLegacy` or `Grid2`)
- [ ] `slotProps={{ input: {...} }}` used (never `InputProps`)
- [ ] No imports from `@mui/lab` (Alert, Autocomplete, etc. from `@mui/material`)
- [ ] No `Hidden` component (replaced with `sx={{ display: {...} }}`)
- [ ] No `createMuiTheme` (use `createTheme`)

## Existing Code
- [ ] Checked existing components via `ls frontend-ui/src/components/`
- [ ] Checked existing views via `ls frontend-ui/src/views/`
- [ ] Reused existing components where possible

## Design
- [ ] Design preferences clarified with user (if no mockups)
- [ ] Component architecture from Solution Architect followed

## Implementation
- [ ] All planned components implemented
- [ ] All styling via `sx` prop or `styled()` from `@mui/material/styles` (no Tailwind, no CSS modules, no inline `style={{}}`)
- [ ] Loading states implemented (MUI Skeleton or CircularProgress during data fetches)
- [ ] Error states implemented (user-friendly error messages)
- [ ] Empty states implemented ("No data yet" messages)
- [ ] Forms use react-hook-form + Zod schema; Controller wraps MUI inputs

## State
- [ ] Global state in Redux slice (if needed)
- [ ] Local UI state uses useState/useReducer
- [ ] API calls use axios service or RTK Query endpoint
- [ ] Notifications use notistack `enqueueSnackbar`

## Quality
- [ ] Responsive: Mobile (375px), Tablet (768px), Desktop (1440px) via `sx` breakpoints
- [ ] Accessibility: Semantic HTML, ARIA labels, keyboard navigation
- [ ] TypeScript: No `any`, interfaces for all props
- [ ] ESLint: No warnings (`npm run lint` from `frontend-ui/`)
- [ ] i18n: all user-visible strings via `useTranslation()` (no hardcoded text)

## Verification (run before marking complete)
- [ ] `npm run build` passes without errors (from `frontend-ui/`)
- [ ] All acceptance criteria from feature spec addressed in UI
- [ ] `features/INDEX.md` status updated to "In Progress"

## Completion
- [ ] User has reviewed and approved the UI in browser (localhost:5173)
- [ ] Code committed to git
