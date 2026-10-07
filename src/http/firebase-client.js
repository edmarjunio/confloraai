const config = require('../config/env');

function renderFirebaseAuthScript() {
  const publicConfig = JSON.stringify(config.firebase).replace(/</g, '\\u003c');
  return `<script type="module">
    const buttons = document.querySelectorAll('[data-google-login]');
    try {
      const firebaseConfig = ${publicConfig};
      if (!firebaseConfig.apiKey || !firebaseConfig.authDomain) {
        throw new Error('Login Google indisponível: configure o Firebase Authentication.');
      }
      const [{ initializeApp }, { getAuth, GoogleAuthProvider, signInWithPopup, signOut }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js')
      ]);
      const auth = getAuth(initializeApp(firebaseConfig));
      window.signOutGoogle = () => signOut(auth);
      window.authenticateGoogle = async () => {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        const idToken = await result.user.getIdToken();
        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          await signOut(auth);
          throw new Error(data.error || 'Não foi possível autenticar sua conta.');
        }
        return data;
      };
      buttons.forEach(button => { button.disabled = false; });
    } catch (error) {
      document.querySelectorAll('[data-google-status]').forEach(element => {
        element.textContent = error.message || 'Não foi possível carregar o login Google. Recarregue a página.';
      });
    }
  </script>`;
}

module.exports = { renderFirebaseAuthScript };
