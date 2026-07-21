'use client';

import { useState, useEffect } from 'react';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export function PushManager({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pushSupported, setPushSupported] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setPushSupported(supported);
    if (supported) {
      checkExistingSubscription();
    } else {
      setIsLoading(false);
    }
  }, []);

  async function checkExistingSubscription() {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (e) {
      console.error('[PushManager] Error checking subscription:', e);
    }
    setIsLoading(false);
  }

  async function handleSubscribe() {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatusMessage('Notification permission denied.');
        setIsLoading(false);
        return;
      }
      if (!vapidPublicKey) {
        setStatusMessage('VAPID key missing — restart the dev server.');
        setIsLoading(false);
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const subJSON = subscription.toJSON();
      const res = await fetch('/api/webpush/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subJSON.endpoint, keys: subJSON.keys }),
      });
      if (res.ok) {
        setIsSubscribed(true);
        setStatusMessage('Subscribed to push alerts.');
      } else {
        setStatusMessage('Failed to save subscription.');
      }
    } catch (e: any) {
      setStatusMessage('Error: ' + e.message);
    }
    setIsLoading(false);
  }

  async function handleUnsubscribe() {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/webpush/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
      setStatusMessage('Unsubscribed.');
    } catch (e: any) {
      setStatusMessage('Error: ' + e.message);
    }
    setIsLoading(false);
  }

  async function handleTestPush() {
    setStatusMessage('Sending...');
    try {
      const res = await fetch('/api/webpush/test', { method: 'POST' });
      if (res.ok) {
        setStatusMessage('Test push delivered.');
      } else {
        const data = await res.json();
        setStatusMessage('Failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e: any) {
      setStatusMessage('Error: ' + e.message);
    }
  }

  if (!pushSupported) return null;

  return (
    <div style={{
      background: 'var(--base-1)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--sp-4) var(--sp-5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--sp-4)',
      flexWrap: 'wrap',
    }}>
      <div>
        <p style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '2px',
          fontFamily: 'var(--font-ui)',
        }}>
          Push Alerts
        </p>
        <p className="section-label">
          {isLoading ? '...' : isSubscribed ? 'Active — severity ≥ 4' : 'Disabled'}
          {statusMessage && ` · ${statusMessage}`}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        {isSubscribed && (
          <button
            onClick={handleTestPush}
            className="btn btn-secondary"
            style={{ fontSize: 'var(--text-2xs)' }}
          >
            Send Test
          </button>
        )}

        {/* Toggle */}
        <button
          onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
          disabled={isLoading}
          className="toggle"
          role="switch"
          aria-checked={isSubscribed}
          aria-label="Toggle push notifications"
        >
          <span className="toggle-thumb" />
        </button>
      </div>
    </div>
  );
}
