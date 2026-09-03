# Feature Maps

Detailed user-path maps for each major flow in Intentional. Each map follows the same structure:

1. **Sub-features** - What capabilities exist in this flow
2. **How to get to it (user POV)** - Navigation path from app launch
3. **Driving it with Playwright** - Selectors, copy, and code snippets
4. **Gotchas** - Web limitations, iOS-only features, known issues

## Maps

- `onboarding.md` - 3-step pillar setup flow (first run)
- `today.md` - Daily ledger, action tracking, and completion
- `focus.md` - Focus session timer and app blocking controls
- `goals.md` - Goal and action CRUD, reordering, reminders
- `insights.md` - Historical hours, goal breakdown, streaks

## Reading a map

Each map is written from the user's perspective. Routes and copy are extracted from the current `develop` branch source, not outdated design docs.

When a feature cannot be driven on web, the map documents it as `verified-unreachable` with the specific prerequisite (e.g., "custom iOS build", "physical device", "native SQLite persistence").

## Updating maps

Maps drift as the product evolves. When you encounter selector failures or changed copy:
1. Read the current source file
2. Update the map with exact copy
3. Note the drift in commit message
4. Do NOT edit product code to match the map
