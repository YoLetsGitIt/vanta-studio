// New-booking notifications on this device (web push). On iPhone they only work
// once Vanta Studio is added to the Home Screen and opened from there.
import { authHeaders } from '@/lib/api';

const BACKEND = () => process.env.NEXT_PUBLIC_BACKEND_URL;

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.register('/sw.js', { scope: '/' }); } catch { return null; }
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration('/')) || registerServiceWorker();
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

function keyBytes(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

async function call(path, method, body) {
  const res = await fetch(`${BACKEND()}${path}`, {
    method, headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.');
  return data;
}

// Asks permission, subscribes this browser and saves it for the studio.
export async function enablePush() {
  const config = await fetch(`${BACKEND()}/studio/push-config`).then(r => r.json());
  if (!config.enabled) throw new Error('Notifications aren’t available yet. Please try again later.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied'
    ? 'Notifications are blocked for Vanta Studio. Allow them in your phone or browser settings, then try again.'
    : 'Notifications weren’t allowed.');
  const reg = await registration();
  if (!reg) throw new Error('This browser can’t receive notifications.');
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.public_key) });
  await call('/studio/me/push-subscriptions', 'POST', sub.toJSON());
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await call('/studio/me/push-subscriptions', 'DELETE', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

export async function sendTestPush() {
  const sub = await currentSubscription();
  if (!sub) throw new Error('Turn on notifications first.');
  // Re-save in case the browser rotated the subscription.
  await call('/studio/me/push-subscriptions', 'POST', sub.toJSON());
  return call('/studio/me/push-subscriptions/test', 'POST', { endpoint: sub.endpoint });
}
