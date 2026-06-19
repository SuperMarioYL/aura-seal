const LS_ONBOARDED = 'auraseal.onboarded';

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(LS_ONBOARDED) === '1';
  } catch {
    return false;
  }
}

export function markOnboarded() {
  try {
    localStorage.setItem(LS_ONBOARDED, '1');
  } catch {
    // ignore storage failures
  }
}
