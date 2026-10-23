require('../i18n/default');
const config = require('../config/env');

function renderFirebaseAuthScript() {
  const publicConfig = JSON.stringify(config.firebase).replace(/</g, '\\u003c');
  return `<script type="module">
    const buttons = document.querySelectorAll('[data-google-login]');
    try {
      const firebaseConfig = ${publicConfig};
      if (!firebaseConfig.apiKey || !firebaseConfig.authDomain) {
        throw new Error('google_login_unavailable_configure_firebase_authentication'.tr);
      }
      const [{ initializeApp }, { getAuth, GoogleAuthProvider, signInWithPopup, signOut, setPersistence, browserSessionPersistence }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js')
      ]);
      const auth = getAuth(initializeApp(firebaseConfig));
      await setPersistence(auth, browserSessionPersistence);
      window.signOutGoogle = () => signOut(auth);
      window.authenticateGoogle = async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await signInWithPopup(auth, provider);
        const idToken = await result.user.getIdToken();
        const response = await window.ConfloraSession.apiFetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          await signOut(auth);
          throw new Error(data.error || 'could_not_authenticate_your_account'.tr);
        }
        return data;
      };
      buttons.forEach(button => { button.disabled = false; });
    } catch (error) {
      document.querySelectorAll('[data-google-status]').forEach(element => {
        element.textContent = error.message || 'unable_to_load_google_login_reload_the_page'.tr;
      });
    }
  </script>`;
}

module.exports = { renderFirebaseAuthScript };
