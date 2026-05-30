// Supabase 云端同步服务
// 将本地 {date: [flights]} 格式与 Supabase 表互相转换

const SupabaseService = (() => {
  // 本地对象 → Supabase 行
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

  // Supabase 行 → 本地对象
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

  // 从 Supabase 拉取所有航班，转为本地 {date: [flights]} 格式
  async function fetchFlights() {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('flights')
        .select('*')
        .order('flight_date', { ascending: true });

      if (error) {
        console.error('Supabase 拉取失败:', error.message);
        return null;
      }

      const result = {};
      data.forEach(row => {
        const dateStr = row.flight_date;
        if (!result[dateStr]) result[dateStr] = [];
        result[dateStr].push(fromRow(row));
      });

      return result;
    } catch (err) {
      console.error('Supabase 连接失败:', err.message);
      return null;
    }
  }

  // 上传/更新单条航班
  async function upsertFlight(dateStr, flight) {
    if (!supabase) return;

    try {
      const row = toRow(dateStr, flight);
      const { error } = await supabase
        .from('flights')
        .upsert(row, { onConflict: 'id' });

      if (error) console.error('Supabase 同步失败:', error.message);
    } catch (err) {
      console.error('Supabase 同步异常:', err.message);
    }
  }

  // 批量上传航班（用于初始同步）
  async function upsertFlights(flightsData) {
    if (!supabase) return;

    try {
      const rows = [];
      for (const dateStr in flightsData) {
        flightsData[dateStr].forEach(f => rows.push(toRow(dateStr, f)));
      }

      if (rows.length === 0) return;

      const { error } = await supabase
        .from('flights')
        .upsert(rows, { onConflict: 'id' });

      if (error) console.error('Supabase 批量同步失败:', error.message);
    } catch (err) {
      console.error('Supabase 批量同步异常:', err.message);
    }
  }

  // 删除单条航班
  async function deleteFlightById(flightId) {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('flights')
        .delete()
        .eq('id', flightId);

      if (error) console.error('Supabase 删除失败:', error.message);
    } catch (err) {
      console.error('Supabase 删除异常:', err.message);
    }
  }

  return { fetchFlights, upsertFlight, upsertFlights, deleteFlightById };
})();
