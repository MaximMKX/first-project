// ============================================
// Supabase 配置 — 请填入你的项目信息
// 在 Supabase Dashboard → Settings → API 中找到
// ============================================

const SUPABASE_URL = 'https://hiqwtaofahbcmttweebc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcXd0YW9mYWhiY210dHdlZWJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjA1NDAsImV4cCI6MjA5NTY5NjU0MH0.n4o6RLjXNwir-bOdzFcg0ousEyyhqrZ0NDPvuHmGoV4';

// 是否已配置（未配置时跳过云端同步，仅使用本地数据）
const isConfigured = () =>
  SUPABASE_URL && !SUPABASE_URL.includes('你的') &&
  SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('你的');

// 创建 Supabase 客户端
let supabase = null;
if (isConfigured()) {
  console.log('[Supabase] 配置已加载，URL:', SUPABASE_URL);
  // supabase UMD 暴露 window.supabase，createClient 可能在顶层或嵌套
  const sb = window.supabase;
  const createClient = sb?.createClient || sb?.default?.createClient || sb;
  if (typeof createClient === 'function') {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[Supabase] 客户端创建成功, has .from:', typeof supabase?.from);
  } else {
    console.error('[Supabase] createClient 未找到, window.supabase keys:', Object.keys(sb || {}));
  }
} else {
  console.log('[Supabase] 未配置，跳过云端同步');
}
