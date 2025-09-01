-- 创建订阅系统相关表
-- Create subscription system tables

-- 1. 创建计划类型枚举
CREATE TYPE public.plan_type AS ENUM ('free', 'monthly', 'lifetime');

-- 2. 创建支付状态枚举  
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- 3. 创建订阅状态枚举
CREATE TYPE public.subscription_status AS ENUM ('active', 'expired', 'cancelled');

-- 4. 用户订阅表
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type public.plan_type NOT NULL DEFAULT 'free',
  status public.subscription_status NOT NULL DEFAULT 'active',
  starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL表示永久
  creem_product_id TEXT, -- Creem产品ID
  creem_order_id TEXT, -- Creem订单ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 支付记录表
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL, -- 金额(分为单位)
  currency VARCHAR(3) DEFAULT 'CNY',
  creem_order_id TEXT UNIQUE NOT NULL, -- Creem订单ID
  creem_product_id TEXT NOT NULL, -- Creem产品ID
  status public.payment_status NOT NULL DEFAULT 'pending',
  plan_type public.plan_type NOT NULL,
  payment_method TEXT, -- 支付方式
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 扩展profiles表，添加订阅相关字段
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan_type public.plan_type DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.subscriptions(id),
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 10; -- 登录用户默认10次

-- 7. 创建索引
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_expires_idx ON public.subscriptions(status, expires_at);
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS payments_creem_order_id_idx ON public.payments(creem_order_id);
CREATE INDEX IF NOT EXISTS profiles_plan_type_idx ON public.profiles(plan_type);

-- 8. 启用RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 9. RLS策略 - subscriptions表
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- 10. RLS策略 - payments表  
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage payments" ON public.payments
  FOR ALL USING (current_setting('role') = 'service_role');

-- 11. 创建触发器：自动更新updated_at字段
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscriptions_updated_at 
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at 
  BEFORE UPDATE ON public.payments  
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. 创建函数：获取用户当前有效订阅
CREATE OR REPLACE FUNCTION public.get_user_active_subscription(p_user_id UUID)
RETURNS TABLE (
  subscription_id UUID,
  plan_type public.plan_type,
  status public.subscription_status,
  expires_at TIMESTAMP WITH TIME ZONE,
  daily_limit INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as subscription_id,
    s.plan_type,
    s.status,
    s.expires_at,
    CASE 
      WHEN s.plan_type = 'free' THEN 10
      WHEN s.plan_type IN ('monthly', 'lifetime') THEN 100
      ELSE 10
    END as daily_limit
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND (s.expires_at IS NULL OR s.expires_at > NOW())
  ORDER BY 
    CASE 
      WHEN s.plan_type = 'lifetime' THEN 1
      WHEN s.plan_type = 'monthly' THEN 2  
      WHEN s.plan_type = 'free' THEN 3
    END
  LIMIT 1;
END;
$$;

-- 13. 创建函数：检查并更新过期订阅
CREATE OR REPLACE FUNCTION public.check_and_update_expired_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- 更新过期的订阅状态
  WITH expired_subs AS (
    UPDATE public.subscriptions 
    SET status = 'expired'
    WHERE status = 'active' 
      AND expires_at IS NOT NULL 
      AND expires_at <= NOW()
    RETURNING user_id
  ),
  -- 更新用户profile回到免费套餐
  updated_profiles AS (
    UPDATE public.profiles 
    SET 
      plan_type = 'free',
      subscription_id = NULL,
      plan_expires_at = NULL,
      daily_limit = 10
    WHERE id IN (SELECT user_id FROM expired_subs)
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated_profiles;
  
  RETURN updated_count;
END;
$$;

-- 14. 创建函数：更新用户订阅状态（支付成功后调用）
CREATE OR REPLACE FUNCTION public.activate_user_subscription(
  p_user_id UUID,
  p_plan_type public.plan_type,
  p_creem_order_id TEXT,
  p_creem_product_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_subscription_id UUID;
  expires_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- 计算过期时间
  IF p_plan_type = 'monthly' THEN
    expires_date := NOW() + INTERVAL '30 days';
  ELSIF p_plan_type = 'lifetime' THEN
    expires_date := NULL; -- 永久不过期
  ELSE
    RETURN FALSE; -- 免费套餐不应该通过这个函数激活
  END IF;

  -- 先将用户现有的active订阅设为过期(如果有的话)
  UPDATE public.subscriptions 
  SET status = 'expired', updated_at = NOW()
  WHERE user_id = p_user_id AND status = 'active';

  -- 创建新订阅
  INSERT INTO public.subscriptions (
    user_id, 
    plan_type, 
    status, 
    starts_at, 
    expires_at,
    creem_order_id,
    creem_product_id
  ) VALUES (
    p_user_id, 
    p_plan_type, 
    'active', 
    NOW(), 
    expires_date,
    p_creem_order_id,
    p_creem_product_id
  ) RETURNING id INTO new_subscription_id;

  -- 更新用户profile
  UPDATE public.profiles 
  SET 
    plan_type = p_plan_type,
    subscription_id = new_subscription_id,
    plan_expires_at = expires_date,
    daily_limit = CASE 
      WHEN p_plan_type IN ('monthly', 'lifetime') THEN 100 
      ELSE 10 
    END,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- 重置今天的对话次数（给用户立即体验新套餐）
  UPDATE public.profiles 
  SET 
    conversation_count = 0,
    last_conversation_date = CURRENT_DATE
  WHERE id = p_user_id AND last_conversation_date = CURRENT_DATE;

  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- 15. 更新原有的对话限制检查函数以支持订阅
CREATE OR REPLACE FUNCTION public.check_user_conversation_limit_v2(p_user_id UUID)
RETURNS public.usage_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_profile RECORD;
  today_date DATE;
  new_count INTEGER;
  user_limit INTEGER;
BEGIN
  today_date := CURRENT_DATE;
  
  -- 获取用户信息和当前有效订阅
  SELECT 
    p.*,
    COALESCE(s.daily_limit, 10) as current_daily_limit
  INTO user_profile
  FROM public.profiles p
  LEFT JOIN public.get_user_active_subscription(p_user_id) s ON true
  WHERE p.id = p_user_id;
  
  IF user_profile IS NULL THEN
    RETURN (false, '用户不存在', 0)::public.usage_status;
  END IF;

  user_limit := user_profile.current_daily_limit;

  -- 每日重置逻辑
  IF user_profile.last_conversation_date IS NULL OR user_profile.last_conversation_date < today_date THEN
    user_profile.conversation_count := 0;
  END IF;

  -- 检查限制
  IF user_profile.conversation_count >= user_limit THEN
    RETURN (false, '今日对话次数已用完，请升级套餐获取更多次数', 0)::public.usage_status;
  END IF;

  -- 更新计数
  new_count := user_profile.conversation_count + 1;
  UPDATE public.profiles
  SET
    conversation_count = new_count,
    last_conversation_date = today_date,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN (true, '操作成功', user_limit - new_count)::public.usage_status;

EXCEPTION
  WHEN OTHERS THEN
    RETURN (false, '服务器内部错误', 0)::public.usage_status;
END;
$$;

-- 16. 创建定时任务清理过期订阅的函数（需要配合cron使用）
CREATE OR REPLACE FUNCTION public.cleanup_expired_subscriptions()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER  
AS $$
DECLARE
  cleanup_count INTEGER;
BEGIN
  SELECT public.check_and_update_expired_subscriptions() INTO cleanup_count;
  RETURN format('Updated %s expired subscriptions', cleanup_count);
END;
$$;

-- 17. 添加表注释
COMMENT ON TABLE public.subscriptions IS '用户订阅表';
COMMENT ON TABLE public.payments IS '支付记录表';
COMMENT ON FUNCTION public.get_user_active_subscription IS '获取用户当前有效订阅信息';
COMMENT ON FUNCTION public.activate_user_subscription IS '激活用户订阅（支付成功后调用）';
COMMENT ON FUNCTION public.check_user_conversation_limit_v2 IS '检查用户对话限制（支持订阅套餐）';
COMMENT ON FUNCTION public.cleanup_expired_subscriptions IS '清理过期订阅状态';