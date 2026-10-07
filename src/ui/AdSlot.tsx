// Placeholder for a future ad. Renders nothing while ads are off.
// To turn ads on later: set ADS_ENABLED and render the provider's tag here
// (AdSense on the web, AdMob via a Capacitor plugin in the app, or the portal's SDK on Poki/CrazyGames).
// Only between-game screens get slots, never the game table itself.

export const ADS_ENABLED = false;

export function AdSlot({ placement }: { placement: 'home' | 'gameover' }) {
  if (!ADS_ENABLED) return null;
  return <div className="ad-slot" data-placement={placement} />;
}
