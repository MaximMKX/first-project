-- 航班排班表
-- 在 Supabase Dashboard → SQL Editor 中执行此 SQL

CREATE TABLE IF NOT EXISTS flights (
  id TEXT PRIMARY KEY,
  flight_date DATE NOT NULL,
  flight_no TEXT,
  departure TEXT,
  arrival TEXT,
  captain TEXT,
  chief_attendant TEXT,
  aircraft_type TEXT,
  reg_no TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 按日期查询索引
CREATE INDEX IF NOT EXISTS idx_flights_date ON flights(flight_date);

-- 启用实时更新（可选）
ALTER TABLE flights ENABLE REPLICA IDENTITY FULL;

-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON flights
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
