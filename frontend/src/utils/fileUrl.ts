/** Older deployments saved the storage server's loopback address in profiles. */
export function publicFileUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (['http:', 'https:'].includes(url.protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      && ['9000', '9010'].includes(url.port)
      && url.pathname.startsWith('/resume-files/')) {
      return `/minio${url.pathname}${url.search}`;
    }
  } catch {
    // Same-origin paths already work without URL parsing.
  }
  return value;
}
