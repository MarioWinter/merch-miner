# Frontend Development Rules

## MUI v7 First (MANDATORY)
- Before ANY UI component, check if MUI has it. Use @mui/mcp for API lookup.
- NEVER create custom implementations of: Button, TextField, Select, Checkbox, Switch,
  Dialog, Alert, Snackbar, Table, Tabs, Card, Chip, Menu, Popover, Tooltip,
  Drawer, AppBar, Pagination, Rating, Skeleton, Autocomplete, ToggleButton
- For icons: import from @mui/icons-material

## Import Patterns
```tsx
import { Button, Stack, Box, Typography, Grid } from '@mui/material'
import { useColorScheme } from '@mui/material/styles'
import SearchIcon from '@mui/icons-material/Search'
```

## MUI v7 API Rules (Breaking Changes — Enforce These)
- Grid: always import from @mui/material. NEVER use GridLegacy or Grid2
- Grid `item` prop removed — use `size` instead: `<Grid item xs={12}>` becomes `<Grid size={{ xs: 12 }}>`
- slotProps: use `slotProps={{ input: {...} }}` NOT `InputProps` (removed in v7)
- Hidden: NEVER use. Replace with `sx={{ display: { xs: 'none', md: 'block' } }}`
- Dialog close: use `onClose(event, reason)` NOT `onBackdropClick`
- Lab imports: import Alert, Autocomplete, etc. from @mui/material, NOT @mui/lab
- createTheme: NEVER use `createMuiTheme` (removed in v7)
- StyledEngineProvider: import from `@mui/material/styles`, NOT `@mui/material`
- Dark mode: use `useColorScheme()` hook; use `theme.vars.palette.*` in `styled()`

## Styling — sx Prop and Theme
- Use `sx` prop for one-off overrides; never use `style={{ }}` for MUI components
- Use `theme.components.[MuiX]` overrides for global component style changes
- Use `styled()` from `@mui/material/styles` for reusable styled components
- Responsive: use `sx={{ px: { xs: 2, md: 4 } }}` breakpoint objects
- Never use Tailwind CSS or CSS modules; Emotion (MUI's engine) only

## Layout
- Use Stack for flex layouts, Grid for multi-column grids, Box as a generic div
- Responsive breakpoints: xs (mobile >=375px), sm (>=600px), md (>=900px), lg (>=1200px)

## Forms — react-hook-form + Zod
- Define schema in `schemas/` dir: `z.object({...})`
- Use `useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })`
- Use `Controller` for MUI controlled inputs (TextField, Select, Autocomplete)
- Zod schema is single source of truth for validation and TypeScript types

## State — Redux Toolkit
- Global/shared state: Redux slice (`createSlice`) + RTK Query for API caching
- Local UI state: useState / useReducer
- Async actions: `createAsyncThunk` or RTK Query endpoints
- Never put derived data in Redux; compute in selectors (`createSelector`)
- RTK Query: use for all standard CRUD API calls (auto-caching, loading states)
- axios directly: only for file uploads (multipart/form-data) and blob downloads

## Routing — React Router DOM v7
- Use `<BrowserRouter>` in main.tsx; define routes in App.tsx with `<Routes>/<Route>`
- Navigate: `useNavigate()` hook (not `window.location.href`)
- Params: `useParams()`, query strings: `useSearchParams()`

## Auth — django-allauth + axios + Redux
- Store auth state in Redux authSlice (user, token, loading, error)
- On login success: dispatch to Redux, navigate with `useNavigate()`
- Always reset loading state in `finally` block
- Axios interceptor handles 401 -> redirect to login + clear Redux auth state
- Never store JWT in localStorage; use HttpOnly cookies (CookieJWTAuthentication)

## Drag & Drop — dnd-kit
- Use `DndContext` + `useSortable` for sortable lists
- Use `useDroppable` + `useDraggable` for kanban-style boards
- Never use HTML5 drag API or custom mousedown handlers

## File Uploads (Frontend)
- Use MUI FileInput or a drag-zone built with dnd-kit; show upload progress
- Validate file type and size client-side before POSTing (CSV: text/csv, Excel: .xlsx)
- POST multipart/form-data via axios; backend handles actual validation
- CSV download: trigger via anchor tag with blob URL from axios response (`responseType: 'blob'`)

## n8n Workflow UI
- Trigger button -> POST to `/api/n8n/trigger/` -> receive run_id -> poll `/api/n8n/status/<id>/`
- Show workflow status with MUI LinearProgress / Stepper while pending
- Display result in a Card or DataGrid once complete
- Use notistack to notify on completion or failure

## Notifications
- Use notistack: `const { enqueueSnackbar } = useSnackbar()`
- `enqueueSnackbar('Message', { variant: 'success' | 'error' | 'warning' | 'info' })`

## i18n
- All user-visible strings via `useTranslation()`: `const { t } = useTranslation()`
- Never hardcode user-visible text in components

## Component Standards
- All components: TypeScript interfaces for all props (no `any`)
- Implement loading, error, and empty states for every data-fetching component
- Semantic HTML + ARIA labels for accessibility
- Keep components small and focused (Single Responsibility)

## Testing — Vitest + Testing Library
- Test files live in `views/[view]/[section]/tests/` (co-located with the feature)
- Global reusable component tests live in `components/__tests__/`
- **Unit tests:** one per component/hook/util — test in isolation with mocked deps
- **Integration tests:** cover full user flows (e.g. fill form → submit → see success message)
- Use `render`, `screen`, `userEvent` from `@testing-library/react`
- Mock API calls with `vi.mock` or MSW — never hit the real network in tests
- Mock Redux store with `renderWithProviders` helper (create once in `src/utils/test-utils.tsx`)
- Always test: loading state, error state, empty state, and happy path
- Run `npm run test:ci` before marking feature complete; zero failures required
- Coverage target: all new components and hooks must have at least one test