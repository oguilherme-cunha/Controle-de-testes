// ============================================================
//  CONFIGURAÇÃO DO BANCO (Supabase)
//  Supabase > Project Settings > API Keys:
//    url     = "Project URL"
//    anonKey = "Publishable key" (sb_publishable_...) ou a antiga
//              chave "anon public". Pode ficar pública: quem protege
//              os dados são as regras do setup.sql.
//              NUNCA use a "Secret key" / "service_role" aqui.
// ============================================================
window.SUPABASE_CONFIG = {
  url: "https://dlczgoullqwcdrqgymro.supabase.co",
  anonKey: "sb_publishable_95whMk7dFwlVhduHnvdBow_wMB0k0GM",
};
