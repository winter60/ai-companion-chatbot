-- Create profiles table for logged-in users conversation tracking
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_count INTEGER DEFAULT 0,
  last_conversation_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Create guest_usage table for tracking guest users by IP
CREATE TABLE IF NOT EXISTS public.guest_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL UNIQUE,
  conversation_count INTEGER DEFAULT 0,
  last_conversation_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only see and modify their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles  
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Enable RLS on guest_usage table
ALTER TABLE public.guest_usage ENABLE ROW LEVEL SECURITY;

-- RLS policy: Allow service role to manage guest usage
CREATE POLICY "Service role can manage guest usage" ON public.guest_usage
  FOR ALL USING (current_setting('role') = 'service_role');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS profiles_last_conversation_date_idx ON public.profiles(last_conversation_date);
CREATE INDEX IF NOT EXISTS guest_usage_ip_address_idx ON public.guest_usage(ip_address);
CREATE INDEX IF NOT EXISTS guest_usage_last_conversation_date_idx ON public.guest_usage(last_conversation_date);