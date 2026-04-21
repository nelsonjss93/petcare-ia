// ============================================================
// petcare-core.js v2 — Módulo central de PetCare
// ============================================================

const SUPA_URL = 'https://qmscqloaqiovgawemups.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2NxbG9hcWlvdmdhd2VtdXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2Mzg3MDMsImV4cCI6MjA5MjIxNDcwM30.H2Mz0YN8BVWpFbdWbTQguV0-K7OovS8waShvA_Zy6hk';
const EDGE_URL = 'https://qmscqloaqiovgawemups.supabase.co/functions/v1/analizar';

if (!window.__supa_loaded) {
  window.__supa_loaded = true;
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  s.onload = () => {
    window._supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
    window.dispatchEvent(new Event('supa:ready'));
  };
  document.head.appendChild(s);
}

const Auth = {
  ready() {
    return window._supa ? Promise.resolve() : new Promise(r => window.addEventListener('supa:ready', r, { once: true }));
  },
  async register({ nombre, contacto, password, nombreMascota, especie }) {
    await this.ready();
    const email = contacto.includes('@') ? contacto : contacto + '@petcare.pe';
    const { data, error } = await _supa.auth.signUp({
      email, password,
      options: { data: { nombre, nombreMascota, especie } }
    });
    if (error) throw error;
    if (data.user && nombreMascota) {
      await _supa.from('mascotas').insert({ user_id: data.user.id, nombre: nombreMascota, especie: especie || 'perro' });
    }
    return data;
  },
  async login({ contacto, password }) {
    await this.ready();
    const email = contacto.includes('@') ? contacto : contacto + '@petcare.pe';
    const { data, error } = await _supa.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  async logout() {
    await this.ready();
    await _supa.auth.signOut();
    window.location.href = 'index.html';
  },
  async getUser() {
    await this.ready();
    const { data } = await _supa.auth.getUser();
    return data?.user ?? null;
  },
  async requireAuth() {
    const user = await this.getUser();
    if (!user) window.location.href = 'dashboard.html';
    return user;
  }
};

const Analisis = {
  // Llama a la Edge Function (sin problemas de CORS)
  async analizar({ nombreMascota, especie, raza, edad, peso, sintomas, descripcion, urgenciaUser, duracion, comportamiento }) {
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombreMascota, especie, raza, edad, peso, sintomas, descripcion, urgenciaUser, duracion, comportamiento })
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error('Error en el análisis: ' + err);
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  },

  async guardar({ userId, mascotaId, entrada, resultado }) {
    await Auth.ready();
    const { data, error } = await _supa.from('consultas').insert({
      user_id: userId ?? null,
      mascota_id: mascotaId ?? null,
      nombre_mascota: entrada.nombreMascota,
      especie: entrada.especie,
      sintomas: entrada.sintomas,
      descripcion: entrada.descripcion,
      urgencia_user: entrada.urgenciaUser,
      duracion: entrada.duracion,
      tiene_foto: false,
      semaforo: resultado.semaforo,
      score: resultado.score,
      cuidados: JSON.stringify(resultado.cuidados),
      productos: JSON.stringify(resultado.productos),
      respuesta_raw: JSON.stringify(resultado)
    }).select().single();
    if (error) console.warn('No se pudo guardar:', error.message);
    return data;
  }
};

const Mascotas = {
  async listar(userId) {
    await Auth.ready();
    const { data } = await _supa.from('mascotas').select('*').eq('user_id', userId).order('created_at');
    return data ?? [];
  },
  async crear({ userId, nombre, especie, raza, edad, peso }) {
    await Auth.ready();
    const { data, error } = await _supa.from('mascotas').insert({ user_id: userId, nombre, especie, raza, edad, peso }).select().single();
    if (error) throw error;
    return data;
  }
};

const Consultas = {
  async historial(userId, limit = 20) {
    await Auth.ready();
    const { data } = await _supa.from('consultas').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    return data ?? [];
  },
  async porId(id) {
    await Auth.ready();
    const { data } = await _supa.from('consultas').select('*').eq('id', id).single();
    return data;
  }
};

const Utils = {
  toast(msg, tipo = 'ok') {
    let t = document.getElementById('__petcare_toast');
    if (!t) {
      t = document.createElement('div');
      t.id = '__petcare_toast';
      t.style.cssText = `position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);padding:11px 22px;border-radius:50px;font-size:13px;font-weight:600;font-family:'DM Sans',sans-serif;color:#fff;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.15);opacity:0;pointer-events:none;transition:all .3s ease;white-space:nowrap;`;
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = tipo === 'ok' ? '#0A0A0A' : tipo === 'err' ? '#FF3B5C' : '#FF9F0A';
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(20px)'; }, 3000);
  },
  fecha(iso) {
    return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  }
};

window.PetCare = { Auth, Analisis, Mascotas, Consultas, Utils };
console.log('✅ PetCare Core v2 cargado');
