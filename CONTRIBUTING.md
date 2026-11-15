# Contributing

Thanks for considering a contribution to SPTMS!

## Development setup

1. Install Node.js 22.12.0 or newer.
2. Fork and clone the repository.
3. Run `npm install`.
4. Run `npm run dev` and open `http://localhost:3000`.

## Before opening a pull request

- Keep domain/business rules in `src/shared/parkingLogic.ts` rather than duplicating them in UI components or HTTP handlers.
- Add or update tests for changes to booking, bay state, validation or analytics logic.
- Keep API response behavior consistent and handle invalid input explicitly.
- Run `npm test`, `npm run typecheck` and `npm run build`.
- Describe the user-visible change, implementation approach and any known limitations.
- Do not commit `.env` files, credentials, generated build output, private data or unrelated AI Studio workspace artifacts.

## Pull request scope

Prefer focused pull requests. For UI changes, include before/after screenshots where practical. For API changes, document the route, request body, response and error behavior.

## Reporting bugs

Use the bug report issue template and include browser/OS, Node version, steps to reproduce, expected behavior and actual behavior. Remove personal or vehicle-identifying data from logs and screenshots.

## Code of conduct

Be respectful, constructive and welcoming. Critique code and ideas, not people.
