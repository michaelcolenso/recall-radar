import { layout } from "./layout";
import { escapeHtml } from "../lib/utils";

interface AlertPageEnv {
  googleVerification?: string;
  analyticsToken?: string;
}

export function alertConfirmedPage(env: AlertPageEnv, vehicleLabel: string): string {
  return layout({
    ...env,
    title: "Alerts Confirmed | Recalled Rides",
    description: "Your recall alert subscription is confirmed.",
    noIndex: true,
    body: `
      <div class="rr-empty">
        <h1 class="rr-empty__title">You're All Set</h1>
        <p class="rr-empty__text">Recall alerts for the <strong>${escapeHtml(vehicleLabel)}</strong> are confirmed. We check NHTSA weekly — if a new recall is issued for this vehicle, you'll get a plain-English email. Every message has a one-click unsubscribe link.</p>
        <a href="/" class="rr-empty__action">Back to Recalled Rides</a>
      </div>
    `,
  });
}

export function alertUnsubscribedPage(env: AlertPageEnv): string {
  return layout({
    ...env,
    title: "Unsubscribed | Recalled Rides",
    description: "You have been unsubscribed from recall alerts.",
    noIndex: true,
    body: `
      <div class="rr-empty">
        <h1 class="rr-empty__title">Unsubscribed</h1>
        <p class="rr-empty__text">Done — you won't receive any more recall alerts for this vehicle. Changed your mind? You can re-subscribe from the vehicle's page anytime.</p>
        <a href="/" class="rr-empty__action">Back to Recalled Rides</a>
      </div>
    `,
  });
}

export function alertErrorPage(env: AlertPageEnv, message: string): string {
  return layout({
    ...env,
    title: "Link Problem | Recalled Rides",
    description: "This alert link is invalid or has expired.",
    noIndex: true,
    body: `
      <div class="rr-empty">
        <h1 class="rr-empty__title">That Link Didn't Work</h1>
        <p class="rr-empty__text">${escapeHtml(message)}</p>
        <a href="/" class="rr-empty__action">Back to Recalled Rides</a>
      </div>
    `,
  });
}
