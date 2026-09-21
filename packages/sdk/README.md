# @cmp/sdk

Client-side CMP SDK with consent banner.

## Build

```bash
pnpm --filter @cmp/sdk build
```

Output: `dist/sdk.js` (served by API at `/api/v1/public/cmp/sdk.js`)

## Usage

```html
<script
  src="http://localhost:4000/api/v1/public/cmp/sdk.js"
  data-domain-key="dk_your_domain_key"
  data-env="production"
  async
></script>
```

## Behavior

1. Loads domain configuration from `/public/cmp/config/:domainKey`
2. Renders consent banner based on published policy (layout, content, behavior)
3. Persists visitor consent in `localStorage`
4. Reports installation heartbeat to `/public/cmp/heartbeat`
5. Exposes `window.__CMP__` global and dispatches `cmp:ready` / `cmp:consent-update`

## Banner actions

- **Accept all** — enables all optional categories
- **Reject all** — disables optional categories (strictly necessary stays on)
- **Customize** — opens preference center with per-category toggles
- **Save preferences** — saves custom selection

## Accessibility

- Semantic HTML and ARIA for dialogs/regions
- Keyboard navigation with visible focus
- Focus trap on modal layouts
- Escape returns from preferences or closes when allowed

## Tests

```bash
pnpm --filter @cmp/sdk test
```
