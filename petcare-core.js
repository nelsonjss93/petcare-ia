// ============================================================
// petcare-core.js v2 — Módulo central de PetCare
// ============================================================

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

// ============================================================
// AUTH
// ============================================================
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
  async getPerfil() {
    await this.ready();
    const user = await this.getUser();
    if (!user) return null;
    const { data } = await _supa.from('perfiles').select('*').eq('id', user.id).single();
    return data;
  },
  async requireAuth(redirectTo = 'dashboard.html') {
    const user = await this.getUser();
    if (!user) window.location.href = `dashboard.html`;
    return user;
  }
};

// ============================================================
// MOTOR IA — Prompt clínico preciso
// ============================================================
const Analisis = {

  SYSTEM: `Eres un asistente clínico veterinario experto. Tu misión es analizar EXACTAMENTE los síntomas descritos y dar un diagnóstico útil, tranquilizador y PRECISO.

REGLAS ABSOLUTAS:
1. Analiza SOLO los síntomas mencionados. JAMÁS inventes síntomas adicionales.
2. El diagnóstico debe ser 100% coherente con los síntomas. Si dicen "caída de pelo", tu análisis debe ser sobre caída de pelo.
3. NUNCA recomiendes productos que no tengan relación directa con el síntoma descrito.
4. NUNCA menciones pasta dental si el síntoma no es dental. NUNCA menciones vitaminas genéricas si hay un síntoma específico.
5. Sé ESPECÍFICO: si el síntoma es caída de pelo + mancha roja → piensa en dermatitis, alergia, hongos, sarna. Di ESO.
6. Usa lenguaje cálido y tranquilizador para el dueño, pero preciso clínicamente.

MAPEO SÍNTOMA → DIAGNÓSTICO CORRECTO:
- Caída de pelo + mancha roja → Dermatitis/alergia cutánea/hongos (tiña)/sarna. Producto: champú antifúngico, antiparasitario externo si hay parásitos.
- Caída de pelo sin más síntomas → Muda estacional, estrés, alergia alimentaria. Producto: suplemento omega-3 para piel, cepillo deslanador.
- Vómitos ocasionales → Indigestión, ingesta rápida. Producto: probiótico canino/felino.
- Vómitos frecuentes + letargo → Posible obstrucción o infección. URGENTE.
- Diarrea sin sangre → Cambio alimentario, estrés. Producto: probiótico, arroz con pollo.
- Diarrea con sangre → EMERGENCIA veterinaria.
- Picazón/rascado → Pulgas, ácaros, alergia. Producto: antipulgas pipeta, champú antipruriginoso.
- Ojos llorosos → Conjuntivitis, alergia. Producto: suero fisiológico, colirio veterinario.
- Cojera → Esguince, artritis. Producto: antiinflamatorio natural (consultar vet).
- Letargo sin otros síntomas → Calor, estrés, cambio de rutina.
- Hinchazón → Depende zona. Cara: alergia aguda (urgente). Pata: traumatismo.
- Falta de apetito > 24h → Consultar veterinario.
- Secreción nasal → Infección respiratoria alta, alergia.
- Estornudos → Alergia, irritante ambiental, infección.

SEMÁFORO:
🟢 VERDE (70-100): Síntomas leves, manejo en casa, monitoreo.
🟡 AMARILLO (40-69): Síntomas moderados, vigilar 24-48h, posible consulta.
🔴 ROJO (0-39): URGENTE, necesita veterinario hoy.

Responde ÚNICAMENTE con JSON válido sin backticks ni texto adicional:
{
  "semaforo": "verde|amarillo|rojo",
  "score": número_0_a_100,
  "titulo": "Diagnóstico en 4-6 palabras específicas al síntoma",
  "causa_probable": "Explicación de qué está pasando y por qué, específica al síntoma descrito",
  "cuidados": [
    "Cuidado específico 1 directamente relacionado al síntoma",
    "Cuidado específico 2",
    "Cuándo y cómo monitorear",
    "Cuándo ir al veterinario"
  ],
  "productos": [
    "Producto EXACTO y relevante para ESTE síntoma (ej: Champú antifúngico Malaseb si hay mancha + caída de pelo)",
    "Alternativa o complemento específico (o dejar vacío si no aplica)"
  ],
  "alerta_vet": "Instrucción concreta si es amarillo/rojo, null si verde",
  "tranquilizador": "Mensaje cálido y honesto para el dueño sobre la situación"
}`,

  async analizar({ nombreMascota, especie, raza, edad, peso, sintomas, descripcion, urgenciaUser, duracion, comportamiento }) {
    const prompt = `
Mascota: ${nombreMascota} (${especie}${raza ? ', ' + raza : ''}${edad ? ', ' + edad + ' años' : ''}${peso ? ', ' + peso + 'kg' : ''})
Síntomas seleccionados: ${sintomas?.join(', ') || 'No especificados'}
Descripción del dueño: "${descripcion || 'Sin descripción adicional'}"
Urgencia percibida: ${urgenciaUser || 'No indicada'}
Duración de síntomas: ${duracion || 'No indicada'}
Comportamiento general: ${comportamiento || 'No indicado'}

IMPORTANTE: El diagnóstico DEBE ser coherente con los síntomas descritos arriba. Si mencionan caída de pelo, analiza caída de pelo. Si mencionan vómitos, analiza vómitos. NO des respuestas genéricas.

Analiza y responde con el JSON estructurado.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: this.SYSTEM,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) throw new Error('Error al contactar el motor de análisis');
    const data = await res.json();
    const texto = data.content?.[0]?.text ?? '';
    try {
      return JSON.parse(texto);
    } catch {
      const clean = texto.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    }
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
      tiene_foto: entrada.tieneFoto ?? false,
      semaforo: resultado.semaforo,
      score: resultado.score,
      cuidados: JSON.stringify(resultado.cuidados),
      productos: JSON.stringify(resultado.productos),
      respuesta_raw: JSON.stringify(resultado)
    }).select().single();
    if (error) console.warn('No se pudo guardar la consulta:', error.message);
    return data;
  }
};

// ============================================================
// MASCOTAS
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
// CONSULTAS
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
// UTILS
// ============================================================
const Utils = {
  toast(msg, tipo = 'ok') {
    let t = document.getElementById('__petcare_toast');
    if (!t) {
      t = document.createElement('div');
      t.id = '__petcare_toast';
      t.style.cssText = `position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);
        padding:11px 22px;border-radius:50px;font-size:13px;font-weight:600;font-family:'DM Sans',sans-serif;
        color:#fff;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.15);opacity:0;
        pointer-events:none;transition:all .3s ease;white-space:nowrap;`;
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = tipo === 'ok' ? '#0A0A0A' : tipo === 'err' ? '#FF3B5C' : '#FF9F0A';
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(20px)';
    }, 3000);
  },
  fecha(iso) {
    return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  },
  semColorClass(sem) {
    return sem === 'verde' ? 'green' : sem === 'amarillo' ? 'yellow' : 'red';
  }
};

window.PetCare = { Auth, Analisis, Mascotas, Consultas, Utils };
console.log('✅ PetCare Core v2 cargado');
