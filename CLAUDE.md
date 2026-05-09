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
- For UI changes, verify in browser before committing
