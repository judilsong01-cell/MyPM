import React from 'react';
import { AppState, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { STORAGE_KEYS } from '../constants/storage';
import { wipeLocalData } from '../database';
import { appwriteAccount } from '../services/appwrite';

type AuthStatus = 'loading' | 'unauthenticated' | 'unverified' | 'authenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: any | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AUTH_STORAGE_KEYS = {
  lastValidatedAt: 'mypme:auth_last_validated_at:v1',
  isVerified: 'mypme:auth_is_verified:v1',
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

const parseUrl = (url: string): { userId: string; secret: string } | null => {
  try {
    const u = new URL(url);
    const userId = u.searchParams.get('userId');
    const secret = u.searchParams.get('secret');
    if (!userId || !secret) return null;
    return { userId, secret };
  } catch {
    return null;
  }
};

const isProbablyNetworkError = (error: any): boolean => {
  const message = String(error?.message ?? '').toLowerCase();
  return (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('request failed') ||
    message.includes('timeout')
  );
};

const ensureLocalIsolation = async (userId: string | null): Promise<void> => {
  const previous = await AsyncStorage.getItem(STORAGE_KEYS.activeUserId);

  // SECURITY:
  // Always wipe offline data on logout OR when the logged-in user changes.
  if (userId === null || previous !== userId) {
    await wipeLocalData();
    await AsyncStorage.removeItem(STORAGE_KEYS.lastSyncAt);
  }

  if (userId === null) {
    await AsyncStorage.multiRemove([STORAGE_KEYS.activeUserId, AUTH_STORAGE_KEYS.lastValidatedAt, AUTH_STORAGE_KEYS.isVerified]);
    return;
  }

  await AsyncStorage.setItem(STORAGE_KEYS.activeUserId, userId);
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = React.useState<AuthStatus>('loading');
  const [user, setUser] = React.useState<any | null>(null);

  const refresh = React.useCallback(async () => {
    const net = await NetInfo.fetch().catch(() => null);
    const isOnline = !!net?.isConnected;

    if (!isOnline) {
      setUser(null);
      setStatus('unauthenticated');
      return;
    }

    try {
      const currentUser = await appwriteAccount.get();

      const verified = !!currentUser?.emailVerification || !!currentUser?.phoneVerification;
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.isVerified, verified ? '1' : '0');
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.lastValidatedAt, String(Date.now()));

      await ensureLocalIsolation(currentUser?.$id ?? null);

      setUser(currentUser);
      setStatus(verified ? 'authenticated' : 'unverified');
    } catch (error: any) {
      // If we *can't* validate due to connectivity flakiness, do not wipe local data.
      if (isProbablyNetworkError(error)) {
        setUser(null);
        setStatus('unauthenticated');
        return;
      }

      await ensureLocalIsolation(null).catch(() => {});
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const signOut = React.useCallback(async () => {
    try {
      await appwriteAccount.deleteSessions();
    } catch {
      // ignore
    }

    await ensureLocalIsolation(null).catch(() => {});
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const handleIncomingUrl = React.useCallback(
    async (url: string) => {
      const token = parseUrl(url);
      if (!token) return;

      // We try both flows:
      // - Email verification: updateEmailVerification(userId, secret)
      // - Token-to-session exchange (OAuth token, magic-url, phone token): createSession(userId, secret)
      try {
        await appwriteAccount.updateEmailVerification({ userId: token.userId, secret: token.secret });
        await refresh();
        return;
      } catch {
        // ignore and try session exchange
      }

      try {
        await appwriteAccount.createSession({ userId: token.userId, secret: token.secret });
        await refresh();
      } catch {
        // ignore
      }
    },
    [refresh]
  );

  React.useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  React.useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleIncomingUrl(url).catch(() => {});
    });

    Linking.getInitialURL()
      .then((url) => {
        if (url) handleIncomingUrl(url).catch(() => {});
      })
      .catch(() => {});

    return () => sub.remove();
  }, [handleIncomingUrl]);

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh().catch(() => {});
    });
    return () => sub.remove();
  }, [refresh]);

  const value: AuthContextValue = React.useMemo(
    () => ({
      status,
      user,
      refresh,
      signOut,
    }),
    [status, user, refresh, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
