import 'firebase/auth';

/**
 * firebase/auth ships getReactNativePersistence in its React Native build, but the
 * package's top-level "types" entry points at the browser typings. Declare it here.
 */
declare module 'firebase/auth' {
  interface ReactNativeAsyncStorage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
