# RSVP → Google Sheet

Responses from all three invitations (`/wedding`, `/traditional`, `/modern`)
are appended to a Google Sheet you own. There is no backend to run and no
Google credential in the website: the Apps Script Web App runs as you and is
called anonymously by the browser.

Until you finish the setup below the form still works, but it says
*"Preview mode — responses are not being saved yet"* and records nothing. It
never claims to have saved a response it did not save.

## Setup, once (about five minutes)

1. Create a new Google Sheet. Name it whatever you like, e.g. *Mohan &
   Nandhini RSVPs*.
2. In that sheet: **Extensions → Apps Script**.
3. Delete the placeholder `myFunction`, paste in all of
   [`apps-script.gs`](apps-script.gs), and save.
4. **Deploy → New deployment**, and set:
   - *Type*: **Web app**
   - *Execute as*: **Me**
   - *Who has access*: **Anyone** — this means anonymous, not "anyone signed
     in". Without it the browser gets a sign-in page instead of your script.
5. Authorise it when prompted. Google will warn that the app is unverified
   because you wrote it yourself; choose *Advanced → Go to … (unsafe)*.
6. Copy the Web app URL. It looks like
   `https://script.google.com/macros/s/AKfy…/exec`.
7. In GitHub: **Settings → Secrets and variables → Actions → New repository
   secret**, named `RSVP_ENDPOINT`, with that URL as the value.
8. Push, or re-run the Pages workflow. The build injects the URL and the
   preview notice disappears.

Check it worked by opening the URL directly in a browser: it should answer
`{"ok":true,"service":"mohan-nandhini-rsvp"}`. Then send yourself a test RSVP
and watch the row arrive in the sheet.

## About that URL

It is **not a credential**. Vite inlines it into the published JavaScript, so
anyone viewing source on the live site can read it, and this repository is
public. Keeping it in a GitHub secret does not hide it — it just means the URL
lives in one place and can be rotated by redeploying the script and updating
the secret, without editing any source.

What it can do if someone finds it: submit RSVPs. That is all. It cannot read
the sheet, and the script ignores anything that is not a well-formed response.

Because of that, the realistic risk is junk entries rather than a data leak.
Three things limit it:

- a hidden honeypot field, which real guests leave empty and naive bots fill in;
- required name, phone and a valid attending value;
- Google's own quotas on the Web App.

If you ever do get spammed, redeploy the Apps Script as a *new* deployment and
update the `RSVP_ENDPOINT` secret. The old URL stops working immediately and
nothing in the sheet is lost.

## Changing the URL without a rebuild

The endpoint is read from `window.RSVP_ENDPOINT` first and only then from the
build-time variable, so you can also set it directly in `index.html`:

```html
<script>window.RSVP_ENDPOINT = 'https://script.google.com/macros/s/AKfy…/exec';</script>
```

Useful for testing a second script against the live site without redeploying.

## What lands in the sheet

| Column | Notes |
| --- | --- |
| Received | Server timestamp, not the guest's clock |
| Name | |
| Attending | `Yes` / `No` |
| Guests | `0` when not attending |
| Phone | Stored as text, so `+91…` and leading zeros survive |
| Message | Optional note to the couple |
| Invitation | `classic`, `temple` or `museum` — which page they replied from |
| Language | `en` or `ta` |

The header row is created automatically on the first response.

## Local development

`npm run dev` has no endpoint configured, so the form stays in preview mode and
your sheet is never touched. To exercise the real path locally, set the
variable for that run only:

```
VITE_RSVP_ENDPOINT='https://script.google.com/macros/s/AKfy…/exec' npm run dev
```

`npm run visual-check` stubs the endpoint with Playwright, so the suite tests
the real submit path — method, payload, the `text/plain` content type, the
honeypot, and that a rejected submission shows an error rather than a false
confirmation — without ever writing to your spreadsheet.

## Why `text/plain`

The browser sends the RSVP as `Content-Type: text/plain;charset=utf-8` even
though the body is JSON. Any other content type makes it a non-simple CORS
request, so the browser first sends a preflight `OPTIONS`, which an Apps Script
Web App cannot answer — the submission then fails in the browser while the
script itself is perfectly healthy. The script parses the body as JSON
regardless. This is load-bearing; `scripts/visual-check.mjs` asserts it.
