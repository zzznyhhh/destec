/**
 * DESTEC — Client-side Auth Helper
 * Requires: @supabase/supabase-js CDN loaded before this script
 */

let _sb = null;
let _initPromise = null;

function _init() {
  if (_initPromise) return _initPromise;
  _initPromise = fetch('/api/config')
    .then(r => r.json())
    .then(config => {
      _sb = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      window._destecConfig = config;
    })
    .catch(err => {
      console.error('DestecAuth init failed:', err);
      _initPromise = null;
      throw err;
    });
  return _initPromise;
}

const DestecAuth = {
  async getClient() {
    await _init();
    return _sb;
  },

  async getSession() {
    await _init();
    const { data: { session } } = await _sb.auth.getSession();
    return session;
  },

  async getAccessToken() {
    const session = await this.getSession();
    return session?.access_token || null;
  },

  async getUser() {
    const session = await this.getSession();
    return session?.user || null;
  },

  async signUp(email, password, fullName) {
    await _init();
    return _sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
  },

  async signIn(email, password) {
    await _init();
    return _sb.auth.signInWithPassword({ email, password });
  },

  async signInWithGoogle() {
    await _init();
    return _sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/generator.html' }
    });
  },

  async signOut() {
    await _init();
    await _sb.auth.signOut();
    window.location.href = '/login.html';
  },

  async requireAuth() {
    const session = await this.getSession();
    if (!session) {
      window.location.href = '/login.html';
      return null;
    }
    return session;
  },

  async onAuthChange(callback) {
    await _init();
    _sb.auth.onAuthStateChange(callback);
  }
};

window.DestecAuth = DestecAuth;
