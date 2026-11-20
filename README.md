# Car Care

An Android app for the family's vehicle maintenance log. Everything is stored in a Google Sheet, so anyone you share the sheet with can look at it on any phone or computer without the app.

## What it does

- **Home:** what's overdue or due soon across all vehicles, and a card per vehicle with its mileage.
- **Log service:** pick the vehicle and the service (oil change, tire rotation, …), the date, mileage, cost, shop, notes. It's added to the sheet, and the vehicle's mileage moves forward if the new reading is higher.
- **Vehicle page:** update the odometer, see each scheduled item with last done / next due, add schedule items, and browse or delete past entries.
- **Updates:** when a new build is out, the home screen shows **Download & install** (same as RussianSpeak).

## The Google Sheet ("Car Maintenance Log")

| Tab | What's in it |
|---|---|
| Vehicles | One row per car. "Vehicle" is the short name used everywhere. |
| Service Log | Every service. The app adds rows; you can type rows in too. |
| Schedule | How often each service is due. Last done, next due and Status are formulas that read the Service Log. |

Status is **Overdue**, **Due soon** (within 30 days or 500 miles), **OK**, or **No record**. A log entry counts toward a schedule item only when its Vehicle and Service match exactly. The starting intervals are general; adjust them from each owner's manual.

## Connect the app to the sheet (one time, easiest on a computer)

1. Open the sheet → **Extensions → Apps Script**. Delete what's there, paste in [`apps-script/Code.gs`](apps-script/Code.gs), and save.
2. In the function menu at the top, choose **makeKey** and press **Run**. Approve the permissions (Google warns because it's your own unverified script; choose Advanced → Go to project). Copy the key from the **Execution log**.
3. **Deploy → New deployment →** gear → **Web app**. Execute as **Me**, Who has access **Anyone**. Deploy and copy the **Web app URL** (ends in `/exec`).
4. In the app: ⚙️ **Settings →** paste the URL and key → **Test & save**.

"Anyone" means anyone with the URL can reach the script, but the script refuses every request without the key, and the key lives only on your phone. Don't post the URL or key anywhere.

If you change `Code.gs` later: **Deploy → Manage deployments →** pencil → **Version: New version → Deploy**. The URL stays the same.

## Build and install from your phone

1. Every merge to `main` runs **Actions → Build Android APK** (about 10–15 minutes). You can also run it by hand.
2. Open **Releases**, download the newest `CarCare-N.apk`, and open it to install.
3. After that, new builds show up as an update on the app's home screen.

The repo has to stay public for the update check to see new releases. No personal data is in the repo; it's all in your sheet.

## Development

```bash
npm install
npx expo start      # Expo Go for quick testing
npm run typecheck
npm test            # unit tests for the data helpers
```

- Screens: `src/app/` (Expo Router). Sheet access: `src/lib/api.ts`. Parsing and formatting: `src/lib/format.ts`. Updates: `src/lib/update.ts`.
- Pull requests run the **Checks** workflow (typecheck, tests, bundle) before merging.
