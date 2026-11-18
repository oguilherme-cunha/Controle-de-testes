// ============================================================
//  CONFIGURAÇÃO DO BANCO (Supabase)
//  Supabase > Project Settings > API:
//    url     = "Project URL"
//    anonKey = chave "anon" / "public"  (pode ficar pública; quem
//              protege os dados são as regras do setup.sql)
//
//  Deixe os dois vazios para usar o modo local (casos no data.js).
// ============================================================
window.SUPABASE_CONFIG = {
  url: "",
  anonKey: "",
};
