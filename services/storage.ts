type StorageType = 'local' | 'session';

const getStorage = (type: StorageType): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return type === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

const readRaw = (key: string, type: StorageType): string | null => {
  const storage = getStorage(type);
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const writeRaw = (key: string, value: string, type: StorageType): boolean => {
  const storage = getStorage(type);
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const removeRaw = (key: string, type: StorageType) => {
  const storage = getStorage(type);
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
};

interface ReadOptions {
  prefer?: StorageType;
  fallbackToOther?: boolean;
}

interface WriteOptions {
  persist?: 'local' | 'session' | 'both';
}

export const readString = (key: string, fallback: string, options: ReadOptions = {}): string => {
  const prefer = options.prefer || 'local';
  const fallbackToOther = options.fallbackToOther !== false;
  const primary = readRaw(key, prefer);
  if (primary !== null) return primary;
  if (!fallbackToOther) return fallback;
  const secondary = readRaw(key, prefer === 'local' ? 'session' : 'local');
  return secondary !== null ? secondary : fallback;
};

export const readJson = <T,>(key: string, fallback: T, options: ReadOptions = {}): T => {
  const raw = readString(key, '', options);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    if (options.prefer) {
      removeRaw(key, options.prefer);
    }
    return fallback;
  }
};

export const readNumber = (key: string, fallback: number, options: ReadOptions = {}): number => {
  const raw = readString(key, '', options);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const readBoolean = (key: string, fallback: boolean, options: ReadOptions = {}): boolean => {
  const raw = readString(key, '', options);
  if (!raw) return fallback;
  return raw === 'true';
};

export const writeString = (key: string, value: string, options: WriteOptions = {}): void => {
  const persist = options.persist || 'local';
  if (persist === 'local' || persist === 'both') {
    writeRaw(key, value, 'local');
  }
  if (persist === 'session' || persist === 'both') {
    writeRaw(key, value, 'session');
  }
};

export const writeJson = (key: string, value: unknown, options: WriteOptions = {}): void => {
  writeString(key, JSON.stringify(value), options);
};

export const removeKey = (key: string, options: WriteOptions = {}): void => {
  const persist = options.persist || 'local';
  if (persist === 'local' || persist === 'both') {
    removeRaw(key, 'local');
  }
  if (persist === 'session' || persist === 'both') {
    removeRaw(key, 'session');
  }
};

