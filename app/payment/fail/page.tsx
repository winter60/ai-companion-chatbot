'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { XCircle, Home, CreditCard } from 'lucide-react';
import Link from 'next/link';

export default function PaymentFailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [failureReason, setFailureReason] = useState<string>('');
  // Payment details can be passed through URL params if needed

  // Get URL parameters
  const checkout_id = searchParams.get('checkout_id');
  const order_id = searchParams.get('order_id');
  const error_code = searchParams.get('error_code');
  const error_message = searchParams.get('error_message');
  const status = searchParams.get('status');

  useEffect(() => {
    // Determine failure reason based on URL parameters
    let reason = '';
    
    if (error_message) {
      reason = decodeURIComponent(error_message);
    } else if (error_code) {
      switch (error_code) {
        case 'payment_declined':
          reason = '支付被拒绝，请检查您的支付方式或联系银行';
          break;
        case 'insufficient_funds':
          reason = '余额不足，请确保账户有足够资金';
          break;
        case 'expired_card':
          reason = '支付卡已过期，请使用有效的支付方式';
          break;
        case 'network_error':
          reason = '网络连接异常，请稍后重试';
          break;
        case 'timeout':
          reason = '支付超时，请重新尝试';
          break;
        case 'cancelled':
          reason = '支付已取消';
          break;
        default:
          reason = '支付过程中出现未知错误';
      }
    } else if (status === 'cancelled') {
      reason = '支付已被取消';
    } else {
      reason = '支付未能成功完成';
    }

    setFailureReason(reason);
  }, [checkout_id, order_id, error_code, error_message, status]);

  const handleRetryPayment = () => {
    router.push('/pricing');
  };

  const handleReturnHome = () => {
    router.push('/');
  };

  const handleContactSupport = () => {
    // You can implement a support chat or email functionality here
    window.open('mailto:support@your-domain.com?subject=支付问题咨询', '_blank');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
        <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-red-600 mb-2">支付失败</h1>
        <p className="text-gray-600 mb-6">很抱歉，您的支付未能成功完成</p>

        {failureReason && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <h3 className="font-semibold text-red-800 mb-2">失败原因</h3>
            <p className="text-sm text-red-700">{failureReason}</p>
          </div>
        )}

        {(checkout_id || order_id) && (
          <div className="bg-gray-50 p-4 rounded-md mb-6 text-left">
            <h3 className="font-semibold mb-2">支付详情</h3>
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-gray-500">订单号:</span> {order_id || checkout_id}
              </p>
              <p><span className="text-gray-500">失败时间:</span> {new Date().toLocaleString('zh-CN')}</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleRetryPayment}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <CreditCard className="h-5 w-5 mr-2" />
            重新支付
          </button>
          
          <button
            onClick={handleContactSupport}
            className="w-full bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 transition-colors"
          >
            联系客服
          </button>
          
          <button
            onClick={handleReturnHome}
            className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors flex items-center justify-center"
          >
            <Home className="h-5 w-5 mr-2" />
            返回首页
          </button>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="font-semibold text-blue-800 mb-2">常见解决方案</h4>
          <ul className="text-sm text-blue-700 text-left space-y-1">
            <li>• 检查网络连接是否正常</li>
            <li>• 确认支付信息输入正确</li>
            <li>• 确保账户余额充足</li>
            <li>• 尝试更换其他支付方式</li>
            <li>• 如问题持续，请联系客服</li>
          </ul>
        </div>
      </div>
    </div>
  );
}