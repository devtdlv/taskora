// Stands in for next/headers outside a Next.js request, so route handlers can
// be called directly. Tests choose the cookies a request carries with
// setRequestCookies; handlers read and write them through cookies().

let jar = new Map();

export function setRequestCookies(values = {}) {
  jar = new Map(Object.entries(values));
}

export async function cookies() {
  return {
    get: (name) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    has: (name) => jar.has(name),
    set: (name, value) => {
      jar.set(name, value);
    },
    delete: (name) => {
      jar.delete(name);
    },
  };
}

export async function headers() {
  return new Headers();
}
