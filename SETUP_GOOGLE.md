# Google setup for RIMS

One-time setup. About 15 minutes. Do it once and no user ever pastes a script
or a deployment URL again.

You will end up with three values to put into Vercel:

```
VITE_GOOGLE_CLIENT_ID
VITE_GOOGLE_API_KEY
VITE_GOOGLE_PROJECT_NUMBER
```

---

## Step 1 — Create a Cloud project

1. Go to <https://console.cloud.google.com/>
2. Sign in with the Google account that should own this (use the company
   account, not a personal one — see Step 8)
3. Click the project dropdown at the top, then **New project**
4. Name: `Real3D RIMS`
5. Click **Create**, then make sure the new project is selected in the dropdown

## Step 2 — Note the project NUMBER

1. Go to **Cloud Console > Home > Dashboard**
2. In the **Project info** card you will see **Project number** — a long
   number like `123456789012`
3. Copy it. This is `VITE_GOOGLE_PROJECT_NUMBER`

> This is the *number*, not the *ID*. The ID looks like `real3d-rims-451203`.
> Using the ID here makes the Picker silently fail to grant file access.

## Step 3 — Enable the two APIs

Go to **APIs & Services > Library**, then search for and enable each:

1. **Google Sheets API** — reading and writing your inventory data
2. **Google Picker API** — the file chooser

Both must say *API enabled* when you are done.

## Step 4 — Configure the OAuth consent screen

1. **APIs & Services > OAuth consent screen**
2. User type: **External**, then **Create**
   - Internal is only available with Google Workspace. External is fine; you
     do not need verification while you stay in Testing.
3. Fill in:
   - App name: `Real3D RIMS`
   - User support email: your email
   - Developer contact email: your email
4. **Save and continue**
5. On **Scopes**, click **Add or remove scopes** and add:
   - `.../auth/drive.file`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
6. **Save and continue**
7. On **Test users**, click **Add users** and add every email that will use
   the app:
   - `real3d.india1@gmail.com`
   - `inventory.real3d@gmail.com`
   - plus anyone else in your Users tab
8. **Save and continue**

> While the app is in Testing mode, **only listed test users can sign in.**
> Anyone else gets "access blocked". If someone cannot log in, this list is the
> first thing to check.

## Step 5 — Create the API key

1. **APIs & Services > Credentials**
2. **Create credentials > API key**
3. Copy the key. This is `VITE_GOOGLE_API_KEY`
4. Click **Edit API key** and restrict it:
   - **Application restrictions**: Websites
   - Add these referrers:
     - `https://rims-app-chi.vercel.app/*`
     - `http://localhost:5173/*`
   - **API restrictions**: Restrict key, then select **Google Picker API**
5. **Save**

> Restricting the key matters — an unrestricted key in your frontend bundle can
> be used by anyone who views source.

## Step 6 — Create the OAuth client ID

1. **APIs & Services > Credentials**
2. **Create credentials > OAuth client ID**
3. Application type: **Web application**
4. Name: `RIMS web`
5. Under **Authorised JavaScript origins**, add both, exactly:
   - `https://rims-app-chi.vercel.app`
   - `http://localhost:5173`
6. Leave **Authorised redirect URIs** empty — this app uses the token flow,
   which does not redirect
7. **Create**, then copy the **Client ID**. This is `VITE_GOOGLE_CLIENT_ID`

> **This is the step people get wrong.** Origins must have **no trailing
> slash** and must match the scheme exactly. A missing or mistyped origin makes
> the Google button do nothing at all, with no visible error — which is exactly
> the dead-button symptom you had before.

## Step 7 — Put the values into Vercel

1. Vercel > your project > **Settings > Environment Variables**
2. Add all three, for **Production**, **Preview** and **Development**:

   | Name | Value |
   |---|---|
   | `VITE_GOOGLE_CLIENT_ID` | from Step 6 |
   | `VITE_GOOGLE_API_KEY` | from Step 5 |
   | `VITE_GOOGLE_PROJECT_NUMBER` | from Step 2 |

3. **Redeploy.** Vite bakes these in at build time, so existing deployments
   will not pick them up.

For local development, create a `.env` file (copy `.env.example`) with the same
three values.

## Step 8 — Protect the workbook

The app is only as safe as the sheet behind it. Two things worth doing:

1. **Move the workbook into a Shared Drive**, or transfer ownership to a
   company account. If it sits in one person's personal Drive, losing that
   account loses your inventory.
2. **Add a second admin** with edit access, so nobody is a single point of
   failure.

Then, in the workbook's Apps Script editor, add `Backup.gs` and run
`installDailyBackup()` once. That gives you 30 days of dated snapshots.

> Snapshots live in the same Drive as the workbook, so they do not survive loss
> of the owning account. Step 8.1 is what protects you from that.

---

## First run

1. Open the app and click **Sign in with Google**
2. Approve the consent screen (you will see it asks only for files you select)
3. Click **Browse my Google Sheets** and choose your inventory workbook
4. If any tabs are missing, click **Create missing tabs**
5. Click **Continue to RIMS**

Your Google email must be in the **Users** tab of the workbook, with
`Active = 1`. If it is not, the app will tell you so by name rather than just
refusing.

---

## Troubleshooting

**The Google button does nothing**
Authorised JavaScript origin is missing or mistyped in Step 6. Check for a
trailing slash and that the scheme matches (`https` in production).

**"Access blocked: this app is not verified"**
Add the email as a Test user in Step 4.7.

**"This app does not have access to that workbook" (403)**
The file was never opened through the Picker. Use **Browse my Google Sheets**
rather than pasting a link — a pasted ID alone does not grant access under
`drive.file`.

**Picker opens but selecting a file changes nothing**
`VITE_GOOGLE_PROJECT_NUMBER` is probably the project *ID* instead of the
*number*. See Step 2.

**Signed in, but "you are not in the Users tab"**
Add your email to the Users tab with `Active = 1`. Match it exactly — matching
is case-insensitive but ignores nothing else.

**Everything shows zero stock**
Expected after migration: it clears the transaction ledger, so Inventory starts
at zero. Record your real shelf quantities as Stock In transactions.
