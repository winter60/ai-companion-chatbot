import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const { productId, userId, email, name } = await req.json();
    console.log('Checkout request:', { productId, userId, email, name });

    if (!productId || !userId) {
      console.error('Missing required fields:', { productId, userId });
      return NextResponse.json({ error: 'Product ID and User ID are required' }, { status: 400 });
    }

    // Verify user exists
    const { data: user, error: userError } = await supabaseServer.auth.admin.getUserById(userId);
    if (userError || !user) {
      console.error('User verification failed:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const creem_url = process.env.CREEM_API_BASE_URL;
    const api_key = process.env.CREEM_API_KEY;
    const app_url = process.env.NEXT_PUBLIC_APP_URL;

    console.log('Environment variables check:', { 
      creem_url: !!creem_url, 
      api_key: !!api_key, 
      app_url: !!app_url 
    });

    if (!creem_url || !api_key || !app_url) {
      console.error('Missing environment variables:', { creem_url, api_key, app_url });
      return NextResponse.json({ error: 'Missing environment variables' }, { status: 500 });
    }

    const checkoutData = {
      product_id: productId,
      success_url: `${app_url}/payment/success`,
      request_id: userId, // Use user ID as request_id for tracking
    };

    console.log('Checkout data:', checkoutData);
    console.log('Making request to:', `${creem_url}/v1/checkouts`);

    const response = await fetch(`${creem_url}/v1/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': api_key,
      },
      body: JSON.stringify(checkoutData),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Creem API error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      return NextResponse.json({ 
        error: 'Failed to create checkout session',
        details: errorText,
        status: response.status
      }, { status: 500 });
    }

    const checkoutSession = await response.json();
    console.log('Creem checkout response:', checkoutSession);
    
    // 确定计划类型
    let planType = 'free';
    let amount = 0;
    if (productId === process.env.NEXT_PUBLIC_CREEM_MONTHLY_PRODUCT_ID) {
      planType = 'monthly';
      amount = 990; // 9.9元 = 990分
    } else if (productId === process.env.NEXT_PUBLIC_CREEM_LIFETIME_PRODUCT_ID) {
      planType = 'lifetime';
      amount = 9900; // 99元 = 9900分
    }

    const sessionId = checkoutSession.id || checkoutSession.checkout_id;

    // 检查是否已存在支付记录
    const { data: existingPayment } = await supabaseServer
      .from('payments')
      .select('id')
      .eq('creem_order_id', sessionId)
      .single();

    // 只在不存在记录时创建
    if (!existingPayment) {
      const { error: paymentError } = await supabaseServer
        .from('payments')
        .insert({
          user_id: userId,
          creem_order_id: sessionId,
          amount: amount,
          plan_type: planType,
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (paymentError) {
        console.error('Failed to create payment record:', paymentError);
      }
    } else {
      console.log('Payment record already exists for order:', sessionId);
    }
    
    return NextResponse.json({ 
      checkoutUrl: checkoutSession.url || checkoutSession.checkout_url,
      sessionId: checkoutSession.id || checkoutSession.checkout_id
    });

  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}