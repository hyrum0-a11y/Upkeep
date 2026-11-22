# Upkeep

An Android app for the family's maintenance log: vehicles and household equipment (like the water filter). The data is one JSON file in a **private** GitHub repo ([hyrum0-a11y/Upkeep-data](https://github.com/hyrum0-a11y/Upkeep-data)), so it's versioned, downloadable any time, and Claude can update it when you send changes in chat. This repo (the code) stays public for the in-app update check.

## What it does

- **Home:** four tiles (**Vehicles**, **Equipment**, **Spending**, **Usage**), a monthly spending chart for the last 9 months (bars stacked by vehicle/equipment color), then everything overdue or due soon. **＋ Add a vehicle or equipment** at the bottom.
- **Vehicles / Equipment:** a compact card for each, labeled by its description (year, make, model; or its name if those are blank), with its own color and icon and the same four boxes in a row: last service, next due, miles/hours (or total spent for things without a meter), and money spent in the last 6 months. Dates show as yyyy-mm-dd. Tap one to open its page.
- **Spending:** per year, the total split into **services** (regular upkeep), **repairs** (fixing a problem) and **fees** (registration, insurance, property tax, inspection, title), then per vehicle/equipment, then each entry (tap to fix it). Costs include sales tax. Entries logged before types existed are worked out: fee-sounding names are fees, troubleshooting entries are repairs, scheduled services are services, anything else is a repair.
- **Usage:** each vehicle's current mileage (or hours), average per month, and the last 5 readings with how far it went between them.
- **Reminders:** a phone notification a week before and on the day a date-based service comes due (9 AM, approximate). Turn off in Settings.
- **Dark mode** follows the phone's setting.
- **Item page (vehicles and anything with a meter):** a **Mileage & spending** chart under the summary: mileage over time (starts at the first reading; 3y / 5y appear once there is that much history; y axis in thousands) with a circle for each paid entry, sized by cost (area ∝ cost) and colored by type (red = done while troubleshooting). Tap a circle for the date, service and cost, then Open to edit it.
- **Item page:** a summary (purchase date, anything due within a month, last service, money spent in total and in the last 6 months), one **＋ Log** button for services, repairs and fees, the odometer or hour meter (collapsed; tap **Update** to save a reading for any date and see the last 5 readings, tap one to fix its value or date in place; mileages recorded on service entries show there too, marked 🔧 with the service name, and fixing one updates that entry; the summary shows average miles per month over the last 12 months), and a compact list of services, each showing last done and next due. Services never logged are tucked into a collapsed **Never logged** group. Tap a service to expand it: details, what to buy, its last 3 records (tap one to fix it), **Log it as done** (opens Log with it picked and the mileage filled in) and **Edit schedule** (rename, change how often or the part, or remove). History is grouped by year with each year's total; tap an entry to fix or delete it. **Edit** at the top changes the item's details, including purchase date, VIN and license plate (shown under the title).
- **Policies (insurance):** add one with type **Policy**: company, policy number, agent, phone and which vehicles it covers. It has a yearly **Policy renewal** schedule (so it shows when due and in reminders), and premiums are logged on it as Fees. Policies are listed under Vehicles; each covered vehicle's page shows 🛡️ company · policy # and links to it. The policy page shows its details (tap the phone to call).
- **Log** (from an item page): pick the type (**Service**, **Repair** or **Fee**; the likely one is preselected), then the service (scheduled ones as chips), what was fixed, or the fee (Registration renewal, Insurance, Property tax, Inspection, Title or other), then date, reading, cost, shop, notes. A logged Registration renewal still resets its yearly schedule. Tick **Done while troubleshooting** (any type) when it was done while chasing a problem rather than because it was due: it shows with a \* and a scheduled service still resets its schedule. The item's reading moves forward if the new one is higher.
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
