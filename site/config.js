/* 接続設定。
   supabaseUrl と supabaseKey は公開して問題ない値です（service_role キーは絶対に入れないでください）。
   liveByDefault が false のあいだは、通常の訪問者には試作モード（保存なし）で表示されます。
   確認するときは、URL の末尾に ?live=1 を付けて開くと、そのブラウザだけ本番モードになります（?live=0 で戻る）。
   一般公開するときに liveByDefault を true にします。 */
window.NASURI_CONFIG = {
  supabaseUrl: 'https://btvdmvrgdinmbwymdpfo.supabase.co',
  supabaseAnonKey: 'sb_publishable_Fxms9sX7nwm2MhIfCiSRBw_GKrV2T9h',
  liveByDefault: false
};
