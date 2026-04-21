// ============================================================
// petcare-core.js — Módulo central de PetCare
// Incluir en TODOS los HTML:
// <script src="petcare-core.js"></script>
// ANTES de cualquier script propio de la página.
// ============================================================

// ─── CONFIGURACIÓN ────────────────────────────────────────────
const SUPA_URL = 'https://qmscqloaqiovgawemups.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2NxbG9hcWlvdmdhd2VtdXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2Mzg3MDMsImV4cCI6MjA5MjIxNDcwM30.H2Mz0YN8BVWpFbdWbTQguV0-K7OovS8waShvA_Zy6hk';
const CLAUDE_KEY = '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';

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
    const isEmail = contacto.includes('@');
    const email = isEmail ? contacto : contacto + '@petcare.pe';
    const { data, error } = await _supa.auth.signUp({ email, password, options: { data: { nombre, nombreMascota, especie } } });
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
  async getPerfil() {
    await this.ready();
    const user = await this.getUser();
    if (!user) return null;
    const { data } = await _supa.from('perfiles').select('*').eq('id', user.id).single();
    return data;
  },
  async requireAuth(redirectTo = 'dashboard.html') {
    const user = await this.getUser();
    if (!user) window.location.href = `dashboard.html?next=${redirectTo}`;
    return user;
  }
};

const Analisis = {
  SYSTEM: `Eres un asistente clínico veterinario experto en diagnóstico de síntomas en PERROS Y GATOS en Perú. REGLA DE ORO: Analiza ESPECÍFICAMENTE los síntomas mencionados. NO inventes síntomas adicionales. NO des diagnósticos genéricos. Sé PRECISO según especie, edad, síntoma exacto. NUNCA: recomiendes medicamentos, antibióticos o tratamientos. SÍ recomienda cuidados específicos. NUNCA: recomiendes productos NO relacionados. SÍ: Productos específicos para ESTE problema. Responde ÚNICAMENTE CON JSON VÁLIDO (sin backticks, sin explicación previa): { "semaforo": "verde" | "amarillo" | "rojo", "score": número 0-100, "titulo": "diagnóstico conciso 4-6 palabras", "cuidados": ["Cuidado 1","Cuidado 2","Cuidado 3","Cuidado 4"], "productos": ["Producto 1","Producto 2"], "alerta_vet": "Instrucción si amarillo/rojo, SINO null", "resumen": "Explicación clara" }`,
  async analizar({ nombreMascota, especie, raza, edad, peso, sintomas, descripcion, urgenciaUser, duracion }) {
    const prompt = `Mascota: ${nombreMascota} (${especie}${raza ? ', ' + raza : ''}${edad ? ', ' + edad + ' años' : ''}${peso ? ', ' + peso + 'kg' : ''})\nSíntomas: ${sintomas?.join(', ') || 'ninguno'}\nDescripción: ${descripcion || 'sin descripción'}\nUrgencia: ${urgenciaUser || 'no indicada'}\nDuración: ${duracion || 'no indicada'}`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: this.SYSTEM, messages: [{ role: 'user', content: prompt }] })
    });
    if (!res.ok) throw new Error('Error al contactar el motor de análisis');
    const data = await res.json();
    const texto = data.content?.[0]?.text ?? '';
    try { return JSON.parse(texto); } catch { return JSON.parse(texto.replace(/```json|```/g, '').trim()); }
  },
  async guardar({ userId, mascotaId, entrada, resultado }) {
    await Auth.ready();
    const { data, error } = await _supa.from('consultas').insert({
      user_id: userId ?? null, mascota_id: mascotaId ?? null,
      nombre_mascota: entrada.nombreMascota, especie: entrada.especie,
      sintomas: entrada.sintomas, descripcion: entrada.descripcion,
      urgencia_user: entrada.urgenciaUser, duracion: entrada.duracion,
      tiene_foto: entrada.tieneFoto ?? false, semaforo: resultado.semaforo,
      score: resultado.score, cuidados: JSON.stringify(resultado.cuidados),
      productos: JSON.stringify(resultado.productos), respuesta_raw: JSON.stringify(resultado)
    }).select().single();
    if (error) console.warn('No se pudo guardar la consulta:', error.message);
    return data;
  }
};

const Mascotas = {
  async listar(userId) { await Auth.ready(); const { data } = await _supa.from('mascotas').select('*').eq('user_id', userId).order('created_at'); return data ?? []; },
  async crear({ userId, nombre, especie, raza, edad, peso }) { await Auth.ready(); const { data, error } = await _supa.from('mascotas').insert({ user_id: userId, nombre, especie, raza, edad, peso }).select().single(); if (error) throw error; return data; },
  async actualizar(id, campos) { await Auth.ready(); const { data, error } = await _supa.from('mascotas').update(campos).eq('id', id).select().single(); if (error) throw error; return data; }
};

const Consultas = {
  async historial(userId, limit = 20) { await Auth.ready(); const { data } = await _supa.from('consultas').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit); return data ?? []; },
  async porId(id) { await Auth.ready(); const { data } = await _supa.from('consultas').select('*').eq('id', id).single(); return data; }
};

const Utils = {
  toast(msg, tipo = 'ok') {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:50px;font-size:13px;font-weight:700;background:${tipo === 'ok' ? '#2ECC71' : tipo === 'err' ? '#E74C3C' : '#333'};color:#fff;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.15);animation:fadeUp .3s ease;pointer-events:none;`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  },
  fecha(iso) { return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }); }
};

window.PetCare = { Auth, Analisis, Mascotas, Consultas, Utils };
console.log('✅ PetCare Core cargado');
