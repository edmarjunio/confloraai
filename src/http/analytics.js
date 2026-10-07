const GOOGLE_ANALYTICS_TAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TX7SZBP9J8"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-TX7SZBP9J8');
</script>`;

module.exports = {
  GOOGLE_ANALYTICS_TAG,
};
