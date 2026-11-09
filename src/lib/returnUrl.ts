/**
 * Where a sign-in should continue to: the `returnUrl` in a query string, as
 * long as it is a path on this site. Anything else — "https://…", "//host",
 * "/\host" — is dropped, so the parameter cannot send a visitor off-site
 * once they have signed in.
 */
export function safeReturnUrl(search: string): string | null {
  const value = new URLSearchParams(search).get('returnUrl');
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}
