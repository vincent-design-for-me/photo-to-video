# Instead of --dangerously-skip-permissions, use /permissions to allow:
npm run test:*
npm run build:*
git commit:*
git push:*
bun run format



## Verification Requirements
- Run `npm test` after code changes
- Run `npm run typecheck` before marking complete
- For API changes, test with `curl` or Postman
- Before discussing, planning, or implementing any UI change, read `DESIGN.md` first and use it as the source of truth for layout, styling, components, and interaction patterns.
- For any CSS/styling work, also follow `docs/STYLING.md`: new components/pages use a co-located `*.module.css` (never extend the global `app/styles.css`), and reference design tokens (`var(--space-*)`, `var(--radius-*)`, color vars) instead of inline hex/px. Run `npm run lint:css` before committing styling changes.
- For UI changes, verify in browser before committing
