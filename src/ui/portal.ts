// "Portal mode": when the game runs inside a game portal (CrazyGames, Poki, Coolmath…), the page is opened
// with ?portal=<name>. Some portals don't allow outside logins or links, so sign-in, ranked and links out
// are hidden; guest play (including rooms with friends) still works.

const fromUrl = new URLSearchParams(window.location.search).get('portal');
if (fromUrl) {
  try {
    sessionStorage.setItem('ss-portal', fromUrl.slice(0, 30));
  } catch {
    /* storage unavailable */
  }
}

export const PORTAL: string | null = (() => {
  if (fromUrl) return fromUrl.slice(0, 30);
  try {
    return sessionStorage.getItem('ss-portal');
  } catch {
    return null;
  }
})();
