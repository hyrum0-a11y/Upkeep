# Upkeep

An Android app for the family's maintenance log: vehicles and household equipment (like the water filter). The data is one JSON file in a **private** GitHub repo ([hyrum0-a11y/Upkeep-data](https://github.com/hyrum0-a11y/Upkeep-data)), so it's versioned, downloadable any time, and Claude can update it when you send changes in chat. This repo (the code) stays public for the in-app update check.

## What it does

- **Home:** four tiles (**Vehicles**, **Equipment**, **Spending**, **Usage**), a bar chart of spending per vehicle/equipment (last 6 vs. 12 months), then everything overdue or due soon. **＋ Add a vehicle or equipment** at the bottom.
- **Vehicles / Equipment:** a card for each, with its own color and icon and the same four boxes: last service, next due, mileage/hours (or total spent for things without a meter), and money spent in the last 6 months. Tap one to open its page.
- **Spending:** per year, the total split into routine (matches a scheduled service) and repairs (anything else), then per vehicle/equipment, then each entry (tap to fix it).
- **Usage:** each vehicle's current mileage (or hours), average per month, and the last 5 readings with how far it went between them.
- **Reminders:** a phone notification a week before and on the day a date-based service comes due (9 AM, approximate). Turn off in Settings.
- **Dark mode** follows the phone's setting.
- **Item page:** a summary (purchase date, anything due within a month, last service, money spent in total and in the last 6 months), **＋ Log service** and **＋ Log repair** (one-off work like engine trouble, with cost), the odometer or hour meter (collapsed; tap **Update** to save a reading for any date and see the last 5 readings, tap one to fix its value or date in place; the summary shows average miles per month over the last 12 months), and a compact list of services, each showing last done and next due. Services never logged are tucked into a collapsed **Never logged** group. Tap a service to expand it: details, what to buy, its last 3 records (tap one to fix it), **Log it as done** (opens Log service with it picked and the mileage filled in) and **Edit schedule** (rename, change how often or the part, or remove). History is grouped by year with each year's total; tap an entry to fix or delete it. **Edit** at the top changes the item's details, including purchase date and VIN.
- **Log service** (from an item page): pick the service, date, reading, cost, shop, notes. Tick **Done while troubleshooting** when it was replaced while chasing a problem rather than because it was due: it still resets the schedule, shows with a * and counts as a repair in spending. The item's reading moves forward if the new one is higher.
- **Set starting points:** for services with no record yet, enter roughly when each was last done (a year is fine), all at once.
- **Updates:** when a new build is out, the home screen shows **Download & install**.

Status is **Overdue**, **Due soon** (within 10% of the mileage interval, or within 30 days / 3 days per month of interval), **OK**, or **No record**. The app works this out from the log; a log entry counts toward a service when the item and service names match exactly.

## The data file

`upkeep.json` in the data repo has four lists: `items`, `schedule` (how often), `log` (what was done) and `readings` (mileage/hours on a date). The data repo's README describes every field. Each change in the app is one commit, so the history shows every edit. If the file changed on GitHub (for example Claude added something) the app reloads it and applies your change on top.

## Connect the app (one time)

1. Make a token: GitHub → your photo → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token** ([direct link](https://github.com/settings/personal-access-tokens/new)).
   - Name: `Upkeep app`. Expiration: whatever you like (a year is fine; you'll paste a new one when it expires).
   - **Repository access → Only select repositories →** `Upkeep-data`.
   - **Permissions → Repository permissions → Contents → Read and write.** Nothing else.
   - Generate, then copy the token (starts with `github_pat_`).
2. In the app: ⚙️ **Settings →** Repo `hyrum0-a11y/Upkeep-data`, paste the token → **Test & save**.

The token lives only on your phone and can only touch that one repo. Never commit it or paste it into chat. If the phone is lost, delete the token on the same GitHub page.

## Build and install from your phone

1. Every merge to `main` runs **Actions → Build Android APK** (about 10–15 minutes). You can also run it by hand.
2. Open **Releases**, download the newest `Upkeep-N.apk`, and open it to install.
3. After that, new builds show up as an update on the app's home screen.

The repo has to stay public for the update check to see new releases. No personal data is in this repo; it's all in the private data repo.

## Development

```bash
npm ci              # installs the exact versions in package-lock.json
npx expo start      # Expo Go for quick testing
npm run typecheck
npm test            # unit tests for the data and due math
```

- Screens: `src/app/` (Expo Router). GitHub storage: `src/lib/api.ts`. Data file, due math and changes: `src/lib/data.ts`. Formatting: `src/lib/format.ts`. Updates: `src/lib/update.ts`.
- Pull requests run the **Checks** workflow (typecheck, tests, bundle) before merging.
- `package-lock.json` is committed and the workflows install with `npm ci`. Add or upgrade packages with `npx expo install <package>` and commit the updated lockfile with the change.
