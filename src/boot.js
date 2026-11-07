/* boot.js — start the app once every file above has loaded */
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
