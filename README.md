# Before I do – The Singles Experience

This repository contains the Singles registration site and its dedicated Google Sheets backend. The form is available at **`/`** and **`/singles`**.

## Form and design

The site uses React 19, Vite, React Router, and Tailwind. It has a burgundy/rose/blush palette, `public/background.jpeg` without a dark overlay, translucent cards, and a bold italic Cormorant Garamond title. The hero contains no logo. About/Register navigation highlights the section as the page scrolls. The nine-question wizard supports keyboard navigation, Back, visible focus, mobile layouts, and reduced motion.

Name, telephone, email, age range, and gender are required. Required questions use a text hint without asterisks. Answers start unselected. Optional choices can be cleared; unanswered values are stored as blank, distinct from “No.” Multiple expectations are saved with semicolon separators. Dietary details are required only for “Yes — please specify”; choosing No or clearing the choice removes the details. Phone numbers stay strings, preserving prefixes and leading zeros.

## Run locally

Use Node 22.12+ and run commands from the repository root:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

`npm run dev` serves the frontend and `/api/singles-register` together using the same handler as Vercel. Set `ALLOWED_ORIGIN` to the exact origin you open, such as `http://127.0.0.1:5173`. The Google endpoint and secret load from `.env.local` into Node only; they are never exposed to the browser. Restart the dev server after changing configuration. **`npx vercel dev`** is also supported.

## Google Sheets configuration

Browser → `POST /api/singles-register` → authenticated Apps Script → **Singles Event Registrations**.

1. Choose or create the intended Singles spreadsheet. Copy its ID from `/spreadsheets/d/ID/edit`.
2. Open Extensions → Apps Script, or create a standalone Apps Script project whose owner can edit the spreadsheet. Enable the **Google Sheets API** under Services → Add a service, then add the **three** files in `google-apps-script/`: `Code.gs`, `Singles.gs`, and `SinglesValidation.gs`. They contain only the Singles backend. When updating a deployment, remove obsolete script files from that Apps Script project as well.
3. In Project Settings → Script Properties, set `SINGLES_SPREADSHEET_ID` to the destination spreadsheet ID and `SINGLES_SHARED_SECRET` to a long random secret. Generate a secret locally with `openssl rand -hex 32`; keep it out of source control and chat.
4. Deploy a Web app executing as its owner, with access set to Anyone. Every submission still requires the server-held secret. Authorize spreadsheet access and copy the deployment's `/exec` URL. After code changes, select a new version under Manage deployments so the new code runs.
5. Set these server-only values in `.env.local` and Vercel for the intended environment:

   ```dotenv
   SINGLES_GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   SINGLES_SHARED_SECRET=the-same-secret-as-the-Script-Property
   ALLOWED_ORIGIN=https://your-actual-form-domain.example
   ```

   Use an exact origin without a path or trailing slash. Never use `VITE_`, `PUBLIC_`, or `NEXT_PUBLIC_` prefixes for secrets. `.env.local` is ignored by Git. See [.env.example](.env.example) for placeholders. The destination ID belongs in Apps Script properties only.

6. Deploy on Vercel with framework Vite, build command `npm run build`, and output directory `dist`. `vercel.json` preserves server functions and serves the app routes. Redeploy after changing environment variables. Static-only hosting cannot run the registration API.

The backend requires an explicit destination ID and creates only **Singles Event Registrations**, with these columns. Existing records are never overwritten. Incompatible worksheet headers cause a configuration error.

| Column | Header                            |
| ------ | --------------------------------- |
| A      | Submission ID                     |
| B      | Submitted At                      |
| C      | Full Name                         |
| D      | Phone Number                      |
| E      | Email Address                     |
| F      | Age Range                         |
| G      | Gender                            |
| H      | Gospel Pillars Church Attendance  |
| I      | Event Expectations                |
| J      | Dietary Restrictions or Allergies |
| K      | Dietary Details                   |
| L      | Future Singles Events Opt-In      |

**Timestamp:** generated on the server as ISO 8601 **UTC**, ending in `Z`, independent of the spreadsheet display timezone.

**Safety:** browser, API, and Apps Script all validate answers. The API enforces the configured origin, checks payload size, applies a per-instance rate limit, and times out failed Google requests. All registration cells use text formatting and Sheets API `RAW` writes so formula-like input remains literal text. Before confirming success, Apps Script flushes the write, reads every cell back, compares the complete row, and checks for formulas.

**Retries:** the browser uses one UUID per form session and disables inputs/navigation while saving. Apps Script holds a script lock across the duplicate lookup and write. The same ID with the same answers returns the saved row's confirmation. Changed answers with an already-saved ID return a conflict rather than modifying data or adding a second row. Use one Apps Script project/deployment family per destination so writes share the same lock. Reloading starts a new form session; retry on the existing page after a network failure.

Errors preserve answers and permit a retry. The exact thank-you message appears only after readable JSON confirms a saved row with the matching submission ID and timestamp.

## Checks and live verification

```sh
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
```

Tests cover required fields, optional blanks versus No, international telephone text, email and choice validation, all 12 columns, multiple expectations, dietary conditions, keyboard/Back navigation, clear selection, loading states, repeated clicks, retries, lost confirmation after a saved row, conflicting retries, lock contention, authentication, explicit destination configuration, worksheet headers, backend errors, unreadable responses, and scroll navigation.

Automated Apps Script tests use a fake spreadsheet runtime; they do not verify a live Google Sheets write.

Once `.env.local` and Apps Script are configured:

```sh
npm run test:live
```

This sends synthetic data through the API handler to the real deployment, requires full-row confirmation, and retries the same ID to check idempotency. It leaves **one** row named **TEST REGISTRATION — DELETE AFTER VERIFICATION** in **Singles Event Registrations**, printing its submission ID. Inspect columns A–L and remove/report the test record after verification. For an uncertain timeout, reuse the printed ID with `SINGLES_TEST_SUBMISSION_ID=the-printed-id npm run test:live`.

The dedicated registration spreadsheet and bound Apps Script web app have been configured. Live verification confirmed all 12 saved cells and idempotent retries, including international phone prefixes and leading formula-like text. Private connection details and synthetic test-record IDs are kept in the ignored local setup notes. Configure the server environment variables in production hosting before publishing the website; local credentials are never committed or deployed with the source.

When changing shared validation, run `npm run sync:sheets` and redeploy the generated `SinglesValidation.gs`. A test ensures the generated file matches the browser/API source.

## Main files

- `src/pages/SinglesRegistrationPage.jsx`: page and hero.
- `src/components/SinglesWizard.jsx`: form, navigation, and success/error states.
- `src/lib/singles.js`: shared choices, validation, and column mapping.
- `src/lib/submitSingles.js`: browser API client.
- `api/singles-register.js`: server endpoint.
- `server/singlesApi.js`: server configuration, request guards, and Apps Script client.
- `google-apps-script/`: Singles-only Sheets backend.
