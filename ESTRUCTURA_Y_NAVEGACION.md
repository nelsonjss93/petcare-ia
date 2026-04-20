# PetCare - Estructura y Navegación

## 📊 Diagrama de Flujo General

```
index.html (Inicio)
    ↓
    → [Botón "Consultar gratis →"] → auth.html (LOGIN/REGISTRO)
    
auth.html tiene dos tabs:
    → TAB 1: INGRESA (login)
      Email/Teléfono + Contraseña → Dashboard
      
    → TAB 2: CREA TU CUENTA (registro)
      Nombre + Email/Teléfono + Mascota + Especie + Contraseña → Dashboard

dashboard.html (Mi Cuenta)
    ├── [NUEVA CONSULTA →] → consulta.html (FORMULARIO PASO 1-4)
    │   Paso 1: Datos de mascota
    │   Paso 2: Síntomas
    │   Paso 3: Foto (opcional)
    │   Paso 4: RESULTADO (análisis IA de Claude)
    │
    ├── Mi historial de consultas
    ├── Mis mascotas registradas
    └── [Mi cuenta] → configuracion.html

Desde cualquier página:
    ├── [PetCare logo] → index.html (Home)
    ├── [Planes] → pagos.html
    ├── [WhatsApp] → whatsapp.html
    ├── [Consultar] → auth.html (si no logueado) o consulta.html (si logueado)
    └── [FAQ] → faq.html
```

---

## 📄 Descripción de Cada Página

### 1. **index.html** (PÁGINA DE INICIO)
**¿Qué es?** Landing page de bienvenida
**Contenido:**
- Hero section con CTA "Consultar gratis →"
- Características principales
- Precios
- Testimonios
- FAQ
- Newsletter

**Navegación:**
- Logo → index.html (refrescando)
- "Consultar gratis" → auth.html
- Links en navbar: Planes, WhatsApp, login

---

### 2. **auth.html** (NUEVO - LOGIN/REGISTRO)
**¿Qué es?** Centro de autenticación unificado
**Tiene dos tabs:**

#### TAB 1: INGRESA
- Email/Teléfono
- Contraseña
- Opciones: Google, WhatsApp
- Link a registro

#### TAB 2: CREA TU CUENTA
- Nombre completo
- Email/Teléfono
- Nombre mascota
- Especie (Perro/Gato/Otro)
- Contraseña
- Acepta términos

**Acción:** 
- ✅ Login exitoso → dashboard.html
- ✅ Registro exitoso → dashboard.html

---

### 3. **dashboard.html** (MI CUENTA)
**¿Qué es?** Panel personal del usuario
**Solo accesible si está logueado**

**Contenido:**
- Perfil del usuario (nombre, email)
- "Nueva consulta →" (botón principal)
- Mis mascotas registradas
- Historial de consultas
- Score de salud
- Acciones pendientes (vacunas, etc)

**Navegación:**
- "Nueva consulta" → consulta.html
- "Configuración" → configuracion.html
- Navbarlinks funcionan

---

### 4. **consulta.html** (FORMULARIO DE CONSULTA)
**¿Qué es?** Formulario de 4 pasos para análisis de síntomas
**Accesible:** Solo si logueado (después de auth.html)

**PASO 1: MASCOTA**
- Seleccionar especie (Perro/Gato/Otro)
- Nombre
- Raza (opcional)
- Edad
- Peso
- [Continuar →] → Paso 2

**PASO 2: SÍNTOMAS**
- Seleccionar síntomas (checkboxes)
- Descripción libre
- ¿Qué tan urgente te parece?
- ¿Cuánto tiempo lleva?
- ¿Ha comido hoy?
- ¿Ha tenido esto antes?
- [Continuar →] → Paso 3

**PASO 3: FOTO (OPCIONAL)**
- Subir foto del síntoma (JPG, PNG)
- O saltar sin foto
- [Continuar →] → Paso 4

**PASO 4: RESULTADO (IA)**
- ✅ Se activa llamada a Claude API
- Muestra:
  - **Nivel de urgencia** (🟢 verde / 🟠 amarillo / 🔴 rojo)
  - **Score de salud** (0-100)
  - **Cuidados específicos** (basado EN el síntoma exacto)
  - **Productos recomendados** (RELEVANTES al síntoma)
  - **Datos de comunidad** (% mejoraron en casa, tiempo promedio)
  - **Próximos pasos** (plan de acción)
  - **Calendario de seguimiento** (24h, 48h)

**Acciones finales:**
- [Descargar PDF]
- [Nueva consulta]
- [Compartir]
- Feedback: "Me quedé tranquilo / Tengo duda / Sigo preocupado"

---

### 5. **configuracion.html** (MI CUENTA)
**¿Qué es?** Configuración personal
**Solo accesible si logueado**

**Contenido:**
- Perfil (nombre, email, teléfono)
- Cambiar contraseña
- Mis mascotas (agregar/editar)
- Preferencias de notificaciones
- Privacidad y datos
- Eliminar cuenta

---

### 6. **pagos.html** (PLANES Y PRECIOS)
**¿Qué es?** Página de pricing y planes
**Accesible:** Todos (logueado o no)

**Contenido:**
- Por consulta: S/5.90
- Plan Básico: S/29.90/mes
- Plan Familiar: S/49.90/mes
- Integración Culqi para pagar

---

### 7. **faq.html** (PREGUNTAS FRECUENTES)
**¿Qué es?** Centro de ayuda con preguntas
**Accesible:** Todos

**Categorías:**
- El sistema
- Pagos
- Mascotas
- Privacidad

---

### 8. **whatsapp.html** (SOPORTE VÍA WHATSAPP)
**¿Qué es?** Redirección a WhatsApp business
**Acción:** Abre WhatsApp con soporte

---

### 9. **404.html** (PÁGINA NO ENCONTRADA)
**Mostrada:** Si el usuario accede a URL inválida

---

## 🔐 Lógica de Autenticación

```javascript
// En petcare-core.js

Auth.login({contacto, password})
  ├─ Conecta a Supabase
  ├─ Valida credenciales
  ├─ Guarda sesión en Supabase
  └─ Redirige a dashboard.html

Auth.register({nombre, contacto, password, nombreMascota, especie})
  ├─ Conecta a Supabase
  ├─ Crea usuario
  ├─ Crea mascota asociada
  ├─ Guarda sesión
  └─ Redirige a dashboard.html

Auth.requireAuth('pagina.html')
  ├─ Verifica si hay sesión activa
  ├─ Si NO hay sesión → redirige a auth.html
  └─ Si hay sesión → permite acceso
```

---

## 🧠 Cómo Funciona el Análisis IA

### Flujo:
1. Usuario rellena consulta (paso 1-3)
2. Click "Continuar" en Paso 3
3. Se activa `Analisis.analizar({...datos...})`
4. Envía prompts a Claude API (Anthropic)
5. Claude responde con JSON estructurado
6. Se muestra resultado en Paso 4
7. Se guarda en Supabase

### Prompt Mejorado (IMPORTANTE):
El prompt en `petcare-core.js` ahora:
- ✅ Analiza ESPECÍFICAMENTE los síntomas mencionados
- ✅ NO inventa síntomas adicionales
- ✅ Recomendaciones RELEVANTES al síntoma exacto
- ✅ Nunca productos genéricos (ej: pasta dental para caída de pelo)
- ✅ Estructura clara de JSON

---

## 📱 Responsividad

Todas las páginas son **responsive**:
- Desktop (1200px+): Navbar completo
- Tablet (768-1199px): Hamburger menu
- Mobile (< 768px): Interfaz adaptada

---

## 🗺️ Resumen de Rutas

| Página | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| Inicio | `/index.html` | Todos | Landing page |
| Auth | `/auth.html` | Todos | Login/Registro |
| Dashboard | `/dashboard.html` | Logueados | Mi cuenta |
| Consulta | `/consulta.html` | Logueados | Formulario IA |
| Config | `/configuracion.html` | Logueados | Configuración |
| Pagos | `/pagos.html` | Todos | Precios |
| FAQ | `/faq.html` | Todos | Ayuda |
| WhatsApp | `/whatsapp.html` | Todos | Soporte |
| 404 | `/404.html` | Todos | Error |

---

## ✅ Mejoras Implementadas

### 1. **Autenticación Clara**
- ✅ Nueva página `auth.html` con login/registro unificado
- ✅ Flujo claro sin confusión

### 2. **IA Mejorada**
- ✅ Prompt más específico y preciso en Claude
- ✅ Análisis relevante al síntoma exacto
- ✅ Productos recomendados correctos

### 3. **Navegación Conectada**
- ✅ Botones CTA apuntan a auth.html
- ✅ Flujo lógico: Inicio → Auth → Consulta → Resultado
- ✅ Links en navbar funcionan en todas partes

### 4. **Estructura Ordenada**
- ✅ Cada página tiene un propósito claro
- ✅ Jerarquía lógica
- ✅ Páginas solo accesibles si corresponde

---

## 🚀 Próximos Pasos

1. **Deploy los nuevos archivos** a Render
2. **Probar flujo completo**: Inicio → Auth → Consulta → Resultado
3. **Validar IA**: Crear consulta con síntoma específico y verificar recomendaciones
4. **Integrar pagos**: Activar Culqi en pagos.html
5. **Optimizar prompts**: Ajustar según feedback de consultas

---

## 📞 Soporte

Si hay problemas:
1. Revisar consola de navegador (DevTools)
2. Checar Supabase logs
3. Revisar Anthropic API usage
4. Verificar URLs en navegación

