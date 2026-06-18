'use client';

import { useState, useEffect } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
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
        setStatusMessage('Error: VAPID public key is missing. Did you restart the dev server?');
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
        body: JSON.stringify({
          endpoint: subJSON.endpoint,
          keys: subJSON.keys,
        }),
      });

      if (res.ok) {
        setIsSubscribed(true);
        setStatusMessage('Subscribed to alerts!');
      } else {
        setStatusMessage('Failed to save subscription.');
      }
    } catch (e: any) {
      console.error('[PushManager] Subscribe error:', e);
      setStatusMessage('Error subscribing: ' + e.message);
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
      setStatusMessage('Unsubscribed from alerts.');
    } catch (e: any) {
      console.error('[PushManager] Unsubscribe error:', e);
      setStatusMessage('Error unsubscribing: ' + e.message);
    }
    setIsLoading(false);
  }

  async function handleTestPush() {
    setStatusMessage('Sending test push...');
    try {
      const res = await fetch('/api/webpush/test', { method: 'POST' });
      if (res.ok) {
        setStatusMessage('Test push sent! Check your notifications.');
      } else {
        const data = await res.json();
        setStatusMessage('Test push failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e: any) {
      setStatusMessage('Error: ' + e.message);
    }
  }

  if (!pushSupported) {
    return null;
  }

  return (
    <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Push Notifications
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Get instant alerts when high-severity disruptions are detected.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Toggle */}
          <button
            onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
              isSubscribed
                ? 'bg-blue-600'
                : 'bg-neutral-300 dark:bg-neutral-600'
            }`}
            role="switch"
            aria-checked={isSubscribed}
            aria-label="Toggle push notifications"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isSubscribed ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-xs text-neutral-600 dark:text-neutral-400 min-w-[50px]">
            {isLoading ? '...' : isSubscribed ? 'On' : 'Off'}
          </span>

          {/* Test Push Button */}
          {isSubscribed && (
            <button
              onClick={handleTestPush}
              className="text-xs border border-transparent px-4 py-1.5 bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium rounded-none shadow-sm"
            >
              Test Push
            </button>
          )}
        </div>
      </div>
      {statusMessage && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3">{statusMessage}</p>
      )}
    </div>
  );
}
