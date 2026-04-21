// petcare-dashboard.js v2 — Lógica de sesión y dashboard

async function cargarSesion() {
  const L = document.getElementById('screen-loading');
  try {
    await PetCare.Auth.ready();
    const user = await PetCare.Auth.getUser();

    if (!user) {
      // No hay sesión → mostrar login
      if (L) L.classList.add('hide');
      document.getElementById('screen-auth').classList.add('on');
      document.getElementById('nav-login-btn').style.display = 'block';
      return;
    }

    // Guardar user globalmente
    window._currentUser = user;

    // Datos del usuario
    const nombre = user.user_metadata?.nombre || user.email?.split('@')[0] || 'Usuario';
    const ini = nombre[0].toUpperCase();

    // Actualizar UI
    document.getElementById('uc-name').textContent = nombre;
    document.getElementById('uc-email').textContent = user.email || '';
    document.getElementById('uc-avatar').textContent = ini;
    document.getElementById('nav-avatar').textContent = ini;
    document.getElementById('nav-uname').textContent = nombre;
    document.getElementById('nav-user').style.display = 'flex';
    document.getElementById('nav-login-btn').style.display = 'none';
    document.getElementById('wb-greeting').textContent = getGreeting() + ', ' + nombre + ' 👋';

    // Mostrar dashboard
    document.getElementById('screen-dashboard').classList.add('on');

    // Cargar datos
    await cargarHistorial();
    await cargarMascotas();

    // Código referido
    const code = 'PC-' + user.id.substring(0, 6).toUpperCase();
    const refEl = document.getElementById('ref-code');
    if (refEl) refEl.textContent = code;

  } catch (e) {
    console.error('Error en cargarSesion:', e);
    document.getElementById('screen-auth')?.classList.add('on');
  } finally {
    if (L) L.classList.add('hide');
  }
}

function logOut() { PetCare.Auth.logout(); }
function showPage(p) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  const el = document.getElementById('screen-' + p);
  if (el) el.classList.add('on');
}
