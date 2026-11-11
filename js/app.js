/* Reportes de errores · lógica de la página
 * Dos "motores" con la misma interfaz:
 *   - apiSupabase(): base compartida (Postgres + Storage + Auth + Realtime).
 *   - apiDemo():     todo en localStorage, para probar sin configurar nada.
 */
(() => {
'use strict';

/* ───────────── Configuración y constantes ───────────── */

const DEF = {
  nombreServidor: 'Reportes de errores', descripcion: '',
  supabaseUrl: '', supabaseAnonKey: '', bucket: 'capturas',
  maxFotos: 6, maxMBporFoto: 5, esperaEntreReportes: 60, enlaceDiscord: '',
  dominioCuentas: 'jugadores.example.com',
  categorias: [{ id: 'otro', nombre: 'Otro' }],
};
const CFG = Object.assign({}, DEF, window.REPORTES_CONFIG || {});
if (!Array.isArray(CFG.categorias) || !CFG.categorias.length) CFG.categorias = DEF.categorias.slice();
if (!CFG.categorias.some(c => c.id === 'otro')) CFG.categorias.push({ id: 'otro', nombre: 'Otro' });

const ESTADOS = {
  pendiente:   { nombre: 'Pendiente' },
  en_progreso: { nombre: 'En progreso' },
  arreglado:   { nombre: 'Arreglado' },
  descartado:  { nombre: 'Descartado' },
};
const LISTA_ESTADOS = Object.keys(ESTADOS);
const ABIERTOS = ['pendiente', 'en_progreso'];
const GRAVEDADES = {
  baja:    { nombre: 'Baja',    peso: 1 },
  media:   { nombre: 'Media',   peso: 2 },
  alta:    { nombre: 'Alta',    peso: 3 },
  critica: { nombre: 'Crítica', peso: 4 },
};
const PESTANAS = {
  abiertos:    { nombre: 'Abiertos',    estados: ABIERTOS },
  arreglados:  { nombre: 'Arreglados',  estados: ['arreglado'] },
  descartados: { nombre: 'Descartados', estados: ['descartado'] },
  todos:       { nombre: 'Todos',       estados: LISTA_ESTADOS },
  mios:        { nombre: 'Mis reportes', estados: LISTA_ESTADOS, mios: true },
};
const PESTANA_DE_ESTADO = { pendiente: 'abiertos', en_progreso: 'abiertos', arreglado: 'arreglados', descartado: 'descartados' };
const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' };

/* Iconos Lucide (ISC). class="f" = relleno suave del segundo tono. */
const ICONOS = {
  bug: '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path class="f" d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
  mas: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCirculo: '<circle class="f" cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  buscar: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  imagen: '<rect class="f" width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  pulgar: '<path d="M7 10v12"/><path class="f" d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
  mensaje: '<path class="f" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>',
  escudo: '<path class="f" d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  bajar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  subir: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  lista: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  tablero: '<rect class="f" width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7v7"/><path d="M12 7v4"/><path d="M16 7v9"/>',
  pin: '<path class="f" d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  reloj: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  usuario: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle class="f" cx="12" cy="7" r="4"/>',
  basura: '<path d="M3 6h18"/><path class="f" d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  izq: '<path d="m15 18-6-6 6-6"/>',
  abajo: '<path d="m6 9 6 6 6-6"/>',
  der: '<path d="m9 18 6-6-6-6"/>',
  enlace: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  enviar: '<path class="f" d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  cargando: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  alerta: '<path class="f" d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle class="f" cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  paquete: '<path class="f" d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/>',
  auto: '<path class="f" d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  candado: '<rect class="f" width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  maletin: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect class="f" width="20" height="14" x="2" y="6" rx="2"/>',
  mira: '<circle class="f" cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>',
  monitor: '<rect class="f" width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  rayo: '<path class="f" d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  ayuda: '<circle class="f" cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  guardar: '<path class="f" d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[n] || ''}</svg>`;

/* ───────────── Utilidades ───────────── */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const normal = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
  : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
const vacioANull = v => { const t = String(v ?? '').trim(); return t ? t : null; };
const copia = o => JSON.parse(JSON.stringify(o));

const guardado = {
  leer(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  escribir(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  borrar(k) { try { localStorage.removeItem(k); } catch { /* nada */ } },
};

const ICONO_CAT = { items: 'paquete', personaje: 'usuario', vehiculos: 'auto', robos: 'candado', trabajos: 'maletin',
  combate: 'mira', interfaz: 'monitor', admin: 'escudo', rendimiento: 'rayo', otro: 'ayuda' };
const iconoCat = c => (c.icono && ICONOS[c.icono]) ? c.icono : (ICONO_CAT[c.id] || 'bug');
const nombreCat = id => (CFG.categorias.find(c => c.id === id) || { nombre: id || 'Otro' }).nombre;
const pesoGrav = g => (GRAVEDADES[g] || GRAVEDADES.media).peso;

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
function hace(fecha) {
  const s = (new Date(fecha) - Date.now()) / 1000;
  const abs = Math.abs(s);
  if (abs < 45) return 'recién';
  const pasos = [['minute', 60], ['hour', 3600], ['day', 86400], ['week', 604800], ['month', 2592000], ['year', 31536000]];
  let u = 'minute', d = 60;
  for (const [n, v] of pasos) if (abs >= v) { u = n; d = v; }
  return rtf.format(Math.round(s / d), u);
}
const fechaLarga = f => new Date(f).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' });

function toast(msg, tipo = 'info') {
  const cont = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast nuevo t-' + tipo;
  setTimeout(() => t.classList.remove('nuevo'), 250);
  t.innerHTML = ic(tipo === 'error' ? 'alerta' : tipo === 'ok' ? 'checkCirculo' : 'info') + '<span></span>';
  t.querySelector('span').textContent = msg;
  cont.append(t);
  // El contenedor es un popover: así queda por encima de los diálogos abiertos.
  if (cont.showPopover) { try { if (cont.matches(':popover-open')) cont.hidePopover(); cont.showPopover(); } catch { /* nada */ } }
  setTimeout(() => { t.classList.add('fuera'); setTimeout(() => t.remove(), 260); }, tipo === 'error' ? 6000 : 3800);
}

function pillEstado(e) {
  const est = ESTADOS[e] ? e : 'pendiente';
  return `<span class="pill est est-${est}"><span class="punto"></span>${ESTADOS[est].nombre}</span>`;
}
function pillGrav(g) {
  const gr = GRAVEDADES[g] ? g : 'media';
  return `<span class="pill grav grav-${gr}" title="Gravedad">${GRAVEDADES[gr].nombre}</span>`;
}

function traducirError(err) {
  const m = String(err && (err.message || err.error_description || err.error) || err || '');
  if (/Invalid login credentials/i.test(m)) return 'Usuario o contraseña incorrectos.';
  if (/Email not confirmed/i.test(m)) return 'La cuenta no está confirmada: apagá "Confirm email" en Supabase (ver LEEME).';
  if (/already registered|already exists|User already|perfiles_usuario_idx|Database error saving new user/i.test(m)) return 'Ese nombre de usuario ya existe. Probá con otro.';
  if (/Password should be|password.*(short|least)/i.test(m)) return 'La contraseña tiene que tener al menos 6 caracteres.';
  if (/Signups not allowed|signup.*disabled/i.test(m)) return 'El registro de cuentas está apagado en Supabase (ver LEEME).';
  if (/Email address .* is invalid|invalid.*email/i.test(m)) return 'Supabase no acepta el dominio de las cuentas: cambiá "dominioCuentas" en js/config.js (ver LEEME).';
  if (/Necesitás una cuenta/i.test(m)) return 'Necesitás una cuenta para hacer eso.';
  if (/row-level security|violates|permission denied|JWT/i.test(m)) return 'No tenés permiso para hacer eso (revisá que seas admin).';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'No hay conexión con la base de datos. Probá de nuevo en un rato.';
  if (/exceeded the maximum allowed size|Payload too large|413/i.test(m)) return 'Una de las imágenes es demasiado pesada.';
  if (/mime type|invalid_mime/i.test(m)) return 'Ese tipo de archivo no se puede subir.';
  if (/check constraint/i.test(m)) return 'Algún dato no es válido (muy largo o vacío).';
  if (/PGRST116|0 rows/i.test(m)) return 'Ese reporte ya no existe o no tenés permiso.';
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Esperá un poco.';
  return m || 'Algo salió mal.';
}

/* Imágenes: se achican en el navegador antes de subirse. */
function cargarImagen(file) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error(`No se pudo leer "${file.name || 'la imagen'}".`)); };
    img.src = url;
  });
}
const aBlob = (cv, tipo, q) => new Promise(r => cv.toBlob(r, tipo, q));
async function comprimir(file, maxLado, calidad) {
  const limite = CFG.maxMBporFoto * 1048576;
  if (!/^image\//.test(file.type)) throw new Error(`"${file.name}" no es una imagen.`);
  if (file.type === 'image/gif') {
    if (file.size > limite) throw new Error(`El GIF "${file.name}" pesa más de ${CFG.maxMBporFoto} MB.`);
    return file;
  }
  const img = await cargarImagen(file);
  const f = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * f));
  const h = Math.max(1, Math.round(img.naturalHeight * f));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#000'; cx.fillRect(0, 0, w, h);
  cx.drawImage(img, 0, 0, w, h);
  let blob = await aBlob(cv, 'image/webp', calidad);
  if (!blob || blob.type !== 'image/webp') blob = await aBlob(cv, 'image/jpeg', calidad);
  if (!blob) throw new Error('No se pudo procesar la imagen.');
  if (f === 1 && EXT[file.type] && file.size <= blob.size && file.size <= limite) return file;
  if (blob.size > limite) throw new Error(`"${file.name}" sigue pesando demasiado después de achicarla.`);
  return blob;
}
const blobADataURL = b => new Promise((ok, mal) => {
  const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => mal(r.error); r.readAsDataURL(b);
});
const pesoLegible = n => n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB';

/* ───────────── Cuentas ───────────── */

const sesionVacia = () => ({ id: null, usuario: null, admin: false });
const USUARIO_OK = /^[A-Za-z0-9_.-]{3,20}$/;
// Supabase necesita un mail: el usuario se convierte en "usuario@dominio" (no se manda ningún correo).
// Si escriben un mail completo (por ejemplo, una cuenta vieja), se usa tal cual.
const usuarioAEmail = u => {
  const t = String(u || '').trim();
  return t.includes('@') ? t.toLowerCase() : `${t.toLowerCase()}@${CFG.dominioCuentas}`;
};
async function hashDemo(texto) {
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('reportes:' + texto));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  } catch { return 'plano:' + texto; }
}

/* ───────────── Motor: Supabase ───────────── */

function apiSupabase() {
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  const bucket = () => sb.storage.from(CFG.bucket);
  const sesion = sesionVacia();
  const falla = (error, donde) => { if (error) { console.error('[reportes]', donde, error); throw new Error(traducirError(error)); } };

  async function chequearAdmin() {
    const { data, error } = await sb.rpc('es_admin');
    if (error) { console.warn('[reportes] es_admin', error); return false; }
    return data === true;
  }
  async function cargarSesion(user) {
    Object.assign(sesion, sesionVacia());
    if (!user) return;
    sesion.id = user.id;
    sesion.usuario = (user.user_metadata && user.user_metadata.usuario) || String(user.email || '').split('@')[0];
    const { data } = await sb.from('perfiles').select('usuario').eq('id', user.id).maybeSingle();
    if (data && data.usuario) sesion.usuario = data.usuario;
    sesion.admin = await chequearAdmin();
  }

  return {
    modo: 'supabase', sesion,
    async iniciar() {
      const { data } = await sb.auth.getSession();
      await cargarSesion(data && data.session ? data.session.user : null);
    },
    async entrar(usuario, clave) {
      const { data, error } = await sb.auth.signInWithPassword({ email: usuarioAEmail(usuario), password: clave });
      falla(error, 'entrar');
      await cargarSesion(data.user);
    },
    async registrar(usuario, clave) {
      const { data, error } = await sb.auth.signUp({ email: usuarioAEmail(usuario), password: clave, options: { data: { usuario } } });
      falla(error, 'registrar');
      if (!data.session) {
        throw new Error('La cuenta se creó, pero Supabase pide confirmar el mail. Apagá "Confirm email" en Authentication (ver LEEME).');
      }
      await cargarSesion(data.user);
    },
    async salir() { await sb.auth.signOut(); Object.assign(sesion, sesionVacia()); },
    async misVotos() {
      if (!sesion.id) return [];
      const { data, error } = await sb.from('votos').select('reporte_id').eq('user_id', sesion.id);
      if (error) { console.warn('[reportes] votos', error); return []; }
      return (data || []).map(v => v.reporte_id);
    },
    async listar() {
      const { data, error } = await sb.from('reportes').select('*').order('creado', { ascending: false }).limit(3000);
      falla(error, 'listar'); return data || [];
    },
    async crear(datos, archivos, alAvanzar) {
      const fotos = [];
      const hoy = new Date();
      const carpeta = `reportes/${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
      for (const b of archivos) {
        const ruta = `${carpeta}/${uid()}.${EXT[b.type] || 'jpg'}`;
        const { error } = await bucket().upload(ruta, b, { contentType: b.type, cacheControl: '31536000', upsert: false });
        falla(error, 'subir foto');
        fotos.push(ruta);
        alAvanzar && alAvanzar(fotos.length);
      }
      const { data, error } = await sb.from('reportes').insert({ ...datos, fotos, user_id: sesion.id, autor: sesion.usuario }).select().single();
      falla(error, 'crear'); return data;
    },
    async actualizar(id, cambios) {
      const { data, error } = await sb.from('reportes').update(cambios).eq('id', id).select().single();
      falla(error, 'actualizar'); return data;
    },
    async eliminar(r) {
      const rutas = (r.fotos || []).filter(f => !/^(https?:|data:)/.test(f));
      if (rutas.length) { const { error } = await bucket().remove(rutas); if (error) console.warn('[reportes] borrar fotos', error); }
      const { error } = await sb.from('reportes').delete().eq('id', r.id);
      falla(error, 'eliminar');
    },
    async votar(id) {
      const { data, error } = await sb.rpc('votar', { p_id: id });
      falla(error, 'votar'); return data;
    },
    async comentarios(id) {
      const { data, error } = await sb.from('comentarios').select('*').eq('reporte_id', id).order('creado', { ascending: true });
      falla(error, 'comentarios'); return data || [];
    },
    async comentar(id, texto) {
      const { data, error } = await sb.from('comentarios')
        .insert({ reporte_id: id, autor: sesion.usuario, texto }).select().single();
      falla(error, 'comentar'); return data;
    },
    async borrarComentario(c) {
      const { error } = await sb.from('comentarios').delete().eq('id', c.id);
      falla(error, 'borrar comentario');
    },
    async importar(filas) {
      let n = 0;
      for (let i = 0; i < filas.length; i += 200) {
        const parte = filas.slice(i, i + 200);
        const { error } = await sb.from('reportes').insert(parte);
        falla(error, 'importar'); n += parte.length;
      }
      return n;
    },
    urlFoto(ruta) {
      if (/^data:image\//.test(ruta)) return ruta;
      return bucket().getPublicUrl(ruta).data.publicUrl;
    },
    escuchar(cb) {
      sb.channel('reportes-cambios')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reportes' }, p => cb(p.eventType, p.new, p.old))
        .subscribe((estado, err) => {
          if (estado === 'SUBSCRIBED') console.info('[reportes] tiempo real conectado');
          else if (estado !== 'CLOSED') console.warn('[reportes] tiempo real:', estado, err || '');
        });
    },
  };
}

/* ───────────── Motor: demo (localStorage) ───────────── */

function semillaDemo() {
  const dia = (d, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();
  const base = (o) => Object.assign({
    categoria: 'otro', gravedad: 'media', donde: null, esperado: null, pasos: null, notas: null, autor: null,
    fotos: [], estado: 'pendiente', respuesta: null, votos: 0, n_comentarios: 0, cerrado: null,
  }, o, { actualizado: o.actualizado || o.creado });
  return [
    base({ id: 1, creado: dia(1, 5), titulo: 'Traducción de objetos', categoria: 'items', donde: 'Items', sucede: 'Varios items aparecen con el nombre en inglés.', esperado: 'Que estén en español.', votos: 4, autor: 'Facu' }),
    base({ id: 2, creado: dia(1, 4), titulo: 'Limitar la tipografía en los nombres', categoria: 'personaje', gravedad: 'baja', donde: 'En la creación de personaje', sucede: 'Acepta cualquier tipografía (letras raras, símbolos).', esperado: 'Una única tipografía.', votos: 1 }),
    base({ id: 3, creado: dia(1, 4), titulo: 'Crash con el Tx', categoria: 'admin', gravedad: 'critica', donde: 'Al usar tx (apartado admin)', sucede: 'El juego se cierra al abrir el menú de admin.', estado: 'en_progreso', votos: 6, respuesta: 'Lo estamos revisando con los logs del cliente.' }),
    base({ id: 4, creado: dia(1, 3), titulo: 'Uñas no visibles para el resto de los jugadores', categoria: 'personaje', donde: 'Al hacer las uñas en la creación', sucede: 'Solo las ve uno mismo.', esperado: 'Que las vea todo el mundo.', votos: 2 }),
    base({ id: 5, creado: dia(1, 3), titulo: 'Golpe one shot con la mano', categoria: 'combate', gravedad: 'alta', donde: 'Agachado y de espalda a cualquier jugador', sucede: 'Un golpe de puño lo deja tirado.', esperado: 'No debería hacer one shot.', pasos: '1. Agacharse detrás de alguien.\n2. Pegarle una piña.', votos: 3 }),
    base({ id: 6, creado: dia(1, 2), titulo: 'Reproductor de YouTube', categoria: 'interfaz', donde: 'En el inicio del personaje (entrada)', sucede: 'No reproduce la música.', esperado: 'Debería poner la música.', notas: 'No lo pude hacer andar ni con otro link.' }),
    base({ id: 7, creado: dia(1, 2), titulo: 'Bolsos vacíos', categoria: 'items', gravedad: 'baja', donde: 'En general', sucede: 'Se quedan en el piso para siempre.', esperado: 'Deberían desaparecer los bolsos vacíos.', estado: 'arreglado', cerrado: dia(0, 3), actualizado: dia(0, 3), respuesta: 'Ahora se borran solos a los 5 minutos de quedar vacíos.', votos: 5 }),
    base({ id: 8, creado: dia(1, 1), titulo: 'CHOP CHOP', categoria: 'trabajos', gravedad: 'baja', donde: 'Chop chop (t20)', sucede: 'Se pueden sacar las puertas antes de terminar.', esperado: 'Poder sacar las puertas recién al final.', estado: 'descartado', cerrado: dia(0, 2), actualizado: dia(0, 2), respuesta: 'Es así a propósito: las puertas se venden aparte.' }),
    base({ id: 9, creado: dia(0, 6), titulo: 'Bug de caja fuerte', categoria: 'robos', gravedad: 'alta', donde: 'Tienda 24/7', sucede: 'Hay que interactuar varias veces y a veces no da nada.', esperado: 'Hacer el robo una sola vez y que pague.', votos: 2 }),
  ].map((r, i) => Object.assign(r, { autor: r.autor || ['Lauti', 'Mica', 'Santi', 'Juli', 'Tomi', 'Facu', 'Mica', 'Lauti'][i % 8] }));
}

function apiDemo() {
  const K = 'reportes_demo_v1', KC = 'reportes_demo_comentarios_v1', KU = 'reportes_demo_usuarios_v1', KS = 'reportes_demo_sesion';
  let db = guardado.leer(K, null);
  if (!db || !Array.isArray(db.reportes)) { db = { sig: 10, reportes: semillaDemo() }; guardado.escribir(K, db); }
  if (!Array.isArray(db.votos)) db.votos = [];
  let com = guardado.leer(KC, { sig: 1, lista: [] });
  // Cuenta de prueba: "admin" / "admin123" es administrador.
  let cuentas = guardado.leer(KU, null);
  const sesion = sesionVacia();

  const recargar = () => { db = guardado.leer(K, db); if (!Array.isArray(db.votos)) db.votos = []; com = guardado.leer(KC, com); cuentas = guardado.leer(KU, cuentas); };
  const guardar = () => {
    if (!guardado.escribir(K, db)) throw new Error('El navegador se quedó sin espacio para el modo demo. Borrá reportes con fotos.');
    guardado.escribir(KC, com);
    guardado.escribir(KU, cuentas);
  };
  const usar = c => { Object.assign(sesion, { id: c.id, usuario: c.usuario, admin: !!c.admin }); guardado.escribir(KS, c.id); };
  const canal = 'BroadcastChannel' in window ? new BroadcastChannel('reportes_demo') : null;
  let oyente = null;
  if (canal) canal.onmessage = e => { recargar(); oyente && oyente(e.data.tipo, e.data.nuevo, e.data.viejo); };
  const avisar = (tipo, nuevo, viejo) => canal && canal.postMessage({ tipo, nuevo, viejo });
  const espera = (ms = 180) => new Promise(r => setTimeout(r, ms));
  const buscar = id => db.reportes.find(r => r.id === id);
  const sello = (r, cambios) => {
    const antes = r.estado;
    Object.assign(r, cambios);
    if (cambios.estado && cambios.estado !== antes) r.cerrado = ABIERTOS.includes(r.estado) ? null : new Date().toISOString();
    if (['estado', 'respuesta', 'titulo', 'categoria', 'gravedad'].some(k => k in cambios)) r.actualizado = new Date().toISOString();
  };

  return {
    modo: 'demo', sesion,
    async iniciar() {
      if (!cuentas) { cuentas = { admin: { id: 'demo-admin', usuario: 'admin', hash: await hashDemo('admin123'), admin: true } }; guardado.escribir(KU, cuentas); }
      const id = guardado.leer(KS, null);
      const c = id && Object.values(cuentas).find(x => x.id === id);
      if (c) usar(c);
    },
    async entrar(usuario, clave) {
      recargar(); await espera(250);
      const c = cuentas[String(usuario).trim().toLowerCase()];
      if (!c || c.hash !== await hashDemo(clave)) throw new Error('Usuario o contraseña incorrectos.');
      usar(c);
    },
    async registrar(usuario, clave) {
      recargar(); await espera(300);
      const k = usuario.toLowerCase();
      if (cuentas[k]) throw new Error('Ese nombre de usuario ya existe. Probá con otro.');
      const c = { id: 'demo-' + uid(), usuario, hash: await hashDemo(clave), admin: false };
      cuentas[k] = c; guardar(); usar(c);
    },
    async salir() { Object.assign(sesion, sesionVacia()); guardado.borrar(KS); },
    async misVotos() {
      recargar();
      return db.votos.filter(v => v.startsWith(sesion.id + ':')).map(v => Number(v.split(':').pop()));
    },
    async listar() { recargar(); await espera(250); return copia(db.reportes); },
    async crear(datos, archivos, alAvanzar) {
      recargar();
      const fotos = [];
      for (const b of archivos) { fotos.push(await blobADataURL(b)); alAvanzar && alAvanzar(fotos.length); await espera(120); }
      const ahora = new Date().toISOString();
      if (!sesion.id) throw new Error('Necesitás una cuenta para reportar.');
      const r = Object.assign({ donde: null, esperado: null, pasos: null, notas: null }, datos, {
        id: db.sig++, creado: ahora, actualizado: ahora, fotos, estado: 'pendiente',
        user_id: sesion.id, autor: sesion.usuario,
        respuesta: null, votos: 0, n_comentarios: 0, cerrado: null,
      });
      db.reportes.unshift(r); guardar(); avisar('INSERT', r);
      return copia(r);
    },
    async actualizar(id, cambios) {
      recargar(); await espera();
      const r = buscar(id); if (!r) throw new Error('Ese reporte ya no existe.');
      if (!sesion.admin) throw new Error('No tenés permiso para hacer eso.');
      sello(r, cambios); guardar(); avisar('UPDATE', r);
      return copia(r);
    },
    async eliminar(rep) {
      recargar(); await espera();
      db.reportes = db.reportes.filter(r => r.id !== rep.id);
      com.lista = com.lista.filter(c => c.reporte_id !== rep.id);
      guardar(); avisar('DELETE', null, { id: rep.id });
    },
    async votar(id) {
      recargar(); await espera(120);
      const r = buscar(id); if (!r) throw new Error('Ese reporte ya no existe.');
      if (!sesion.id) throw new Error('Necesitás una cuenta para votar.');
      const clave = sesion.id + ':' + id;
      if (!db.votos.includes(clave) && ABIERTOS.includes(r.estado)) {
        db.votos.push(clave); r.votos = (r.votos || 0) + 1; guardar(); avisar('UPDATE', r);
      }
      return r.votos;
    },
    async comentarios(id) { recargar(); await espera(120); return copia(com.lista.filter(c => c.reporte_id === id)); },
    async comentar(id, texto) {
      recargar(); await espera(150);
      if (!sesion.id) throw new Error('Necesitás una cuenta para comentar.');
      const c = { id: com.sig++, reporte_id: id, user_id: sesion.id, autor: sesion.usuario, texto, es_admin: sesion.admin, creado: new Date().toISOString() };
      com.lista.push(c);
      const r = buscar(id); if (r) r.n_comentarios = (r.n_comentarios || 0) + 1;
      guardar(); if (r) avisar('UPDATE', r);
      return copia(c);
    },
    async borrarComentario(c) {
      recargar(); await espera(120);
      com.lista = com.lista.filter(x => x.id !== c.id);
      const r = buscar(c.reporte_id); if (r) r.n_comentarios = Math.max(0, (r.n_comentarios || 1) - 1);
      guardar(); if (r) avisar('UPDATE', r);
    },
    async importar(filas) {
      recargar(); await espera();
      for (const f of filas) {
        db.reportes.push(Object.assign({ fotos: [], votos: 0, n_comentarios: 0, respuesta: null }, f, {
          id: db.sig++, actualizado: f.creado, cerrado: ABIERTOS.includes(f.estado) ? null : f.creado,
        }));
      }
      guardar(); return filas.length;
    },
    urlFoto(ruta) { return ruta; },
    escuchar(cb) { oyente = cb; },
  };
}

/* ───────────── Estado de la página ───────────── */

const E = {
  api: null,
  reportes: [],
  cargando: true,
  error: null,
  pestana: PESTANAS[guardado.leer('rep_pestana', 'abiertos')] ? guardado.leer('rep_pestana', 'abiertos') : 'abiertos',
  vista: guardado.leer('rep_vista', 'lista') === 'tablero' ? 'tablero' : 'lista',
  busqueda: '', cat: '', grav: '', orden: 'recientes',
  abierto: null,      // id del reporte en el detalle
  recien: null,       // id a resaltar después de moverse
  fotosNuevas: [],    // { id, blob, url, procesando }
};
let misVotos = new Set();
const votados = () => misVotos;
const marcarVotado = id => misVotos.add(id);
const enPestana = r => PESTANAS[E.pestana].estados.includes(r.estado)
  && (!PESTANAS[E.pestana].mios || (E.api.sesion.id && r.user_id === E.api.sesion.id));
const buscar = id => E.reportes.find(r => r.id === id);

/* ───────────── Filtros y orden ───────────── */

function coincide(r) {
  if (E.cat && r.categoria !== E.cat) return false;
  if (E.grav && r.gravedad !== E.grav) return false;
  const q = normal(E.busqueda.trim());
  if (!q) return true;
  if (/^#?\d+$/.test(q)) return String(r.id) === q.replace('#', '');
  const texto = normal([r.titulo, r.donde, r.sucede, r.esperado, r.pasos, r.notas, r.autor, r.respuesta, nombreCat(r.categoria)].join(' '));
  return q.split(/\s+/).every(p => texto.includes(p));
}
function ordenar(lista) {
  const fecha = k => r => new Date(r[k]).getTime() || 0;
  const creado = fecha('creado'), act = fecha('actualizado');
  const f = {
    recientes: (a, b) => creado(b) - creado(a),
    antiguos: (a, b) => creado(a) - creado(b),
    votos: (a, b) => (b.votos || 0) - (a.votos || 0) || creado(b) - creado(a),
    gravedad: (a, b) => pesoGrav(b.gravedad) - pesoGrav(a.gravedad) || creado(b) - creado(a),
    actualizados: (a, b) => act(b) - act(a),
  };
  return [...lista].sort(f[E.orden] || f.recientes);
}

/* ───────────── Pintado ───────────── */

function pintarIconos(raiz = document) {
  $$('[data-icono]', raiz).forEach(el => {
    const tmp = document.createElement('span');
    tmp.innerHTML = ic(el.dataset.icono);
    el.replaceWith(tmp.firstChild);
  });
}

function render() {
  renderConteos();
  if (!E.cargando) renderLateral();
  $('#lista').hidden = E.vista !== 'lista';
  $('#tablero').hidden = E.vista !== 'tablero';
  $('#pestanas').hidden = E.vista === 'tablero';
  $$('.vistas button').forEach(b => b.classList.toggle('activa', b.dataset.vista === E.vista));
  if (E.vista === 'lista') renderLista(); else renderTablero();
}

function renderConteos() {
  const n = {}; LISTA_ESTADOS.forEach(e => n[e] = 0);
  E.reportes.forEach(r => { if (n[r.estado] != null) n[r.estado]++; });
  LISTA_ESTADOS.forEach(e => contar($('#st' + e[0].toUpperCase() + e.slice(1)), n[e]));
  const semana = Date.now() - 7 * 86400000;
  const arrSemana = E.reportes.filter(r => r.estado === 'arreglado' && r.cerrado && new Date(r.cerrado) >= semana).length;
  $('#stSemana').textContent = arrSemana ? `${arrSemana} arreglado${arrSemana === 1 ? '' : 's'} esta semana` : 'Sin arreglos esta semana todavía';
  const validos = n.pendiente + n.en_progreso + n.arreglado;
  const porc = validos ? Math.round(n.arreglado / validos * 100) : 0;
  $('#stPorc').textContent = porc + '%';
  $('#stBarra').style.width = porc + '%';

  const nav = $('#pestanas');
  if (!nav.children.length) {
    nav.innerHTML = Object.entries(PESTANAS).map(([k, p]) =>
      `<button class="pestana" type="button" data-pestana="${k}">${p.nombre}<span class="cuenta" data-cuenta="${k}">0</span></button>`).join('');
  }
  const yo = E.api && E.api.sesion.id;
  if (!yo && E.pestana === 'mios') E.pestana = 'abiertos';
  Object.entries(PESTANAS).forEach(([k, p]) => {
    const total = p.mios ? E.reportes.filter(r => yo && r.user_id === yo).length : p.estados.reduce((s, e) => s + n[e], 0);
    $(`[data-cuenta="${k}"]`).textContent = total;
    const b = $(`.pestana[data-pestana="${k}"]`);
    b.classList.toggle('activa', k === E.pestana);
    if (p.mios) b.hidden = !yo;
  });
}

/* Número que sube/baja animado hasta el valor nuevo. */
function contar(el, n) {
  if (!el) return;
  const desde = Number(el.dataset.valor || 0);
  el.dataset.valor = n;
  if (desde === n) { el.textContent = n; return; }
  if (el.dataset.yaPinto) { el.classList.remove('cambia'); void el.offsetWidth; el.classList.add('cambia'); }
  el.dataset.yaPinto = '1';
  const t0 = performance.now(), dur = 600;
  const paso = t => {
    if (el.dataset.valor != n) return;
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(desde + (n - desde) * e);
    if (p < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

function pulsoPestana(k) {
  const c = $(`[data-cuenta="${k}"]`);
  if (!c) return;
  c.classList.remove('pulso'); void c.offsetWidth; c.classList.add('pulso');
}

function miniatura(r, clase) {
  const f = r.fotos && r.fotos[0];
  return f ? `<img class="${clase}" src="${esc(E.api.urlFoto(f))}" alt="" loading="lazy">`
           : (clase === 'mini' ? `<span class="mini vacia">${ic('bug')}</span>` : '');
}

/* Avatar con la inicial y un color fijo por nombre (el mismo jugador siempre tiene el mismo color). */
const TONOS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f97316', '#84cc16'];
function tono(nombre) {
  let h = 0;
  for (const ch of String(nombre || '?').toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONOS[h % TONOS.length];
}
function avatarHTML(nombre, clase = '') {
  const n = String(nombre || 'Anónimo').trim() || 'Anónimo';
  return `<span class="av ${clase}" style="--av:${tono(n)}" aria-hidden="true">${esc(n.charAt(0).toUpperCase())}</span>`;
}
const catDe = id => CFG.categorias.find(c => c.id === id) || { id, nombre: nombreCat(id) };

function filaHTML(r, i = 0) {
  const descartado = r.estado === 'descartado' ? ' est-descartado-txt' : '';
  const autor = r.autor || 'Anónimo';
  const foto = r.fotos && r.fotos[0];
  return `<div class="fila${E.recien === r.id ? ' recien' : ''}${E.llego === r.id ? ' llego' : ''}" style="--i:${Math.min(i, 14)}" data-id="${r.id}" tabindex="0" role="button" aria-label="Abrir reporte ${r.id}: ${esc(r.titulo)}, de ${esc(autor)}">
    ${avatarHTML(autor, 'av-fila')}
    <div class="fila-cuerpo">
      <div class="fila-tit"><span class="txt${descartado}">${esc(r.titulo)}</span></div>
      <div class="fila-sub">
        <span class="quien" title="Reportado por ${esc(autor)}"><b>${esc(autor)}</b></span>
        <span title="${esc(fechaLarga(r.creado))}"><i class="hace" data-hace="${esc(r.creado)}">${hace(r.creado)}</i></span>
        <span class="tema">${ic(iconoCat(catDe(r.categoria)))}${esc(nombreCat(r.categoria))}</span>
        ${r.donde ? `<span class="donde" title="${esc(r.donde)}">${ic('pin')}${esc(r.donde)}</span>` : ''}
        <span class="num">#${r.id}</span>
      </div>
    </div>
    <div class="fila-datos">
      ${foto ? `<span class="mini-foto" title="${r.fotos.length} foto${r.fotos.length === 1 ? '' : 's'}"><img src="${esc(E.api.urlFoto(foto))}" alt="" loading="lazy">${r.fotos.length > 1 ? `<b>+${r.fotos.length - 1}</b>` : ''}</span>` : ''}
      ${pillGrav(r.gravedad)}
      <span class="dato" title="A ${r.votos || 0} personas también les pasa">${ic('pulgar')}${r.votos || 0}</span>
      ${r.n_comentarios ? `<span class="dato" title="Comentarios">${ic('mensaje')}${r.n_comentarios}</span>` : ''}
      ${pillEstado(r.estado)}
    </div>
  </div>`;
}

/* Panel lateral: lo último que pasó y quiénes más reportan. Solo se repinta si cambió algo. */
let lateralPrevio = '';
const eventosVistos = new Set();
function renderLateral() {
  const ev = [];
  E.reportes.forEach(r => {
    ev.push({ t: r.creado, r, tipo: 'nuevo' });
    if (r.cerrado && !ABIERTOS.includes(r.estado)) ev.push({ t: r.cerrado, r, tipo: r.estado });
    else if (r.estado === 'en_progreso') ev.push({ t: r.actualizado || r.creado, r, tipo: 'en_progreso' });
  });
  ev.sort((a, b) => new Date(b.t) - new Date(a.t));
  const verbo = { nuevo: 'reportó', arreglado: 'arregló', descartado: 'descartó', en_progreso: 'está revisando' };
  const act = ev.slice(0, 7).map(e => {
    const staff = e.tipo !== 'nuevo';
    const quien = staff ? 'Staff' : (e.r.autor || 'Anónimo');
    const clave = e.tipo + ':' + e.r.id;
    const esNuevo = lateralPrevio && !eventosVistos.has(clave);
    eventosVistos.add(clave);
    return `<li data-id="${e.r.id}" tabindex="0" role="button" class="ev-${e.tipo}${esNuevo ? ' ev-llega' : ''}">
      ${staff ? `<span class="av av-staff est-${e.tipo}">${ic(e.tipo === 'arreglado' ? 'check' : e.tipo === 'descartado' ? 'x' : 'escudo')}</span>` : avatarHTML(quien)}
      <div><p><b>${esc(quien)}</b> ${verbo[e.tipo]} <span class="ev-tit">${esc(e.r.titulo)}</span></p>
      <small><i class="hace" data-hace="${esc(e.t)}">${hace(e.t)}</i> · #${e.r.id}</small></div>
    </li>`;
  }).join('') || '<li class="lat-vacio">Todavía no pasó nada. ¡Reportá el primero!</li>';

  const por = {};
  E.reportes.forEach(r => {
    if (!r.autor) return;
    const k = r.autor.toLowerCase();
    por[k] = por[k] || { nombre: r.autor, n: 0, arr: 0 };
    por[k].n++;
    if (r.estado === 'arreglado') por[k].arr++;
  });
  const top = Object.values(por).sort((a, b) => b.n - a.n || b.arr - a.arr).slice(0, 5);
  const max = top.length ? top[0].n : 1;
  const rank = top.map((p, i) => `<li style="--i:${i}">
      <span class="pos">${i + 1}</span>${avatarHTML(p.nombre)}
      <div class="rk-cuerpo"><b>${esc(p.nombre)}</b>
        <span class="barra-rk"><span style="width:${Math.round(p.n / max * 100)}%"></span></span></div>
      <span class="rk-n" title="${p.arr} arreglados">${p.n}<small>${p.arr ? ` · ${p.arr} ✓` : ''}</small></span>
    </li>`).join('') || '<li class="lat-vacio">Cuando la gente reporte, aparece acá.</li>';

  const html = (act + '§' + rank).replace(/ ev-llega/g, '');
  if (html === lateralPrevio) return;
  const primera = !lateralPrevio;
  lateralPrevio = html;
  $('#actividad').innerHTML = act;
  $('#ranking').innerHTML = rank;
  // Las animaciones de entrada solo la primera vez; después solo se anima lo nuevo.
  $('.lateral').classList.toggle('primera', primera);
}

function vacioHTML() {
  if (E.error) {
    return `<div class="vacio"><span class="insignia">${ic('alerta')}</span><b>No se pudieron cargar los reportes</b>${esc(E.error)}
      <div><button class="btn" type="button" id="btnReintentar">Reintentar</button></div></div>`;
  }
  const filtrando = E.busqueda || E.cat || E.grav;
  if (filtrando) {
    return `<div class="vacio"><span class="insignia">${ic('buscar')}</span><b>No hay reportes con esos filtros</b>Probá con otra búsqueda.
      <div><button class="btn" type="button" id="btnLimpiar">Limpiar filtros</button></div></div>`;
  }
  const textos = {
    abiertos: ['No hay errores abiertos', '¿Encontraste uno? Reportalo y el staff lo revisa.'],
    arreglados: ['Todavía no hay errores arreglados', 'Cuando el staff marque uno como arreglado, aparece acá solo.'],
    descartados: ['No hay reportes descartados', 'Acá van los que no eran un error o no se van a cambiar.'],
    todos: ['Todavía no hay reportes', 'Sé el primero en reportar un error.'],
    mios: ['Todavía no reportaste nada', 'Los errores que reportes aparecen acá para que sigas su estado.'],
  }[E.pestana];
  return `<div class="vacio"><span class="insignia">${ic('checkCirculo')}</span><b>${textos[0]}</b>${textos[1]}
    ${['abiertos', 'todos', 'mios'].includes(E.pestana) ? `<div><button class="btn principal" type="button" data-accion="nuevo">${ic('mas')}Reportar un error</button></div>` : ''}</div>`;
}

function renderLista() {
  const cont = $('#lista');
  if (E.cargando) { cont.innerHTML = '<div class="esqueleto"></div>'.repeat(5); return; }
  const visibles = ordenar(E.reportes.filter(r => enPestana(r) && coincide(r)));
  cont.classList.toggle('entrada', E.animar);
  cont.innerHTML = visibles.length && !E.error ? visibles.map(filaHTML).join('') : vacioHTML();
  E.animar = false;
}

function tarjetaHTML(r, i = 0) {
  return `<div class="tarjeta${E.recien === r.id ? ' recien' : ''}" style="--i:${Math.min(i, 10)}" data-id="${r.id}" tabindex="0" role="button" ${E.api.sesion.admin ? 'draggable="true"' : ''}>
    ${miniatura(r, '')}
    <div class="t"><span class="num">#${r.id}</span> ${esc(r.titulo)}</div>
    <div class="s quien-t">${avatarHTML(r.autor, 'av-chico')}<b>${esc(r.autor || 'Anónimo')}</b> · <i class="hace" data-hace="${esc(r.creado)}">${hace(r.creado)}</i></div>
    <div class="pie">${pillGrav(r.gravedad)}<span class="datos">
      <span class="dato">${ic('pulgar')}${r.votos || 0}</span>
      ${r.n_comentarios ? `<span class="dato">${ic('mensaje')}${r.n_comentarios}</span>` : ''}
    </span></div>
  </div>`;
}

function renderTablero() {
  const cont = $('#tablero');
  if (E.cargando) { cont.innerHTML = LISTA_ESTADOS.map(() => '<div class="columna"><div class="esqueleto"></div></div>').join(''); return; }
  if (E.error) { cont.innerHTML = `<div style="grid-column:1/-1">${vacioHTML()}</div>`; return; }
  const visibles = ordenar(E.reportes.filter(coincide));
  cont.classList.toggle('entrada', E.animar);
  E.animar = false;
  cont.innerHTML = LISTA_ESTADOS.map(e => {
    const de = visibles.filter(r => r.estado === e);
    return `<section class="columna" data-estado="${e}">
      <div class="col-cab"><span class="r est-${e}"><span class="punto"></span>${ESTADOS[e].nombre}</span><span class="cuenta">${de.length}</span></div>
      ${de.length ? de.map(tarjetaHTML).join('') : `<div class="col-vacia">${E.api.sesion.admin ? 'Arrastrá reportes acá' : 'Nada por acá'}</div>`}
    </section>`;
  }).join('');
}

/* Aplica un reporte nuevo o cambiado (propio o de otro) y anima el pase de sección. */
let timerSalida = null;
function aplicar(nuevo) {
  if (!nuevo || nuevo.id == null) return;
  const i = E.reportes.findIndex(r => r.id === nuevo.id);
  const viejo = i >= 0 ? E.reportes[i] : null;
  // El tiempo real repite los cambios que uno mismo acaba de hacer: si no cambió nada, no se redibuja (evita parpadeos).
  if (viejo && Object.keys(nuevo).every(k => JSON.stringify(nuevo[k]) === JSON.stringify(viejo[k]))) return;
  if (i >= 0) E.reportes[i] = Object.assign({}, viejo, nuevo); else E.reportes.unshift(nuevo);
  const cambioEstado = viejo && viejo.estado !== nuevo.estado;

  if (cambioEstado) {
    pulsoPestana(PESTANA_DE_ESTADO[nuevo.estado]);
    E.recien = nuevo.id;
    setTimeout(() => { if (E.recien === nuevo.id) { E.recien = null; $$(`.recien[data-id="${nuevo.id}"]`).forEach(el => el.classList.remove('recien')); } }, 1600);
  }
  const sale = cambioEstado && E.vista === 'lista' && !enPestana(E.reportes.find(r => r.id === nuevo.id));
  const el = sale && $(`#lista .fila[data-id="${nuevo.id}"]`);
  if (el) {
    el.classList.add('saliendo');
    renderConteos();
    clearTimeout(timerSalida);
    timerSalida = setTimeout(render, 330);
  } else {
    render();
  }
  if (E.abierto === nuevo.id) renderDetalle();
}
function quitar(id) {
  E.reportes = E.reportes.filter(r => r.id !== id);
  render();
  if (E.abierto === id) { $('#dlgDetalle').close(); toast(`El reporte #${id} fue eliminado.`, 'info'); }
}

function alCambiarRemoto(tipo, nuevo, viejo) {
  if (tipo === 'DELETE') { if (viejo && viejo.id != null && buscar(viejo.id)) quitar(viejo.id); return; }
  if (tipo === 'INSERT' && nuevo && !buscar(nuevo.id)) { E.reportes.unshift(nuevo); marcarLlegada(nuevo); render(); return; }
  if (nuevo && !buscar(nuevo.id)) { E.reportes.unshift(nuevo); render(); return; }
  aplicar(nuevo);
}

/* Un reporte nuevo de otra persona: destello en la lista y aviso. */
function marcarLlegada(r) {
  E.llego = r.id;
  setTimeout(() => { if (E.llego === r.id) E.llego = null; }, 1800);
  if (!E.api.sesion.id || r.user_id !== E.api.sesion.id) toast(`Nuevo reporte de ${r.autor || 'alguien'}: ${r.titulo}`, 'info');
}

/* Respaldo del tiempo real: cada 15 s (y al volver a la pestaña) trae la lista y aplica solo lo que cambió. */
let sincronizando = false;
async function sincronizar() {
  if (sincronizando || E.cargando || E.error || document.hidden || !E.api) return;
  sincronizando = true;
  try {
    const lista = await E.api.listar();
    const ids = new Set(lista.map(r => r.id));
    E.reportes.filter(r => !ids.has(r.id)).forEach(r => quitar(r.id));
    const nuevos = lista.filter(r => !buscar(r.id));
    if (nuevos.length) {
      nuevos.forEach(r => { E.reportes.unshift(r); marcarLlegada(r); });
      render();
    }
    lista.forEach(r => { if (!nuevos.includes(r)) aplicar(r); });
  } catch (e) { console.warn('[reportes] sincronizar', e); }
  finally { sincronizando = false; }
}

/* ───────────── Detalle ───────────── */

async function abrirDetalle(id) {
  const r = buscar(id);
  if (!r) { toast(`No existe el reporte #${id}.`, 'error'); limpiarHash(); return; }
  E.abierto = id;
  history.replaceState(null, '', '#r' + id);
  renderDetalle(true);
  const dlg = $('#dlgDetalle');
  if (!dlg.open) dlg.showModal();
  $('#detCuerpo').scrollTop = 0;
  cargarComentarios(id);
}

function renderDetalle(primeraVez = false) {
  const r = buscar(E.abierto);
  if (!r) return;
  const admin = E.api.sesion.admin;
  const cuerpo = $('#detCuerpo');
  // Conservar lo que se esté escribiendo si llega una actualización en vivo.
  const borradores = {};
  if (!primeraVez) ['admResp', 'comTexto', 'admTitulo', 'admGrav', 'admCat'].forEach(k => { const x = $('#' + k); if (x) borradores[k] = x.value; });
  const masAbierto = !primeraVez && $('#admMas') && $('#admMas').open;
  if (primeraVez) E.estadoElegido = null;
  const estadoElegido = E.estadoElegido || r.estado;
  const scroll = cuerpo.scrollTop;
  const comentariosPrevios = !primeraVez && $('#comLista') ? $('#comLista').innerHTML : null;

  $('#detPills').innerHTML = `<span class="num">#${r.id}</span>${pillEstado(r.estado)}${pillGrav(r.gravedad)}<span class="pill">${esc(nombreCat(r.categoria))}</span>`;

  const bloque = (titulo, texto, clase = '') => texto ? `<div class="bloque ${clase}"><h4>${titulo}</h4><p>${esc(texto)}</p></div>` : '';
  const yaVoto = votados().has(r.id);
  const abierto = ABIERTOS.includes(r.estado);
  const fotos = r.fotos || [];

  cuerpo.innerHTML = `
    <h2 class="det-tit">${esc(r.titulo)}</h2>
    <div class="det-meta">
      <span class="det-autor">${avatarHTML(r.autor, 'av-chico')}Reportado por <b>${esc(r.autor || 'Anónimo')}</b></span>
      <span title="${esc(fechaLarga(r.creado))}">${ic('reloj')}${hace(r.creado)}</span>
      ${r.cerrado ? `<span title="${esc(fechaLarga(r.cerrado))}">${ic('checkCirculo')}${r.estado === 'arreglado' ? 'Arreglado' : 'Cerrado'} ${hace(r.cerrado)}</span>` : ''}
    </div>

    ${r.respuesta ? `<div class="respuesta"><h4>${ic('escudo')}Respuesta del staff</h4><p>${esc(r.respuesta)}</p></div>` : ''}

    ${(() => {
      const b = (r.sucede !== r.titulo ? bloque('¿Qué sucede?', r.sucede, 'error') : '')
        + bloque('¿Qué debería pasar?', r.esperado) + bloque('¿Dónde ocurre?', r.donde)
        + bloque('Notas o preguntas', r.notas) + bloque('Pasos para reproducirlo', r.pasos, 'ancho');
      return b ? `<div class="bloques">${b}</div>` : '';
    })()}

    ${fotos.length ? `<h3 class="seccion">${ic('imagen')}Fotos y capturas<span class="cuenta">${fotos.length}</span></h3>
      <div class="galeria">${fotos.map((f, i) => `<button type="button" data-foto="${i}" aria-label="Ver foto ${i + 1}"><img src="${esc(E.api.urlFoto(f))}" alt="Captura ${i + 1}" loading="lazy"></button>`).join('')}</div>` : ''}

    <div class="det-acciones">
      <button class="btn ${yaVoto ? 'votado' : ''}" type="button" id="btnVotar" ${(yaVoto && E.api.sesion.id) || !abierto ? 'disabled' : ''}
        title="${abierto ? 'Sumá tu voto si a vos también te pasa' : 'El reporte está cerrado'}">
        ${ic('pulgar')}${yaVoto ? 'Ya votaste' : 'A mí también me pasa'} · ${r.votos || 0}</button>
      <button class="btn" type="button" id="btnCopiar">${ic('enlace')}Copiar enlace</button>
    </div>

    ${admin ? `
    <section class="admin-panel">
      <div class="segmento admin-estados" role="radiogroup" aria-label="Estado">${LISTA_ESTADOS.map(e =>
        `<button type="button" data-estado="${e}" class="est-${e}${estadoElegido === e ? ' activo' : ''}"><span class="punto"></span>${ESTADOS[e].nombre}</button>`).join('')}</div>
      <textarea class="campo" id="admResp" rows="2" maxlength="2000" placeholder="Respuesta pública (opcional). Ej.: Arreglado en la actualización del 10/11.">${esc(r.respuesta || '')}</textarea>
      <details class="admin-mas" id="admMas">
        <summary>${ic('der')}Editar título, gravedad o tema</summary>
        <div class="pila">
          <input class="campo" id="admTitulo" maxlength="120" value="${esc(r.titulo)}" aria-label="Título">
          <div class="dos">
            <select class="campo" id="admGrav" aria-label="Gravedad">${Object.entries(GRAVEDADES).map(([k, g]) => `<option value="${k}" ${r.gravedad === k ? 'selected' : ''}>Gravedad: ${g.nombre}</option>`).join('')}</select>
            <select class="campo" id="admCat" aria-label="Tema">${opcionesCategorias(r.categoria)}</select>
          </div>
          <button class="btn peligro chico" type="button" id="admBorrar">${ic('basura')}Eliminar reporte</button>
        </div>
      </details>
      <div class="admin-pie">
        <span class="ayuda" id="admNota">${notaEstado(r, estadoElegido)}</span>
        <button class="btn principal" type="button" id="admGuardar">${ic('guardar')}Guardar y cerrar</button>
      </div>
    </section>` : ''}

    <h3 class="seccion">${ic('mensaje')}Comentarios<span class="cuenta">${r.n_comentarios || 0}</span></h3>
    <div class="comentarios" id="comLista">${comentariosPrevios ?? '<p class="com-vacio">Cargando…</p>'}</div>
    ${E.api.sesion.id ? `
    <form class="com-form" id="comForm">
      ${avatarHTML(E.api.sesion.usuario, 'avatar')}
      <textarea class="campo" id="comTexto" rows="1" maxlength="1500" placeholder="${abierto ? 'Agregá un dato, si te sigue pasando…' : 'Comentar…'}" required></textarea>
      <button class="btn principal" type="submit" id="comEnviar">${ic('enviar')}Enviar</button>
    </form>` : `
    <div class="com-entrar"><span>Para comentar necesitás una cuenta.</span>
      <button class="btn" type="button" data-accion="entrar">${ic('usuario')}Entrar o crear cuenta</button></div>`}`;

  Object.entries(borradores).forEach(([k, v]) => { const x = $('#' + k); if (x) x.value = v; });
  if (masAbierto) $('#admMas').open = true;
  if (!primeraVez) cuerpo.scrollTop = scroll;
}

function notaEstado(r, elegido) {
  if (elegido === r.estado) return `Ahora: ${ESTADOS[r.estado].nombre}`;
  const seMueve = PESTANA_DE_ESTADO[elegido] !== PESTANA_DE_ESTADO[r.estado];
  return `Pasa a <b>${ESTADOS[elegido].nombre}</b>${seMueve ? ` y se mueve a ${PESTANAS[PESTANA_DE_ESTADO[elegido]].nombre}` : ''} al guardar`;
}

function elegirEstado(e) {
  const r = buscar(E.abierto);
  if (!r) return;
  E.estadoElegido = e;
  $$('.admin-estados [data-estado]').forEach(b => b.classList.toggle('activo', b.dataset.estado === e));
  $('#admNota').innerHTML = notaEstado(r, e);
}

function opcionesCategorias(sel) {
  const lista = CFG.categorias.slice();
  if (sel && !lista.some(c => c.id === sel)) lista.push({ id: sel, nombre: sel });
  return lista.map(c => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');
}

async function cargarComentarios(id) {
  try {
    const lista = await E.api.comentarios(id);
    if (E.abierto !== id) return;
    pintarComentarios(lista);
  } catch (e) {
    if (E.abierto === id && $('#comLista')) $('#comLista').innerHTML = `<p class="com-vacio">No se pudieron cargar los comentarios: ${esc(e.message)}</p>`;
  }
}
let comentariosActuales = [];
function pintarComentarios(lista) {
  comentariosActuales = lista;
  const cont = $('#comLista');
  if (!cont) return;
  if (!lista.length) { cont.innerHTML = '<p class="com-vacio">Todavía no hay comentarios.</p>'; return; }
  const admin = E.api.sesion.admin;
  cont.innerHTML = lista.map(c => `
    <div class="comentario${c.es_admin ? ' staff' : ''}">
      ${avatarHTML(c.autor, 'avatar')}
      <div class="com-cuerpo">
        <div class="com-cab"><b>${esc(c.autor || 'Anónimo')}</b>${c.es_admin ? '<span class="etq-staff">Staff</span>' : ''}
          <span title="${esc(fechaLarga(c.creado))}">${hace(c.creado)}</span>
          ${admin ? `<button class="btn icono chico" type="button" data-borrar-com="${c.id}" title="Borrar comentario">${ic('basura')}</button>` : ''}
        </div>
        <p class="com-texto">${esc(c.texto)}</p>
      </div>
    </div>`).join('');
}

/* ───────────── Acciones ───────────── */

async function cambiarEstado(id, nuevo) {
  const r = buscar(id);
  if (!r || r.estado === nuevo) return;
  $$('.admin-estados button').forEach(b => b.disabled = true);
  try {
    const act = await E.api.actualizar(id, { estado: nuevo });
    aplicar(act);
    const destino = PESTANAS[PESTANA_DE_ESTADO[nuevo]].nombre;
    const seMovio = PESTANA_DE_ESTADO[r.estado] !== PESTANA_DE_ESTADO[nuevo];
    toast(`#${id} → ${ESTADOS[nuevo].nombre}${seMovio ? ` · pasó a ${destino}` : ''}`, 'ok');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    $$('.admin-estados button').forEach(b => b.disabled = false);
  }
}

async function guardarAdmin() {
  const r = buscar(E.abierto);
  if (!r) return;
  const titulo = vacioANull($('#admTitulo').value);
  if (!titulo || titulo.length < 3) { toast('El título necesita al menos 3 letras.', 'error'); return; }
  const cambios = {};
  if (titulo !== r.titulo) cambios.titulo = titulo;
  const grav = $('#admGrav').value, cat = $('#admCat').value, resp = vacioANull($('#admResp').value);
  if (grav !== r.gravedad) cambios.gravedad = grav;
  if (cat !== r.categoria) cambios.categoria = cat;
  if (resp !== (r.respuesta || null)) cambios.respuesta = resp;
  const estado = E.estadoElegido || r.estado;
  if (estado !== r.estado) cambios.estado = estado;
  if (!Object.keys(cambios).length) { $('#dlgDetalle').close(); return; }
  const btn = $('#admGuardar'); btn.disabled = true;
  try {
    const act = await E.api.actualizar(r.id, cambios);
    $('#dlgDetalle').close();          // primero se cierra, después se ve cómo se mueve en la lista
    aplicar(act);
    const seMovio = cambios.estado && PESTANA_DE_ESTADO[r.estado] !== PESTANA_DE_ESTADO[cambios.estado];
    toast(cambios.estado
      ? `#${r.id} → ${ESTADOS[cambios.estado].nombre}${seMovio ? ` · pasó a ${PESTANAS[PESTANA_DE_ESTADO[cambios.estado]].nombre}` : ''}`
      : `#${r.id} guardado.`, 'ok');
  } catch (e) { toast(e.message, 'error'); }
  finally { const b = $('#admGuardar'); if (b) b.disabled = false; }
}

async function eliminarReporte() {
  const r = buscar(E.abierto);
  if (!r) return;
  const ok = await confirmar('¿Eliminar el reporte?', `Se borra "#${r.id} · ${r.titulo}" con sus fotos y comentarios. No se puede deshacer.`, 'Eliminar');
  if (!ok) return;
  try {
    await E.api.eliminar(r);
    $('#dlgDetalle').close();
    E.reportes = E.reportes.filter(x => x.id !== r.id);
    render();
    toast(`Reporte #${r.id} eliminado.`, 'ok');
  } catch (e) { toast(e.message, 'error'); }
}

async function votar() {
  const r = buscar(E.abierto);
  if (!r) return;
  if (!E.api.sesion.id) { pedirCuenta(votar, 'Para votar necesitás una cuenta. Se hace en 10 segundos.'); return; }
  if (votados().has(r.id)) return;
  const btn = $('#btnVotar'); btn.disabled = true;
  try {
    const n = await E.api.votar(r.id);
    marcarVotado(r.id);
    if (typeof n === 'number') aplicar(Object.assign({}, r, { votos: n })); else renderDetalle();
    toast('Gracias, sumaste tu voto.', 'ok');
  } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
}

async function enviarComentario(ev) {
  ev.preventDefault();
  const id = E.abierto;
  const texto = vacioANull($('#comTexto').value);
  if (!texto) { $('#comTexto').focus(); return; }
  const btn = $('#comEnviar'); btn.disabled = true;
  try {
    const c = await E.api.comentar(id, texto.slice(0, 1500));
    $('#comTexto').value = '';
    pintarComentarios(comentariosActuales.concat(c));
  } catch (e) { toast(e.message, 'error'); }
  finally { const b = $('#comEnviar'); if (b) b.disabled = false; }
}

async function borrarComentario(idCom) {
  const c = comentariosActuales.find(x => x.id === idCom);
  if (!c) return;
  if (!(await confirmar('¿Borrar el comentario?', `"${c.texto.slice(0, 120)}"`, 'Borrar'))) return;
  try {
    await E.api.borrarComentario(c);
    pintarComentarios(comentariosActuales.filter(x => x.id !== idCom));
  } catch (e) { toast(e.message, 'error'); }
}

function confirmar(titulo, texto, boton = 'Confirmar') {
  const dlg = $('#dlgConfirmar');
  $('#tituloConfirmar').textContent = titulo;
  $('#textoConfirmar').textContent = texto;
  $('#btnConfirmar').textContent = boton;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise(ok => dlg.addEventListener('close', () => ok(dlg.returnValue === 'si'), { once: true }));
}

/* ───────────── Visor de fotos ───────────── */

const visor = { fotos: [], i: 0 };
function abrirVisor(fotos, i) {
  visor.fotos = fotos; visor.i = i;
  pintarVisor();
  $('#dlgVisor').showModal();
}
function pintarVisor() {
  const url = E.api.urlFoto(visor.fotos[visor.i]);
  $('#visorImg').src = url;
  $('#visorCuenta').textContent = `${visor.i + 1} de ${visor.fotos.length}`;
  const a = $('#visorAbrir');
  a.hidden = url.startsWith('data:');
  a.href = url;
  $('#visorAnt').hidden = $('#visorSig').hidden = visor.fotos.length < 2;
}
function moverVisor(d) {
  if (visor.fotos.length < 2) return;
  visor.i = (visor.i + d + visor.fotos.length) % visor.fotos.length;
  pintarVisor();
}

/* ───────────── Formulario de reporte ───────────── */

const CAMPOS_BORRADOR = ['titulo', 'categoria', 'donde', 'sucede', 'esperado', 'pasos', 'notas'];

function abrirNuevo(pre) {
  if (pre instanceof Event) pre = null;
  if (!E.api.sesion.id) {
    pedirCuenta(() => abrirNuevo(pre), 'Para reportar necesitás una cuenta. Solo usuario y contraseña, se hace en 10 segundos.', 'crear');
    return;
  }
  const f = $('#formNuevo');
  f.hidden = false;
  $('#pasoListo').hidden = true;
  const b = guardado.leer('rep_borrador', null);
  if (b) {
    CAMPOS_BORRADOR.forEach(k => { if (b[k] != null && f[k]) f[k].value = b[k]; });
    if (b.gravedad && GRAVEDADES[b.gravedad]) f.querySelector(`input[name=gravedad][value=${b.gravedad}]`).checked = true;
    if (b.esperado || b.pasos || b.notas || (b.gravedad && b.gravedad !== 'media')) $('#masDetalles').open = true;
    $('#notaBorrador').textContent = 'Recuperamos tu borrador.';
  } else {
    $('#notaBorrador').textContent = '';
  }
  $('#comoQuien').textContent = E.api.sesion.usuario;
  // Viene del inicio rápido: título y tema ya elegidos, solo falta (si quiere) contar más.
  if (pre) {
    f.titulo.value = pre.titulo || f.titulo.value;
    if (pre.categoria) f.categoria.value = pre.categoria;
    $('#notaBorrador').textContent = '';
    guardarBorrador();
  }
  actualizarContadores();
  if (!$('#dlgNuevo').open) $('#dlgNuevo').showModal();
  $('#dlgNuevo .dlg-cuerpo').scrollTop = 0;
  setTimeout(() => (pre ? f.sucede : f.titulo).focus(), 30);
}

function guardarBorrador() {
  const f = $('#formNuevo');
  const b = {};
  CAMPOS_BORRADOR.forEach(k => b[k] = f[k].value);
  b.gravedad = (f.querySelector('input[name=gravedad]:checked') || {}).value;
  const algo = ['titulo', 'donde', 'sucede', 'esperado', 'pasos', 'notas'].some(k => b[k].trim());
  if (algo) guardado.escribir('rep_borrador', b); else guardado.borrar('rep_borrador');
}

function actualizarContadores() {
  const f = $('#formNuevo');
  $$('.contador', f).forEach(c => {
    const campo = f[c.dataset.para];
    c.textContent = `${campo.value.length}/${campo.maxLength}`;
  });
}

async function agregarFotos(archivos) {
  const lista = [...archivos].filter(a => a && /^image\//.test(a.type));
  if (!lista.length) { if (archivos.length) toast('Solo se pueden subir imágenes.', 'error'); return; }
  const lugar = CFG.maxFotos - E.fotosNuevas.length;
  if (lugar <= 0) { toast(`Máximo ${CFG.maxFotos} fotos por reporte.`, 'error'); return; }
  if (lista.length > lugar) toast(`Solo entran ${lugar} foto${lugar === 1 ? '' : 's'} más; las demás se ignoraron.`, 'info');
  const demo = E.api.modo === 'demo';
  for (const archivo of lista.slice(0, lugar)) {
    const item = { id: uid(), blob: null, url: URL.createObjectURL(archivo), procesando: true };
    E.fotosNuevas.push(item);
    pintarPrevias();
    try {
      item.blob = await comprimir(archivo, demo ? 1280 : 1920, demo ? 0.72 : 0.85);
      URL.revokeObjectURL(item.url);
      item.url = URL.createObjectURL(item.blob);
      item.procesando = false;
    } catch (e) {
      toast(e.message, 'error');
      URL.revokeObjectURL(item.url);
      E.fotosNuevas = E.fotosNuevas.filter(x => x !== item);
    }
    pintarPrevias();
  }
}

function pintarPrevias() {
  $('#previas').innerHTML = E.fotosNuevas.map(f => `
    <div class="previa${f.procesando ? ' procesando' : ''}">
      <img src="${f.url}" alt="">
      ${f.blob ? `<span class="peso">${pesoLegible(f.blob.size)}</span>` : ''}
      <button type="button" class="quitar" data-quitar="${f.id}" aria-label="Quitar foto">${ic('x')}</button>
    </div>`).join('');
  $('#zonaFotos').classList.toggle('lleno', E.fotosNuevas.length >= CFG.maxFotos);
}

function limpiarFormulario() {
  const f = $('#formNuevo');
  f.reset();
  E.fotosNuevas.forEach(x => URL.revokeObjectURL(x.url));
  E.fotosNuevas = [];
  pintarPrevias();
  $$('.invalido', f).forEach(x => x.classList.remove('invalido'));
  $('#masDetalles').open = false;
  guardado.borrar('rep_borrador');
  actualizarContadores();
}

async function enviarReporte(ev) {
  ev.preventDefault();
  const f = $('#formNuevo');
  if (f.web.value) { limpiarFormulario(); $('#dlgNuevo').close(); toast('¡Gracias! Recibimos tu reporte.', 'ok'); return; } // bot

  const datos = {
    titulo: vacioANull(f.titulo.value),
    categoria: f.categoria.value || 'otro',
    gravedad: (f.querySelector('input[name=gravedad]:checked') || {}).value || 'media',
    donde: vacioANull(f.donde.value),
    sucede: vacioANull(f.sucede.value),
    esperado: vacioANull(f.esperado.value),
    pasos: vacioANull(f.pasos.value),
    notas: vacioANull(f.notas.value),
  };
  $$('.invalido', f).forEach(x => x.classList.remove('invalido'));
  if (!datos.titulo || datos.titulo.length < 3) {
    f.titulo.classList.add('invalido'); f.titulo.focus();
    toast('Contá en pocas palabras qué pasó (mínimo 3 letras).', 'error'); return;
  }
  if (!f.categoria.value) {
    $('#chipsCat').classList.add('invalido');
    $('#chipsCat').scrollIntoView({ block: 'center', behavior: 'smooth' });
    toast('Elegí de qué se trata.', 'error'); return;
  }
  // "Contanos un poco más" es opcional: si queda vacío, el título alcanza.
  if (!datos.sucede || datos.sucede.length < 3) datos.sucede = datos.titulo;
  if (E.fotosNuevas.some(x => x.procesando)) { toast('Esperá a que terminen de procesarse las fotos.', 'info'); return; }
  const espera = CFG.esperaEntreReportes * 1000 - (Date.now() - guardado.leer('rep_ultimo', 0));
  if (espera > 0 && !E.api.sesion.admin) { toast(`Esperá ${Math.ceil(espera / 1000)} s antes de mandar otro reporte.`, 'error'); return; }

  const btn = $('#btnEnviar'), txt = btn.querySelector('.txt');
  const blobs = E.fotosNuevas.map(x => x.blob);
  btn.disabled = true;
  txt.textContent = blobs.length ? `Subiendo fotos 0/${blobs.length}…` : 'Enviando…';
  try {
    const r = await E.api.crear(datos, blobs, n => { txt.textContent = n < blobs.length ? `Subiendo fotos ${n}/${blobs.length}…` : 'Guardando…'; });
    guardado.escribir('rep_ultimo', Date.now());
    limpiarFormulario();
    if (!buscar(r.id)) E.reportes.unshift(r);
    E.recien = r.id;
    setTimeout(() => { if (E.recien === r.id) E.recien = null; }, 1600);
    if (E.vista === 'lista') cambiarPestana('abiertos'); else render();
    E.ultimoCreado = r.id;
    $('#listoNum').textContent = '#' + r.id;
    f.hidden = true;
    $('#pasoListo').hidden = false;
    $('#listoVer').focus();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    txt.textContent = 'Enviar reporte';
  }
}

/* ───────────── CSV (exportar / importar) ───────────── */

const COLUMNAS_CSV = [
  ['id', 'ID'], ['titulo', 'Error'], ['estado', 'Estado'], ['gravedad', 'Gravedad'], ['categoria', 'Categoría'],
  ['donde', 'Dónde ocurre'], ['creado', 'Fecha del reporte'], ['sucede', 'Qué sucede'], ['esperado', 'Qué debería pasar'],
  ['pasos', 'Pasos'], ['notas', 'Notas o preguntas'], ['autor', 'Autor'], ['votos', 'Votos'], ['respuesta', 'Respuesta'],
  ['cerrado', 'Fecha de cierre'], ['fotos', 'Fotos y capturas'],
];
function exportarCSV() {
  const celda = v => { const s = String(v ?? ''); return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const filas = ordenar(E.reportes.filter(coincide)).map(r => COLUMNAS_CSV.map(([k]) => {
    if (k === 'estado') return ESTADOS[r.estado] ? ESTADOS[r.estado].nombre : r.estado;
    if (k === 'gravedad') return (GRAVEDADES[r.gravedad] || {}).nombre || r.gravedad;
    if (k === 'categoria') return nombreCat(r.categoria);
    if (k === 'creado' || k === 'cerrado') return r[k] ? new Date(r[k]).toLocaleString('es-AR') : '';
    if (k === 'fotos') return (r.fotos || []).filter(f => !f.startsWith('data:')).map(f => E.api.urlFoto(f)).join(' ');
    return r[k];
  }).map(celda).join(','));
  const csv = '﻿' + [COLUMNAS_CSV.map(c => c[1]).join(','), ...filas].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `reportes-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(`Exportados ${filas.length} reportes.`, 'ok');
}

function parsearCSV(txt) {
  txt = txt.replace(/^﻿/, '');
  const primera = txt.split(/\r?\n/, 1)[0] || '';
  const sep = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ';' : ',';
  const filas = []; let fila = [], campo = '', comillas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (comillas) {
      if (c === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else comillas = false; }
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && txt[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter(f => f.some(x => x.trim()));
}

const ALIAS_CSV = {
  titulo: ['error', 'titulo', 'title', 'name', 'nombre', 'bug'],
  estado: ['estado', 'status'],
  donde: ['donde ocurre', 'donde', 'ubicacion', 'lugar'],
  creado: ['fecha del reporte', 'fecha', 'creado', 'created', 'created time'],
  notas: ['notas o preguntas', 'notas', 'notes'],
  esperado: ['que deberia pasar', 'esperado', 'deberia pasar'],
  sucede: ['que sucede', 'que pasa', 'sucede', 'descripcion'],
  pasos: ['pasos', 'pasos para reproducirlo'],
  categoria: ['categoria', 'category'],
  gravedad: ['gravedad', 'prioridad', 'priority'],
  autor: ['autor', 'reportado por', 'jugador'],
  respuesta: ['respuesta', 'respuesta del staff'],
};
const limpiaEnc = s => normal(s).replace(/[¿?¡!:]/g, '').replace(/\s+/g, ' ').trim();
const sinRaya = v => { const t = String(v ?? '').trim(); return /^[\s\-—–_.]*$/.test(t) ? null : t; };

function aEstado(v) {
  const s = normal(v);
  if (/progres|curso|revis|trabaj/.test(s)) return 'en_progreso';
  if (/arregl|listo|hecho|done|resuel|soluc|complet|fixed/.test(s)) return 'arreglado';
  if (/descart|rechaz|no es|wont|invalid/.test(s)) return 'descartado';
  return 'pendiente';
}
function aGravedad(v) {
  const s = normal(v);
  if (/crit|urgent/.test(s)) return 'critica';
  if (/alta|high|grave/.test(s)) return 'alta';
  if (/baja|low|menor/.test(s)) return 'baja';
  return 'media';
}
function aCategoria(v) {
  const s = normal(v);
  if (!s) return 'otro';
  const c = CFG.categorias.find(x => normal(x.id) === s || normal(x.nombre) === s || normal(x.nombre).startsWith(s));
  return c ? c.id : 'otro';
}
function aFecha(v) {
  if (!v) return new Date().toISOString();
  let d = new Date(v);
  if (isNaN(d)) {
    const m = String(v).match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
    if (m) d = new Date(+(m[3].length === 2 ? '20' + m[3] : m[3]), +m[2] - 1, +m[1]);
  }
  return isNaN(d) ? new Date().toISOString() : d.toISOString();
}

async function importarCSV(archivo) {
  let filas;
  try { filas = parsearCSV(await archivo.text()); } catch { toast('No se pudo leer el archivo.', 'error'); return; }
  if (filas.length < 2) { toast('El CSV no tiene filas.', 'error'); return; }
  const enc = filas[0].map(limpiaEnc);
  const col = {};
  Object.entries(ALIAS_CSV).forEach(([k, alias]) => {
    const i = enc.findIndex(h => alias.includes(h));
    if (i >= 0) col[k] = i;
  });
  if (col.titulo == null) { toast('No encontré la columna del título ("Error", "Título" o "Name").', 'error'); return; }
  const val = (f, k) => col[k] == null ? null : sinRaya(f[col[k]]);
  const nuevos = filas.slice(1).map(f => {
    const titulo = val(f, 'titulo');
    if (!titulo) return null;
    const t = titulo.length >= 3 ? titulo : (titulo + ' (bug)');
    const sucede = val(f, 'sucede');
    return {
      titulo: t.slice(0, 120),
      estado: aEstado(val(f, 'estado')),
      gravedad: aGravedad(val(f, 'gravedad')),
      categoria: aCategoria(val(f, 'categoria')),
      donde: (val(f, 'donde') || '').slice(0, 200) || null,
      creado: aFecha(val(f, 'creado')),
      sucede: (sucede && sucede.length >= 3 ? sucede : '(sin detalle en el reporte original)').slice(0, 4000),
      esperado: (val(f, 'esperado') || '').slice(0, 2000) || null,
      pasos: (val(f, 'pasos') || '').slice(0, 4000) || null,
      notas: (val(f, 'notas') || '').slice(0, 2000) || null,
      autor: (val(f, 'autor') || '').slice(0, 60) || null,
      respuesta: (val(f, 'respuesta') || '').slice(0, 2000) || null,
    };
  }).filter(Boolean);
  if (!nuevos.length) { toast('No hay filas con título para importar.', 'error'); return; }
  const ok = await confirmar(`¿Importar ${nuevos.length} reportes?`,
    `Columnas reconocidas: ${Object.keys(col).join(', ')}. Las fotos no se importan (Notion las exporta aparte): agregalas a mano si hace falta.`, 'Importar');
  if (!ok) return;
  try {
    const n = await E.api.importar(nuevos);
    toast(`Importados ${n} reportes.`, 'ok');
    await recargar();
  } catch (e) { toast(e.message, 'error'); }
}

/* ───────────── Cuenta (jugadores y admin) ───────────── */

let accionPendiente = null;   // lo que quería hacer antes de pedirle la cuenta
let modoLogin = 'entrar';

function pintarSesion() {
  const s = E.api.sesion;
  document.body.classList.toggle('es-admin', !!s.admin);
  document.body.classList.toggle('con-cuenta', !!s.id);
  const b = $('#btnCuenta');
  if (s.id) {
    b.innerHTML = `${avatarHTML(s.usuario, 'avatar chico')}<span class="txt">${esc(s.usuario)}</span>`
      + `${s.admin ? '<span class="etq-staff">Admin</span>' : ''}${ic('abajo', 'flecha')}`;
    b.title = 'Tu cuenta';
    b.classList.remove('principal-suave');
  } else {
    b.innerHTML = `${ic('usuario')}<span class="txt">Entrar</span>`;
    b.title = 'Entrar o crear cuenta';
  }
  $('#menuUsuario').textContent = s.usuario || '';
  cerrarMenu();
}

function cerrarMenu() { $('#menuCuenta').hidden = true; $('#btnCuenta').setAttribute('aria-expanded', 'false'); }
function alTocarCuenta(ev) {
  ev.stopPropagation();
  if (!E.api.sesion.id) { pedirCuenta(null, '', 'entrar'); return; }
  const m = $('#menuCuenta');
  m.hidden = !m.hidden;
  $('#btnCuenta').setAttribute('aria-expanded', String(!m.hidden));
}

function pedirCuenta(accion, motivo = '', modo = 'entrar') {
  accionPendiente = accion || null;
  const f = $('#formLogin');
  f.reset();
  $('#motivoLogin').textContent = motivo;
  $('#motivoLogin').hidden = !motivo;
  ponerModoLogin(modo);
  if (!$('#dlgLogin').open) $('#dlgLogin').showModal();
  setTimeout(() => f.usuario.focus(), 30);
}

function ponerModoLogin(m) {
  modoLogin = m;
  const crear = m === 'crear';
  $$('#modosLogin [data-modo]').forEach(b => b.classList.toggle('activo', b.dataset.modo === m));
  $('#tituloLogin').textContent = crear ? 'Crear cuenta' : 'Entrar';
  $('#filaClave2').hidden = !crear;
  $('#formLogin').clave.autocomplete = crear ? 'new-password' : 'current-password';
  $('#btnEntrar').textContent = crear ? 'Crear cuenta' : 'Entrar';
  $('#ayudaLogin').textContent = crear
    ? 'Usuario de 3 a 20 caracteres (letras, números, punto, guion o guion bajo). Contraseña de 6 o más.'
    : (E.api.modo === 'demo' ? 'Demo: el admin es usuario "admin" con contraseña "admin123".' : '¿No tenés cuenta? Tocá "Crear cuenta", es gratis.');
}

async function enviarLogin(ev) {
  ev.preventDefault();
  const f = ev.target, btn = $('#btnEntrar');
  const usuario = f.usuario.value.trim(), clave = f.clave.value;
  const crear = modoLogin === 'crear';
  if (crear ? !USUARIO_OK.test(usuario) : !(usuario.includes('@') || USUARIO_OK.test(usuario))) {
    toast('El usuario va de 3 a 20 caracteres: letras, números, punto, guion o guion bajo (sin espacios ni tildes).', 'error');
    f.usuario.focus(); return;
  }
  if (clave.length < 6) { toast('La contraseña tiene que tener al menos 6 caracteres.', 'error'); f.clave.focus(); return; }
  if (crear && clave !== f.clave2.value) { toast('Las contraseñas no coinciden.', 'error'); f.clave2.focus(); return; }
  btn.disabled = true; btn.textContent = crear ? 'Creando…' : 'Entrando…';
  try {
    if (crear) await E.api.registrar(usuario, clave); else await E.api.entrar(usuario, clave);
    const accion = accionPendiente; accionPendiente = null;
    $('#dlgLogin').close();
    await alCambiarSesion();
    const s = E.api.sesion;
    toast(crear ? `¡Listo, ${s.usuario}! Ya tenés tu cuenta.` : `Hola, ${s.usuario}.${s.admin ? ' Entraste como admin.' : ''}`, 'ok');
    if (accion) accion();
  } catch (e) {
    toast(e.message, 'error');
  } finally { btn.disabled = false; btn.textContent = crear ? 'Crear cuenta' : 'Entrar'; }
}

async function alCambiarSesion() {
  try { misVotos = new Set(await E.api.misVotos()); } catch { misVotos = new Set(); }
  pintarSesion();
  render();
  if (E.abierto != null) renderDetalle();
}

async function salir() {
  await E.api.salir();
  await alCambiarSesion();
  toast('Saliste de tu cuenta.');
}

/* ───────────── Navegación ───────────── */

function cambiarPestana(k) {
  if (!PESTANAS[k]) return;
  E.pestana = k; guardado.escribir('rep_pestana', k);
  if (E.vista !== 'lista') { E.vista = 'lista'; guardado.escribir('rep_vista', 'lista'); }
  E.animar = true;
  render();
}
function limpiarHash() { if (location.hash) history.replaceState(null, '', location.pathname + location.search); }
function abrirDesdeHash() {
  const m = location.hash.match(/^#r(\d+)$/);
  if (m && !E.cargando) abrirDetalle(Number(m[1]));
}

async function recargar() {
  E.cargando = true; E.error = null; render();
  try { E.reportes = await E.api.listar(); }
  catch (e) { E.error = e.message; E.reportes = []; }
  E.cargando = false; E.animar = true; render();
}

/* ───────────── Eventos ───────────── */

function conectar() {
  $('#btnNuevo').addEventListener('click', abrirNuevo);
  $('#btnCuenta').addEventListener('click', alTocarCuenta);
  $('#menuCuenta').addEventListener('click', ev => {
    const b = ev.target.closest('[data-menu]');
    if (!b) return;
    cerrarMenu();
    if (b.dataset.menu === 'mios') { cambiarPestana('mios'); $('#reportes').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    if (b.dataset.menu === 'salir') salir();
  });
  document.addEventListener('click', ev => { if (!ev.target.closest('.cuenta-caja')) cerrarMenu(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') cerrarMenu(); });
  $('#modosLogin').addEventListener('click', ev => { const b = ev.target.closest('[data-modo]'); if (b) { ponerModoLogin(b.dataset.modo); $('#formLogin').usuario.focus(); } });
  $('#dlgLogin').addEventListener('close', () => { accionPendiente = null; });
  $('#formLogin').addEventListener('submit', enviarLogin);
  $('#formNuevo').addEventListener('submit', enviarReporte);
  $('#formNuevo').addEventListener('input', ev => {
    if (ev.target.classList.contains('invalido')) ev.target.classList.remove('invalido');
    actualizarContadores();
    clearTimeout(conectar.tb); conectar.tb = setTimeout(guardarBorrador, 300);
  });

  // Cerrar diálogos con la X / Cancelar y tocando afuera.
  $$('dialog').forEach(d => {
    d.addEventListener('click', ev => {
      if (ev.target.closest('[data-cerrar]')) { d.close(); return; }
      if (ev.target === d && d.id !== 'dlgConfirmar') {
        const r = d.getBoundingClientRect();
        const fuera = ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
        if (fuera || d.id === 'dlgVisor') d.close();
      }
    });
  });
  $('#dlgDetalle').addEventListener('close', () => { E.abierto = null; comentariosActuales = []; limpiarHash(); });

  // Pantalla de "gracias"
  $('#listoVer').addEventListener('click', () => { $('#dlgNuevo').close(); if (E.ultimoCreado != null) abrirDetalle(E.ultimoCreado); });
  $('#listoOtro').addEventListener('click', abrirNuevo);

  // Resumen y pestañas
  const irALista = () => $('#reportes').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#stats').addEventListener('click', ev => { const b = ev.target.closest('.chip-stat'); if (b) { cambiarPestana(b.dataset.pestana); irALista(); } });

  // Inicio rápido de la portada
  $('#formRapido').addEventListener('submit', ev => {
    ev.preventDefault();
    const tit = $('#rapidoTitulo'), cats = $('#rapidoCats');
    const cat = (cats.querySelector('input:checked') || {}).value;
    const sacudir = el => { el.classList.remove('temblor'); void el.offsetWidth; el.classList.add('temblor'); };
    if (tit.value.trim().length < 3) { sacudir(tit); tit.focus(); toast('Escribí en pocas palabras qué pasó.', 'info'); return; }
    if (!cat) { sacudir(cats); toast('Elegí de qué se trata.', 'info'); return; }
    abrirNuevo({ titulo: tit.value.trim(), categoria: cat });
    $('#formRapido').reset();
  });

  // Botón flotante: aparece cuando la portada ya no se ve
  const fab = $('#fab');
  fab.addEventListener('click', () => abrirNuevo());
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => fab.classList.toggle('visible', !en.isIntersecting), { threshold: 0.05 }).observe($('#formRapido'));
  } else fab.classList.add('visible');
  $('#pestanas').addEventListener('click', ev => { const b = ev.target.closest('.pestana'); if (b) cambiarPestana(b.dataset.pestana); });
  $$('.vistas button').forEach(b => b.addEventListener('click', () => { E.vista = b.dataset.vista; guardado.escribir('rep_vista', E.vista); E.animar = true; render(); }));

  // Filtros
  let tBusq;
  $('#busqueda').addEventListener('input', ev => { clearTimeout(tBusq); tBusq = setTimeout(() => { E.busqueda = ev.target.value; render(); }, 120); });
  $('#filtroCat').addEventListener('change', ev => { E.cat = ev.target.value; E.animar = true; render(); });
  $('#filtroGrav').addEventListener('change', ev => { E.grav = ev.target.value; E.animar = true; render(); });
  $('#orden').addEventListener('change', ev => { E.orden = ev.target.value; E.animar = true; render(); });

  // Abrir reportes desde la lista o el tablero
  const abrirDesde = ev => {
    if (ev.target.closest('#btnReintentar')) { recargar(); return; }
    if (ev.target.closest('#btnLimpiar')) {
      E.busqueda = E.cat = E.grav = ''; $('#busqueda').value = ''; $('#filtroCat').value = ''; $('#filtroGrav').value = ''; render(); return;
    }
    if (ev.target.closest('[data-accion="nuevo"]')) { abrirNuevo(); return; }
    const el = ev.target.closest('[data-id]');
    if (el) abrirDetalle(Number(el.dataset.id));
  };
  ['#lista', '#tablero', '#actividad'].forEach(s => {
    $(s).addEventListener('click', abrirDesde);
    $(s).addEventListener('keydown', ev => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[data-id]')) { ev.preventDefault(); abrirDesde(ev); } });
  });

  // Tablero: arrastrar y soltar (solo admin)
  const tab = $('#tablero');
  let arrastrado = null;
  tab.addEventListener('dragstart', ev => {
    const t = ev.target.closest('.tarjeta');
    if (!t || !E.api.sesion.admin) { ev.preventDefault(); return; }
    arrastrado = Number(t.dataset.id);
    t.classList.add('arrastrando');
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', String(arrastrado));
  });
  tab.addEventListener('dragend', ev => { const t = ev.target.closest('.tarjeta'); if (t) t.classList.remove('arrastrando'); $$('.columna.sobre').forEach(c => c.classList.remove('sobre')); arrastrado = null; });
  tab.addEventListener('dragover', ev => {
    const col = ev.target.closest('.columna');
    if (!col || arrastrado == null) return;
    ev.preventDefault();
    $$('.columna.sobre').forEach(c => c !== col && c.classList.remove('sobre'));
    col.classList.add('sobre');
  });
  tab.addEventListener('drop', ev => {
    const col = ev.target.closest('.columna');
    if (!col || arrastrado == null) return;
    ev.preventDefault();
    col.classList.remove('sobre');
    cambiarEstado(arrastrado, col.dataset.estado);
  });

  // Detalle
  $('#detCuerpo').addEventListener('click', ev => {
    const foto = ev.target.closest('[data-foto]');
    if (foto) { const r = buscar(E.abierto); if (r) abrirVisor(r.fotos, Number(foto.dataset.foto)); return; }
    const est = ev.target.closest('.admin-estados [data-estado]');
    if (est) { elegirEstado(est.dataset.estado); return; }
    const bc = ev.target.closest('[data-borrar-com]');
    if (bc) { borrarComentario(Number(bc.dataset.borrarCom)); return; }
    if (ev.target.closest('[data-accion="entrar"]')) pedirCuenta(null, 'Entrá o creá tu cuenta para comentar.', 'entrar');
    else if (ev.target.closest('#btnVotar')) votar();
    else if (ev.target.closest('#btnCopiar')) {
      const url = location.origin + location.pathname + '#r' + E.abierto;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
        .then(() => toast('Enlace copiado.', 'ok'), () => toast(url));
    }
    else if (ev.target.closest('#admGuardar')) guardarAdmin();
    else if (ev.target.closest('#admBorrar')) eliminarReporte();
  });
  $('#detCuerpo').addEventListener('submit', ev => { if (ev.target.id === 'comForm') enviarComentario(ev); });
  $('#detCuerpo').addEventListener('keydown', ev => {
    if (ev.target.id === 'comTexto' && ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); $('#comForm').requestSubmit(); }
  });

  // Visor
  $('#visorAnt').addEventListener('click', () => moverVisor(-1));
  $('#visorSig').addEventListener('click', () => moverVisor(1));
  $('#dlgVisor').addEventListener('keydown', ev => {
    if (ev.key === 'ArrowLeft') moverVisor(-1);
    if (ev.key === 'ArrowRight') moverVisor(1);
  });

  // Fotos del formulario
  const zona = $('#zonaFotos'), inFotos = $('#archivoFotos');
  zona.addEventListener('click', () => inFotos.click());
  zona.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); inFotos.click(); } });
  inFotos.addEventListener('change', () => { agregarFotos(inFotos.files); inFotos.value = ''; });
  ['dragenter', 'dragover'].forEach(t => zona.addEventListener(t, ev => { ev.preventDefault(); zona.classList.add('sobre'); }));
  ['dragleave', 'drop'].forEach(t => zona.addEventListener(t, () => zona.classList.remove('sobre')));
  zona.addEventListener('drop', ev => { ev.preventDefault(); agregarFotos(ev.dataTransfer.files); });
  // Si sueltan la imagen en cualquier parte del formulario, que no la abra el navegador.
  $('#dlgNuevo').addEventListener('dragover', ev => ev.preventDefault());
  $('#dlgNuevo').addEventListener('drop', ev => { ev.preventDefault(); if (ev.dataTransfer.files.length) agregarFotos(ev.dataTransfer.files); });
  $('#previas').addEventListener('click', ev => {
    const b = ev.target.closest('[data-quitar]');
    if (!b) return;
    const it = E.fotosNuevas.find(x => x.id === b.dataset.quitar);
    if (it) URL.revokeObjectURL(it.url);
    E.fotosNuevas = E.fotosNuevas.filter(x => x.id !== b.dataset.quitar);
    pintarPrevias();
  });
  document.addEventListener('paste', ev => {
    if (!$('#dlgNuevo').open) return;
    const imgs = [...(ev.clipboardData ? ev.clipboardData.items : [])].filter(i => i.kind === 'file' && /^image\//.test(i.type)).map(i => i.getAsFile());
    if (imgs.length) { ev.preventDefault(); agregarFotos(imgs); }
  });

  // CSV
  $('#btnExportar').addEventListener('click', exportarCSV);
  $('#btnImportar').addEventListener('click', () => $('#archivoCSV').click());
  $('#archivoCSV').addEventListener('change', ev => { const a = ev.target.files[0]; ev.target.value = ''; if (a) importarCSV(a); });

  // Atajos
  document.addEventListener('keydown', ev => {
    if (document.querySelector('dialog[open]')) return;
    if (ev.target.matches('input, textarea, select')) return;
    if (ev.key === '/') { ev.preventDefault(); $('#busqueda').focus(); }
    else if (ev.key.toLowerCase() === 'n' && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { ev.preventDefault(); abrirNuevo(); }
  });
  window.addEventListener('hashchange', abrirDesdeHash);

  // Las fechas relativas ("hace 5 minutos") se refrescan solas, sin redibujar la lista.
  setInterval(() => {
    if (document.hidden) return;
    $$('[data-hace]').forEach(el => { const t = hace(el.dataset.hace); if (el.textContent !== t) el.textContent = t; });
  }, 60000);
}

/* ───────────── Arranque ───────────── */

async function iniciar() {
  pintarIconos();
  document.title = CFG.nombreServidor;
  $('#titulo').textContent = CFG.nombreServidor;
  if (CFG.descripcion) $('#subtitulo').textContent = CFG.descripcion;
  if (CFG.enlaceDiscord) { const d = $('#btnDiscord'); d.href = CFG.enlaceDiscord; d.hidden = false; }
  $('#maxFotos').textContent = CFG.maxFotos;
  $('#filtroCat').insertAdjacentHTML('beforeend', CFG.categorias.map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join(''));
  $('#chipsCat').innerHTML = CFG.categorias.map(c =>
    `<label class="chip"><input type="radio" name="categoria" value="${esc(c.id)}"><span>${ic(iconoCat(c))}${esc(c.nombre)}</span></label>`).join('');
  $('#chipsCat').addEventListener('change', () => $('#chipsCat').classList.remove('invalido'));
  $('#rapidoCats').innerHTML = CFG.categorias.map(c =>
    `<label class="chip baldosa" title="${esc(c.nombre)}"><input type="radio" name="rcat" value="${esc(c.id)}"><span>${ic(iconoCat(c))}<em>${esc(c.nombre.split(' / ')[0])}</em></span></label>`).join('');

  conectar();

  // Con "?demo" en la dirección se usa el modo demo aunque haya Supabase (para probar sin tocar datos reales).
  const forzarDemo = new URLSearchParams(location.search).has('demo');
  const configurado = !!(CFG.supabaseUrl && CFG.supabaseAnonKey) && !forzarDemo;
  if (configurado && !(window.supabase && window.supabase.createClient)) {
    E.api = apiDemo(); // solo para poder pintar
    E.cargando = false; E.error = 'No se pudo cargar la librería de Supabase (¿bloqueador de anuncios o sin internet?).';
    render(); return;
  }
  // Luz que sigue al mouse dentro de las tarjetas (solo con mouse, no en celular).
  $$('.panel, .tarjeta-lateral, .rapido, .pasos-cards li').forEach(el => el.classList.add('spot'));
  if (matchMedia('(hover: hover)').matches) {
    let pendiente = null;
    document.addEventListener('pointermove', ev => {
      const el = ev.target.closest && ev.target.closest('.spot');
      if (!el || pendiente) return;
      pendiente = requestAnimationFrame(() => {
        pendiente = null;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
        el.style.setProperty('--my', (ev.clientY - r.top) + 'px');
      });
    }, { passive: true });
  }

  // Las secciones aparecen suavemente cuando entran en pantalla (una sola vez).
  const revelar = $$('.revelar');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
    }), { threshold: 0.08 });
    revelar.forEach(el => io.observe(el));
    setTimeout(() => revelar.forEach(el => el.classList.add('visible')), 2500); // por las dudas
  } else revelar.forEach(el => el.classList.add('visible'));

  E.api = configurado ? apiSupabase() : apiDemo();
  $('#avisoDemo').hidden = configurado;
  try { await E.api.iniciar(); } catch (e) { console.warn('[reportes] sesión', e); }
  try { misVotos = new Set(await E.api.misVotos()); } catch { misVotos = new Set(); }
  pintarSesion();
  await recargar();
  try { E.api.escuchar(alCambiarRemoto); } catch (e) { console.warn('[reportes] tiempo real', e); }
  setInterval(sincronizar, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sincronizar(); });
  window.addEventListener('focus', sincronizar);
  abrirDesdeHash();
}

iniciar();
})();
