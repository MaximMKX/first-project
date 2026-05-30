// ============================================
// Supabase 配置 — 请填入你的项目信息
// 在 Supabase Dashboard → Settings → API 中找到
// ============================================

const SUPABASE_URL = 'https://你的项目ID.supabase.co';
const SUPABASE_ANON_KEY = '你的anon public key';

// 是否已配置（未配置时跳过云端同步，仅使用本地数据）
const isConfigured = () =>
  SUPABASE_URL && !SUPABASE_URL.includes('你的') &&
  SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('你的');

// 创建 Supabase 客户端
let supabase = null;
if (isConfigured()) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
