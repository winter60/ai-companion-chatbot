-- 改进访客追踪：添加设备指纹支持
-- Improve guest tracking: Add device fingerprint support

-- 1. 添加新列到guest_usage表
ALTER TABLE public.guest_usage 
ADD COLUMN IF NOT EXISTS device_id VARCHAR(64),
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS session_count INTEGER DEFAULT 1;

-- 2. 更新现有数据的device_id（基于IP地址生成临时ID）
UPDATE public.guest_usage 
SET device_id = 'legacy_' || REPLACE(ip_address, '.', '_')
WHERE device_id IS NULL;

-- 3. 创建新的复合索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_guest_device_id_date 
ON public.guest_usage(device_id, last_conversation_date);

CREATE INDEX IF NOT EXISTS idx_guest_ip_device 
ON public.guest_usage(ip_address, device_id);

CREATE INDEX IF NOT EXISTS idx_guest_first_seen 
ON public.guest_usage(first_seen);

-- 4. 添加唯一约束（同一device_id只能有一条记录）
-- 注意：如果存在重复数据，需要先清理
DELETE FROM public.guest_usage a USING public.guest_usage b 
WHERE a.id < b.id AND a.device_id = b.device_id;

ALTER TABLE public.guest_usage 
ADD CONSTRAINT unique_guest_device_id UNIQUE (device_id);

-- 5. 创建改进的RPC函数：使用设备指纹检查对话限制
CREATE OR REPLACE FUNCTION public.check_guest_conversation_limit_v2(
  client_device_id TEXT,
  client_ip TEXT DEFAULT NULL,
  client_user_agent TEXT DEFAULT NULL,
  client_fingerprint TEXT DEFAULT NULL
)
RETURNS public.usage_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  guest_record RECORD;
  today_date DATE;
  guest_limit INTEGER := 3; -- 访客限制：每天3次对话
  new_count INTEGER;
  ip_check_result BOOLEAN := FALSE;
BEGIN
  -- 验证设备ID参数
  IF client_device_id IS NULL OR client_device_id = '' THEN
    RETURN (false, '无效的设备标识', 0)::public.usage_status;
  END IF;

  today_date := CURRENT_DATE;

  -- 查询设备使用记录
  SELECT * INTO guest_record FROM public.guest_usage 
  WHERE device_id = client_device_id;
  
  -- 如果是新设备
  IF guest_record IS NULL THEN
    -- 检查IP地址是否在短时间内创建了过多设备（防滥用检测）
    IF client_ip IS NOT NULL THEN
      SELECT COUNT(*) > 5 INTO ip_check_result
      FROM public.guest_usage 
      WHERE ip_address = client_ip 
        AND first_seen > NOW() - INTERVAL '1 hour';
      
      IF ip_check_result THEN
        RETURN (false, '检测到异常行为，请稍后再试', 0)::public.usage_status;
      END IF;
    END IF;
    
    -- 创建新设备记录
    INSERT INTO public.guest_usage(
      device_id, 
      ip_address, 
      conversation_count, 
      last_conversation_date,
      device_fingerprint,
      user_agent,
      first_seen,
      session_count
    )
    VALUES (
      client_device_id, 
      client_ip, 
      1, 
      today_date,
      client_fingerprint,
      client_user_agent,
      NOW(),
      1
    );
    
    RETURN (true, '操作成功', guest_limit - 1)::public.usage_status;
  END IF;

  -- 每日重置逻辑
  IF guest_record.last_conversation_date < today_date THEN
    guest_record.conversation_count := 0;
  END IF;

  -- 检查限制
  IF guest_record.conversation_count >= guest_limit THEN
    RETURN (false, '今日访客对话次数已用完，请明天再来或登录获取更多次数', 0)::public.usage_status;
  END IF;

  -- 更新计数和相关信息
  new_count := guest_record.conversation_count + 1;
  UPDATE public.guest_usage
  SET
    conversation_count = new_count,
    last_conversation_date = today_date,
    updated_at = NOW(),
    ip_address = COALESCE(client_ip, ip_address), -- 更新IP（如果提供）
    device_fingerprint = COALESCE(client_fingerprint, device_fingerprint), -- 更新指纹
    user_agent = COALESCE(client_user_agent, user_agent), -- 更新User Agent
    session_count = CASE 
      WHEN last_conversation_date < today_date THEN 1 
      ELSE session_count + 1 
    END
  WHERE device_id = client_device_id;
  
  RETURN (true, '操作成功', guest_limit - new_count)::public.usage_status;

EXCEPTION
  WHEN unique_violation THEN
    -- 处理并发插入冲突
    RETURN public.check_guest_conversation_limit_v2(client_device_id, client_ip, client_user_agent, client_fingerprint);
  WHEN OTHERS THEN
    RETURN (false, '服务器内部错误', 0)::public.usage_status;
END;
$$;

-- 6. 创建获取访客状态的RPC函数（v2版本）
CREATE OR REPLACE FUNCTION public.get_guest_conversation_status_v2(
  client_device_id TEXT,
  client_ip TEXT DEFAULT NULL
)
RETURNS public.usage_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  guest_record RECORD;
  today_date DATE;
  guest_limit INTEGER := 3;
BEGIN
  IF client_device_id IS NULL OR client_device_id = '' THEN
    RETURN (false, '无效的设备标识', 0)::public.usage_status;
  END IF;

  today_date := CURRENT_DATE;
  SELECT * INTO guest_record FROM public.guest_usage 
  WHERE device_id = client_device_id;
  
  IF guest_record IS NULL THEN
    RETURN (true, '新设备', guest_limit)::public.usage_status;
  END IF;

  -- 如果是新的一天，重置计数
  IF guest_record.last_conversation_date < today_date THEN
    RETURN (true, '今日次数已重置', guest_limit)::public.usage_status;
  END IF;

  RETURN (true, '获取成功', guest_limit - guest_record.conversation_count)::public.usage_status;
END;
$$;

-- 7. 创建访客统计视图（用于管理和分析）
CREATE OR REPLACE VIEW public.guest_usage_stats AS
SELECT 
  DATE(last_conversation_date) as date,
  COUNT(DISTINCT device_id) as unique_devices,
  COUNT(DISTINCT ip_address) as unique_ips,
  SUM(conversation_count) as total_conversations,
  AVG(conversation_count) as avg_conversations_per_device,
  COUNT(*) FILTER (WHERE conversation_count >= 3) as maxed_out_devices,
  COUNT(*) FILTER (WHERE first_seen::date = last_conversation_date) as new_devices_today
FROM public.guest_usage
GROUP BY DATE(last_conversation_date)
ORDER BY date DESC;

-- 8. 创建异常检测函数
CREATE OR REPLACE FUNCTION public.detect_suspicious_guest_activity()
RETURNS TABLE(
  ip_address TEXT,
  device_count BIGINT,
  first_device_created TIMESTAMP WITH TIME ZONE,
  last_device_created TIMESTAMP WITH TIME ZONE,
  risk_level TEXT
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    g.ip_address,
    COUNT(DISTINCT g.device_id) as device_count,
    MIN(g.first_seen) as first_device_created,
    MAX(g.first_seen) as last_device_created,
    CASE 
      WHEN COUNT(DISTINCT g.device_id) > 10 THEN 'HIGH'
      WHEN COUNT(DISTINCT g.device_id) > 5 THEN 'MEDIUM'
      WHEN COUNT(DISTINCT g.device_id) > 3 THEN 'LOW'
      ELSE 'NORMAL'
    END as risk_level
  FROM public.guest_usage g
  WHERE g.first_seen > NOW() - INTERVAL '24 hours'
    AND g.ip_address IS NOT NULL
  GROUP BY g.ip_address
  HAVING COUNT(DISTINCT g.device_id) > 3
  ORDER BY device_count DESC;
$$;

-- 9. 添加注释
COMMENT ON COLUMN public.guest_usage.device_id IS '基于浏览器指纹生成的设备唯一标识';
COMMENT ON COLUMN public.guest_usage.device_fingerprint IS '完整的设备指纹信息（JSON格式）';
COMMENT ON COLUMN public.guest_usage.first_seen IS '设备首次访问时间';
COMMENT ON COLUMN public.guest_usage.session_count IS '当日会话次数';

COMMENT ON FUNCTION public.check_guest_conversation_limit_v2 IS '改进版访客对话限制检查，支持设备指纹识别';
COMMENT ON FUNCTION public.get_guest_conversation_status_v2 IS '改进版访客状态查询，支持设备指纹识别';
COMMENT ON VIEW public.guest_usage_stats IS '访客使用统计视图';
COMMENT ON FUNCTION public.detect_suspicious_guest_activity IS '可疑访客行为检测函数';