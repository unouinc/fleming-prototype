/* 接続設定。空のままなら試作モード（データは保存されません）。
   Supabase の Project Settings → API にある「Project URL」と「anon public」キーを入れると本番モードになります。
   anon キーは公開して問題ない鍵です（service_role キーは絶対に入れないでください）。 */
window.NASURI_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: ''
};
