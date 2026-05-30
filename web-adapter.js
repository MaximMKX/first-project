// Web 适配层：在浏览器中提供 window.api，使用 Supabase 作为后端
// 替代 Electron 的 preload.js IPC 调用

const SUPABASE_URL = 'https://hiqwtaofahbcmttweebc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcXd0YW9mYWhiY210dHdlZWJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjA1NDAsImV4cCI6MjA5NTY5NjU0MH0.n4o6RLjXNwir-bOdzFcg0ousEyyhqrZ0NDPvuHmGoV4';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Supabase 行 → 本地格式
function fromRow(row) {
  return {
    id: row.id,
    flightNo: row.flight_no || '',
    from: row.departure || '',
    to: row.arrival || '',
    captain: row.captain || '',
    chiefAttendant: row.chief_attendant || '',
    aircraftType: row.aircraft_type || '',
    regNo: row.reg_no || '',
  };
}

// 本地格式 → Supabase 行
function toRow(dateStr, flight) {
  return {
    id: flight.id,
    flight_date: dateStr,
    flight_no: flight.flightNo || null,
    departure: flight.from || null,
    arrival: flight.to || null,
    captain: flight.captain || null,
    chief_attendant: flight.chiefAttendant || null,
    aircraft_type: flight.aircraftType || null,
    reg_no: flight.regNo || null,
  };
}

// 提供与 Electron preload.js 相同的 API
window.api = {
  async readFlights() {
    try {
      const { data, error } = await db
        .from('flights')
        .select('*')
        .order('flight_date', { ascending: true });

      if (error) {
        console.error('读取失败:', error.message);
        return {};
      }

      const result = {};
      data.forEach(row => {
        const dateStr = row.flight_date;
        if (!result[dateStr]) result[dateStr] = [];
        result[dateStr].push(fromRow(row));
      });

      return result;
    } catch (err) {
      console.error('连接失败:', err.message);
      return {};
    }
  },

  async saveFlights(flightsData) {
    try {
      const rows = [];
      for (const dateStr in flightsData) {
        flightsData[dateStr].forEach(f => rows.push(toRow(dateStr, f)));
      }

      if (rows.length === 0) return true;

      const { error } = await db
        .from('flights')
        .upsert(rows, { onConflict: 'id' });

      if (error) console.error('保存失败:', error.message);
      return !error;
    } catch (err) {
      console.error('保存异常:', err.message);
      return false;
    }
  },
};

// 禁用 app.js 中的 Supabase 同步（Web 版直接用 Supabase 作为数据源）
window.__WEB_MODE__ = true;
