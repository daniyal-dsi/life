import { supabase } from './supabase';

// Reminders on this device: subscribe to Web Push and save the subscription
// in Supabase. Permission must be asked from a tap, and on iPhone only works
// in the app opened from the home screen (iOS 16.4 or later).

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushStatus =
  | 'unconfigured' // no VAPID key or no Supabase
  | 'unsupported' // browser can't do push
  | 'needs-home-screen' // iPhone/iPad in Safari: add to home screen first
  | 'denied' // notifications blocked in settings
  | 'off'
  | 'on';

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function keyBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function pushStatus(): Promise<PushStatus> {
  if (!VAPID_PUBLIC_KEY || !supabase) return 'unconfigured';
  if (isIos() && !isStandalone()) return 'needs-home-screen';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

/** Call from a tap. Asks permission, subscribes and saves the subscription. */
export async function turnOnPush(): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !supabase) throw new Error('Reminders are not set up yet.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed.');
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY).buffer as ArrayBuffer }));
  const json = sub.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_user_agent: navigator.userAgent
  });
  if (error) throw error;
}

export async function turnOffPush(): Promise<void> {
  const sub = await (await registration())?.pushManager.getSubscription();
  if (!sub) return;
  if (supabase) {
    const { error } = await supabase.rpc('revoke_push_subscription', { p_endpoint: sub.endpoint });
    if (error) throw error;
  }
  await sub.unsubscribe();
}

/** Asks the server to send a test notification to this person's devices. */
export async function sendTestPush(): Promise<string> {
  if (!supabase) throw new Error('Not connected.');
  const { data, error } = await supabase.functions.invoke('send-reminders', { body: { test: true } });
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return `Sent to ${data.sent} of ${data.devices} device${data.devices === 1 ? '' : 's'}.`;
}
