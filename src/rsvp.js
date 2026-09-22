/**
 * Sends an RSVP to the Google Apps Script Web App that writes the spreadsheet.
 *
 * The endpoint is resolved at runtime first, then from the build. Setting
 * `window.RSVP_ENDPOINT` in index.html lets the URL be changed or rotated
 * without rebuilding the site.
 *
 * With no endpoint configured the form still works and simply reports that it
 * saved nothing, so local development and the deployed preview never pretend to
 * have stored a response they did not store.
 */
const endpoint = () =>
  (typeof window !== 'undefined' && window.RSVP_ENDPOINT) ||
  import.meta.env.VITE_RSVP_ENDPOINT ||
  '';

export const rsvpConfigured = () => Boolean(endpoint());

export async function submitRsvp(entry) {
  const url = endpoint();
  if (!url) return { stored: false };

  const response = await fetch(url, {
    method: 'POST',
    // text/plain keeps this a CORS "simple request". Anything else triggers a
    // preflight OPTIONS, which an Apps Script Web App cannot answer, and the
    // submission would fail in the browser even though the script is fine.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(entry),
    redirect: 'follow',
  });

  if (!response.ok) throw new Error(`RSVP endpoint returned ${response.status}`);

  const result = await response.json().catch(() => null);
  if (!result?.ok) throw new Error(result?.error || 'RSVP was not accepted');

  return { stored: true };
}
