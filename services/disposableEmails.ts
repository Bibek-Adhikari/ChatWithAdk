// Curated blocklist of common temporary / disposable email providers.
// Client-side first line of defense — Firebase Auth has no built-in temp-mail filter.
// For stronger enforcement, mirror this check in a Firebase Blocking Function
// (beforeCreate) so it can't be bypassed via API calls.

const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com', '10minutemail.net', '10minutemail.org',
  'tempmail.com', 'temp-mail.com', 'temp-mail.org', 'tempmail.org', 'tempmail.net',
  'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz',
  'mailinator.com', 'mailinator.net', 'mailinator.org',
  'yopmail.com', 'yopmail.net', 'yopmail.fr',
  'trashmail.com', 'trashmail.net', 'trashmail.org',
  'dispostable.com', 'throwawaymail.com', 'throwaway.email',
  'fakeinbox.com', 'fakemail.net', 'fakemailgenerator.com',
  'getnada.com', 'getairmail.com', 'burnermail.io',
  'mohmal.com', 'emailondeck.com', 'tempinbox.com',
  'mintemail.com', 'mytemp.email', 'mytempemail.com',
  'inboxkitten.com', 'inboxbear.com', 'spamgourmet.com',
  'sharklasers.com', 'grr.la', 'guerrillamailblock.com',
  'pokemail.net', 'anonbox.net', 'maildrop.cc',
  'harakirimail.com', 'mailnesia.com', 'crazymailing.com',
  'mintemail.com', 'tmail.ws', 'tmpmail.org', 'tmpmail.net',
  'moakt.com', 'mail.tm', '1secmail.com', '1secmail.net', '1secmail.org',
]);

export function getEmailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  if (at === -1) return '';
  return email.slice(at + 1).trim().toLowerCase();
}

export function isDisposableEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  // Catch subdomain variants, e.g. xyz.mail.tm
  for (const blocked of DISPOSABLE_DOMAINS) {
    if (domain.endsWith(`.${blocked}`)) return true;
  }
  return false;
}
