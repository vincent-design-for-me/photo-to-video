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
- For UI changes, verify in browser before committing