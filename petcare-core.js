// ============================================================
// petcare-core.js — Módulo central de PetCare
// Incluir en TODOS los HTML:
//   <script src="petcare-core.js"></script>
// ANTES de cualquier script propio de la página.
// ============================================================

// ─── CONFIGURACIÓN ──────────────────────────────────────────
// Reemplaza con tus valores reales de Supabase:
// SUPA_URL  → Supabase > Settings > API > Project URL
// SUPA_KEY  → Supabase > Settings > API Keys > Publishable key (sb_publishable_...)
//             OJO: usa la Publishable key, NO la Secret key
const SUPA_URL  = 'https://qmscqloaqiovgawemups.supabase.co';
const SUPA_KEY  = 'sb_publishable_k0XJOcY8iX08q_s7J8Xk9Q_tJ0ikZgR';

// Reemplaza con tu API key de Anthropic:
// https://console.anthropic.com/settings/keys
const CLAUDE_KEY = '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';
// ─────────────────────────────────────────────────────────────

// Carga el SDK de Supabase desde CDN
// (ya disponible como window.supabase tras cargar este script)
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

// ============================================================
// AUTH — Registro, login, logout, sesión
// ============================================================
const Auth = {

  // Espera a que Supabase esté listo
  ready() {
    return window._supa
      ? Promise.resolve()
      : new Promise(r => window.addEventListener('supa:ready', r, { once: true }));
  },

  // Registro con email/password + nombre y mascota
  async register({ nombre, contacto, password, nombreMascota, especie }) {
    await this.ready();
    const isEmail = contacto.includes('@');
    const email   = isEmail ? contacto : contacto + '@petcare.pe'; // fallback para teléfono
    const { data, error } = await _supa.auth.signUp({
      email,
      password,
      options: { data: { nombre, nombreMascota, especie } }
    });
    if (error) throw error;
    // Si tiene mascota, crearla
    if (data.user && nombreMascota) {
      await _supa.from('mascotas').insert({
        user_id: data.user.id,
        nombre:  nombreMascota,
        especie: especie || 'perro'
      });
    }
    return data;
  },

  // Login con email/password
  async login({ contacto, password }) {
    await this.ready();
    const email = contacto.includes('@') ? contacto : contacto + '@petcare.pe';
    const { data, error } = await _supa.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  // Logout
  async logout() {
    await this.ready();
    await _supa.auth.signOut();
    window.location.href = 'index.html';
  },

  // Devuelve el usuario actual (o null)
  async getUser() {
    await this.ready();
    const { data } = await _supa.auth.getUser();
    return data?.user ?? null;
  },

  // Devuelve el perfil completo del usuario
  async getPerfil() {
    await this.ready();
    const user = await this.getUser();
    if (!user) return null;
    const { data } = await _supa.from('perfiles').select('*').eq('id', user.id).single();
    return data;
  },

  // Redirige a login si no hay sesión
  async requireAuth(redirectTo = 'dashboard.html') {
    const user = await this.getUser();
    if (!user) window.location.href = `dashboard.html?next=${redirectTo}`;
    return user;
  }
};

// ============================================================
// MOTOR IA — Análisis de síntomas con Claude
// ============================================================
const Analisis = {

  // Prompt del sistema — clínico PRECISO con análisis específico
  SYSTEM: `Eres un asistente clínico veterinario experto en diagnóstico de síntomas en PERROS Y GATOS en Perú.
REGLA DE ORO: Analiza ESPECÍFICAMENTE los síntomas mencionados. NO inventes síntomas adicionales. 
NO des diagnósticos genéricos. Sé PRECISO según especie, edad, síntoma exacto.

NUNCA: recomiendes medicamentos, antibióticos o tratamientos. SÍ recomienda cuidados específicos.
NUNCA: recomiendes productos NO relacionados (ej: pasta dental para caída de pelo).
SÍ: Productos específicos para ESTE problema (alimento para alergias, antiparasitario si es parasitario, etc).

Responde ÚNICAMENTE CON JSON VÁLIDO (sin backticks, sin explicación previa):
{
  "semaforo": "verde" | "amarillo" | "rojo",
  "score": número 0-100 (100=sano, 0=emergencia),
  "titulo": "diagnóstico conciso 4-6 palabras",
  "cuidados": [
    "Cuidado específico 1 directamente relevante al síntoma",
    "Cuidado específico 2 basado en la especie",
    "Acción inmediata o monitoreo necesario",
    "Cuándo buscar veterinario"
  ],
  "productos": [
    "Producto EXACTO relevante si aplica, vacío si no aplica",
    "Alternativa disponible en Perú si existe"
  ],
  "alerta_vet": "Instrucción clara si amarillo/rojo, SINO null",
  "resumen": "Explicación clara de qué está pasando y por qué ocurre"
}

SEMÁFORO CRITERIOS:
🟢 VERDE (65-100): Leve, casa, monitoreo. Ej: picazón leve, pequeño vómito ocasional
🟡 AMARILLO (35-64): Moderado, vigilancia 24-48h. Ej: vómitos recurrentes, falta de apetito 
🔴 ROJO (0-34): EMERGENCIA, veterinario HOY. Ej: vómitos graves, sangrado, convulsiones

SÍNTOMAS ESPECÍFICOS - RESPUESTAS PRECISAS:
CAÍDA DE PELO: Identifica causa (estrés, parásitos externos, alergia alimentaria, dermatitis). Recomendación: inspección de piel, desparasitante si parasitario, cambio de alimento si alergia.
VÓMITOS: ¿Sangre? ¿Frecuencia? ¿Después de comer? Urgencia según severidad. Cuidado: rehidratación oral.
DIARREA: ¿con sangre? Probióticos, alimento bland (arroz pollo), agua abundante.
PICAZÓN/RASCADO: Antiparasitarios si sospecha (pulgas, ácaros), baño con agua tibia, investigar alergia.
OJO ROJO: Alergia, infección conjuntival o queratitis. Limpiar con solución salina. ROJO si úlcera ocular sospechada.`,

  // Analiza los síntomas y devuelve el resultado
  async analizar({ nombreMascota, especie, raza, edad, peso, sintomas, descripcion, urgenciaUser, duracion }) {
    const prompt = `
Mascota: ${nombreMascota} (${especie}${raza ? ', ' + raza : ''}${edad ? ', ' + edad + ' años' : ''}${peso ? ', ' + peso + 'kg' : ''})
Síntomas seleccionados: ${sintomas?.join(', ') || 'ninguno seleccionado'}
Descripción del dueño: ${descripcion || 'sin descripción adicional'}
Urgencia percibida por el dueño: ${urgenciaUser || 'no indicada'}
Duración de los síntomas: ${duracion || 'no indicada'}

Analiza esta situación y responde con el JSON estructurado.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         CLAUDE_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system:     this.SYSTEM,
        messages:   [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) throw new Error('Error al contactar el motor de análisis');
    const data = await res.json();
    const texto = data.content?.[0]?.text ?? '';

    try {
      return JSON.parse(texto);
    } catch {
      // Si el JSON viene con backticks, lo limpiamos
      const clean = texto.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    }
  },

  // Guarda la consulta en Supabase (anónima o con usuario)
  async guardar({ userId, mascotaId, entrada, resultado }) {
    await Auth.ready();
    const { data, error } = await _supa.from('consultas').insert({
      user_id:        userId ?? null,
      mascota_id:     mascotaId ?? null,
      nombre_mascota: entrada.nombreMascota,
      especie:        entrada.especie,
      sintomas:       entrada.sintomas,
      descripcion:    entrada.descripcion,
      urgencia_user:  entrada.urgenciaUser,
      duracion:       entrada.duracion,
      tiene_foto:     entrada.tieneFoto ?? false,
      semaforo:       resultado.semaforo,
      score:          resultado.score,
      cuidados:       JSON.stringify(resultado.cuidados),
      productos:      JSON.stringify(resultado.productos),
      respuesta_raw:  JSON.stringify(resultado)
    }).select().single();

    if (error) console.warn('No se pudo guardar la consulta:', error.message);
    return data;
  }
};

// ============================================================
// MASCOTAS — CRUD
// ============================================================
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
  },
  async actualizar(id, campos) {
    await Auth.ready();
    const { data, error } = await _supa.from('mascotas').update(campos).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
};

// ============================================================
// CONSULTAS — historial
// ============================================================
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

// ============================================================
// UTILIDADES
// ============================================================
const Utils = {
  // Muestra un toast ligero
  toast(msg, tipo = 'ok') {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      padding:10px 20px;border-radius:50px;font-size:13px;font-weight:700;
      background:${tipo === 'ok' ? '#2ECC71' : tipo === 'err' ? '#E74C3C' : '#333'};
      color:#fff;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.15);
      animation:fadeUp .3s ease;pointer-events:none;`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  },

  // Formatea fecha en español
  fecha(iso) {
    return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  }
};

// Exponer globalmente
window.PetCare = { Auth, Analisis, Mascotas, Consultas, Utils };
console.log('✅ PetCare Core cargado');
