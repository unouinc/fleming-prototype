/* 接続設定。
   supabaseUrl と supabaseKey は公開して問題ない値です（service_role キーは絶対に入れないでください）。
   liveByDefault が true なので、すべての訪問者が本番モード（登録・ログイン・「話を聞きたい」が実際に保存される）で使います。
   試作モードに戻すときは false にします（その場合も ?live=1 を付けたブラウザだけ本番モードになります）。 */
window.NASURI_CONFIG = {
  supabaseUrl: 'https://btvdmvrgdinmbwymdpfo.supabase.co',
  supabaseAnonKey: 'sb_publishable_Fxms9sX7nwm2MhIfCiSRBw_GKrV2T9h',
  liveByDefault: true
};
