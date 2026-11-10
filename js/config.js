/* Configuración de la página de reportes.
 *
 * Si supabaseUrl y supabaseAnonKey quedan vacíos, la página arranca en MODO DEMO:
 * todo se guarda solo en el navegador de quien la abre (sirve para probarla).
 * Para que los reportes los vea todo el mundo, seguí el LEEME.md (son 5 minutos).
 *
 * La "anon key" de Supabase es pública a propósito: puede ir acá sin problema.
 * La seguridad la ponen las reglas (RLS) del archivo supabase/instalar.sql.
 * NUNCA pongas acá la "service_role key".
 */
window.REPORTES_CONFIG = {
  nombreServidor: "Reportes de errores",   // aparece arriba a la izquierda y en la pestaña del navegador
  descripcion: "Contanos qué pasó en menos de un minuto. El staff lo revisa y acá vas a ver cuando quede arreglado.",

  // Supabase (Project Settings > API)
  supabaseUrl: "https://zlnuenwqvhbqwfpuycvd.supabase.co",
  supabaseAnonKey: "sb_publishable_mYAx5r-imtruTtAib8npig_ey-onMxz",
  bucket: "capturas",    // nombre del bucket de Storage (el SQL lo crea con este nombre)

  // Cuentas de jugadores: se registran con usuario + contraseña.
  // Supabase pide un mail, así que por dentro se guarda "usuario@" + este dominio (no se manda ningún correo).
  // Si Supabase dice que el mail no es válido, poné acá un dominio tuyo. No lo cambies cuando ya haya cuentas.
  dominioCuentas: "jugadores.example.com",

  // Límites del formulario
  maxFotos: 6,
  maxMBporFoto: 5,            // las fotos se achican solas antes de subirse
  esperaEntreReportes: 60,    // segundos entre un reporte y otro desde el mismo navegador

  // Enlace opcional que aparece arriba (dejar vacío para ocultarlo)
  enlaceDiscord: "",

  // Categorías del formulario. El id se guarda en la base: no lo cambies después de usarlo.
  categorias: [
    { id: "items",      nombre: "Items / inventario" },
    { id: "personaje",  nombre: "Personaje / ropa" },
    { id: "vehiculos",  nombre: "Vehículos" },
    { id: "robos",      nombre: "Robos / tiendas" },
    { id: "trabajos",   nombre: "Trabajos" },
    { id: "combate",    nombre: "Combate / muerte" },
    { id: "interfaz",   nombre: "Interfaz / menús" },
    { id: "admin",      nombre: "Admin / txAdmin" },
    { id: "rendimiento", nombre: "Crash / lag" },
    { id: "otro",       nombre: "Otro" }
  ]
};
