-- Fix for conversation limits functions
-- This script addresses function conflicts and type issues

-- 1. First, drop existing conflicting functions and types if they exist
DROP FUNCTION IF EXISTS public.increment_guest_conversation(text);
DROP FUNCTION IF EXISTS public.get_guest_usage_status(text);
DROP FUNCTION IF EXISTS public.increment_conversation_and_check_limit();
DROP FUNCTION IF EXISTS public.get_usage_status();
DROP TYPE IF EXISTS public.usage_status;

-- 2. Create a clean usage_status type
CREATE TYPE public.usage_status AS (
  success BOOLEAN,
  message TEXT,
  remaining_count INTEGER
);

-- 3. Create guest conversation function with unique name to avoid conflicts
CREATE OR REPLACE FUNCTION public.check_guest_conversation_limit(client_ip TEXT)
RETURNS public.usage_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  guest_record RECORD;
  today_date DATE;
  guest_limit INTEGER := 3; -- Guest limit: 3 conversations per day
  new_count INTEGER;
BEGIN
  -- Validate IP address parameter
  IF client_ip IS NULL OR client_ip = '' THEN
    RETURN (false, '无效的请求来源', 0)::public.usage_status;
  END IF;

  today_date := CURRENT_DATE;

  -- Query guest usage record
  SELECT * INTO guest_record FROM public.guest_usage WHERE ip_address = client_ip;
  
  -- Handle new guest IP
  IF guest_record IS NULL THEN
    INSERT INTO public.guest_usage(ip_address, conversation_count, last_conversation_date)
    VALUES (client_ip, 1, today_date);
    RETURN (true, '操作成功', guest_limit - 1)::public.usage_status;
  END IF;

  -- Daily reset logic
  IF guest_record.last_conversation_date < today_date THEN
    guest_record.conversation_count := 0;
  END IF;

  -- Check limit
  IF guest_record.conversation_count >= guest_limit THEN
    RETURN (false, '访客试用次数已用完，请登录后继续使用', 0)::public.usage_status;
  END IF;

  -- Update count
  new_count := guest_record.conversation_count + 1;
  UPDATE public.guest_usage
  SET
    conversation_count = new_count,
    last_conversation_date = today_date,
    updated_at = NOW()
  WHERE ip_address = client_ip;
  
  RETURN (true, '操作成功', guest_limit - new_count)::public.usage_status;

EXCEPTION
  WHEN OTHERS THEN
    RETURN (false, '服务器内部错误', 0)::public.usage_status;
END;
$$;

-- 4. Create user conversation function with unique name
CREATE OR REPLACE FUNCTION public.check_user_conversation_limit()
RETURNS public.usage_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  profile_record RECORD;
  today_date DATE;
  user_limit INTEGER := 10; -- Logged-in user limit: 10 conversations per day
  new_count INTEGER;
BEGIN
  -- Get current authenticated user ID
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN (false, '用户未认证', 0)::public.usage_status;
  END IF;

  today_date := CURRENT_DATE;

  -- Query user's profile record
  SELECT * INTO profile_record FROM public.profiles WHERE id = current_user_id;
  
  -- Handle new users who don't have a profile yet
  IF profile_record IS NULL THEN
    INSERT INTO public.profiles(id, conversation_count, last_conversation_date)
    VALUES (current_user_id, 1, today_date);
    RETURN (true, '操作成功', user_limit - 1)::public.usage_status;
  END IF;

  -- Daily reset logic
  IF profile_record.last_conversation_date < today_date THEN
    profile_record.conversation_count := 0;
  END IF;

  -- Check limit
  IF profile_record.conversation_count >= user_limit THEN
    RETURN (false, '今日对话次数已用完', 0)::public.usage_status;
  END IF;

  -- Update count
  new_count := profile_record.conversation_count + 1;
  UPDATE public.profiles
  SET
    conversation_count = new_count,
    last_conversation_date = today_date,
    updated_at = NOW()
  WHERE id = current_user_id;

  RETURN (true, '操作成功', user_limit - new_count)::public.usage_status;

EXCEPTION
  WHEN OTHERS THEN
    RETURN (false, '服务器内部错误', 0)::public.usage_status;
END;
$$;

-- 5. Create status check functions (without incrementing) with proper reset logic
CREATE OR REPLACE FUNCTION public.get_user_usage_status()
RETURNS public.usage_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  profile_record RECORD;
  today_date DATE;
  user_limit INTEGER := 10;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN (false, '用户未认证', 0)::public.usage_status;
  END IF;

  today_date := CURRENT_DATE;
  SELECT * INTO profile_record FROM public.profiles WHERE id = current_user_id;
  
  IF profile_record IS NULL THEN
    RETURN (true, '新用户', user_limit)::public.usage_status;
  END IF;

  -- Reset count if it's a new day and actually update the database
  IF profile_record.last_conversation_date < today_date THEN
    UPDATE public.profiles 
    SET conversation_count = 0, 
        last_conversation_date = today_date,
        updated_at = NOW()
    WHERE id = current_user_id;
    RETURN (true, '今日次数已重置', user_limit)::public.usage_status;
  END IF;

  -- Check if limit reached
  IF profile_record.conversation_count >= user_limit THEN
    RETURN (false, '今日对话次数已用完', 0)::public.usage_status;
  END IF;

  RETURN (true, '获取成功', user_limit - profile_record.conversation_count)::public.usage_status;
END;
$$;

-- 6. Create guest status check function
CREATE OR REPLACE FUNCTION public.get_guest_conversation_status(client_ip TEXT)
RETURNS public.usage_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  guest_record RECORD;
  today_date DATE;
  guest_limit INTEGER := 3;
BEGIN
  IF client_ip IS NULL OR client_ip = '' THEN
    RETURN (false, '无效的请求来源', 0)::public.usage_status;
  END IF;

  today_date := CURRENT_DATE;
  SELECT * INTO guest_record FROM public.guest_usage WHERE ip_address = client_ip;
  
  IF guest_record IS NULL THEN
    RETURN (true, '新访客', guest_limit)::public.usage_status;
  END IF;

  -- Reset count if it's a new day
  IF guest_record.last_conversation_date < today_date THEN
    RETURN (true, '今日次数已重置', guest_limit)::public.usage_status;
  END IF;

  RETURN (true, '获取成功', guest_limit - guest_record.conversation_count)::public.usage_status;
END;
$$;