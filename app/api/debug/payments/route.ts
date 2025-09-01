import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    const userId = searchParams.get('userId');

    if (orderId) {
      // 查找特定订单
      const { data: payments, error } = await supabaseServer
        .from('payments')
        .select('*')
        .eq('creem_order_id', orderId)
        .order('created_at', { ascending: false });

      return NextResponse.json({
        orderId,
        payments,
        error: error?.message
      });
    } else if (userId) {
      // 查找用户的所有支付记录
      const { data: payments, error } = await supabaseServer
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      return NextResponse.json({
        userId,
        payments,
        error: error?.message
      });
    } else {
      // 查看最近的支付记录
      const { data: payments, error } = await supabaseServer
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      return NextResponse.json({
        recentPayments: payments,
        error: error?.message
      });
    }
  } catch (error) {
    return NextResponse.json({ 
      error: 'Debug endpoint error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}