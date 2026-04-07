export type Registry<T> = {
  register: (key: string, component: T) => void;
  get: (key: string) => T | undefined;
  has: (key: string) => boolean;
  keys: () => string[];
};

export function createRegistry<T>(name: string): Registry<T> {
  const map = new Map<string, T>();
  return {
    register: (key: string, component: T) => {
      if (map.has(key)) {
        console.warn(`[${name}] overwriting existing key: ${key}`);
      }
      map.set(key, component);
    },
    get: (key: string) => map.get(key),
    has: (key: string) => map.has(key),
    keys: () => [...map.keys()],
  };
}
