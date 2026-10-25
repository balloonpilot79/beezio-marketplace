/** Reserve during the click gesture, before any affiliate-link request. */
export function reserveShareWindow(): Window | null {
  const popup = window.open('', '_blank', 'width=720,height=640,scrollbars=yes,resizable=yes');
  // noopener in window.open's features returns null even when a tab opens.
  // Keep the handle for navigation, while removing access to the originating page.
  if (popup) popup.opener = null;
  return popup;
}

export function navigateShareWindow(url: string, popup: Window | null): void {
  if (popup && !popup.closed) popup.location.href = url;
  else window.location.assign(url);
}
