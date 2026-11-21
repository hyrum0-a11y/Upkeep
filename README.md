# Upkeep

An Android app for the family's maintenance log: vehicles and household equipment (like the water filter). Everything is stored in a Google Sheet, so anyone you share the sheet with can look at it on any phone or computer without the app.

## What it does

- **Home:** what's overdue or due soon across everything, then a card for each vehicle and piece of equipment.
- **Log service:** pick the item and the service (oil change, filter change, …), the date, the reading (miles or hours, if it has a meter), cost, shop, notes. It's added to the sheet, and the item's reading moves forward if the new one is higher.
- **Item page:** update the odometer or hour meter, see each scheduled service with last done / next due and what to buy (Part / spec), add schedule items, and browse or delete past entries.
- **Set starting points:** for services with no record yet, enter roughly when each was last done (a year is fine) in one go, so they can start coming due.
- **Updates:** when a new build is out, the home screen shows **Download & install** (same as RussianSpeak).

## The Google Sheet ("Maintenance Log")

| Tab | What's in it |
|---|---|
| Due | Everything Overdue or Due soon, most urgent first and color-coded. The one tab to check (e.g. on an iPhone). |
| Equipment | One row per vehicle or piece of equipment. **Type** is Vehicle or Equipment. **Meter** is miles, hours, or blank (no meter, like a water filter). |
| Service Log | Every service. The app adds rows; you can type rows in too. |
| Schedule | How often each service is due. Last done, next due and Status are formulas that read the Service Log. **Part / spec** says what to buy. |

Status is **Overdue**, **Due soon** (within about 10% of the interval, at most 30 days), **OK**, or **No record**. A log entry counts toward a schedule item only when its Item and Service match exactly. Intervals come from the owner's manuals where available; "(check manual)" marks ones not confirmed. Each vehicle also tracks fuel injector cleaner, brake fluid, battery, wipers and tire age.

To add something new (a mower, a generator, the HVAC filter), add a row on the Equipment tab, then add its services on the Schedule tab or from the app.

## Connect the app to the sheet (one time, easiest on a computer)

1. Open the sheet → **Extensions → Apps Script**. Delete what's there, paste in [`apps-script/Code.gs`](apps-script/Code.gs), and save.
2. In the function menu at the top, choose **setup** and press **Run**. Approve the permissions (Google warns because it's your own unverified script; choose Advanced → Go to project).
   - If there's no Equipment tab yet, setup lays out the tabs with all the items and starting schedules. If the tabs already exist it leaves them alone.
   - It prints your key in the **Execution log**. Copy it.
3. **Deploy → New deployment →** gear → **Web app**. Execute as **Me**, Who has access **Anyone**. Deploy and copy the **Web app URL** (ends in `/exec`).
4. In the app: ⚙️ **Settings →** paste the URL and key → **Test & save**.

"Anyone" means anyone with the URL can reach the script, but the script refuses every request without the key, and the key lives only on your phone. Don't post the URL or key anywhere. Run **newKey** to replace the key if you ever need to.

If you change `Code.gs` later:

1. Paste the new version into Apps Script and save.
2. Choose **upgrade** in the function menu and press **Run**. It only adds things (new tabs, columns, schedule rows, colors) and updates intervals you haven't changed by hand. It never deletes rows. The Execution log says what it did.
3. **Deploy → Manage deployments →** pencil → **Version: New version → Deploy**. The URL stays the same.

## Build and install from your phone

1. Every merge to `main` runs **Actions → Build Android APK** (about 10–15 minutes). You can also run it by hand.
2. Open **Releases**, download the newest `Upkeep-N.apk`, and open it to install.
3. After that, new builds show up as an update on the app's home screen.

The repo has to stay public for the update check to see new releases. No personal data is in the repo; it's all in your sheet.

## Development

```bash
npm ci              # installs the exact versions in package-lock.json
npx expo start      # Expo Go for quick testing
npm run typecheck
npm test            # unit tests for the data helpers
```

- Screens: `src/app/` (Expo Router). Sheet access: `src/lib/api.ts`. Parsing and formatting: `src/lib/format.ts`. Updates: `src/lib/update.ts`.
- Pull requests run the **Checks** workflow (typecheck, tests, bundle) before merging.
- `package-lock.json` is committed and the workflows install with `npm ci`. Add or upgrade packages with `npx expo install <package>` and commit the updated lockfile with the change.
