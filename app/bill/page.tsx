'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { FileText, Calendar, CreditCard, CheckCircle, XCircle, Clock, ArrowLeft } from 'lucide-react';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  plan_type: string;
  creem_order_id: string;
  created_at: string;
  paid_at?: string;
  payment_method?: string;
}

export default function BillPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }
    
    setUser(session.user);
    fetchPayments(session.user.id);
  };

  const fetchPayments = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching payments:', error);
        return;
      }

      setPayments(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'refunded':
        return <XCircle className="h-5 w-5 text-gray-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'pending':
        return '处理中';
      case 'failed':
        return '失败';
      case 'refunded':
        return '已退款';
      default:
        return '未知';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'refunded':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getPlanDisplayName = (planType: string) => {
    switch (planType) {
      case 'monthly':
        return '月订版';
      case 'lifetime':
        return '永久版';
      case 'basic':
        return '基础版';
      case 'premium':
        return '高级版';
      default:
        return '未知套餐';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPaid = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载账单数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <FileText className="h-8 w-8 mr-3 text-blue-600" />
                  账单历史
                </h1>
                <p className="text-gray-600 mt-1">查看您的所有支付记录</p>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <CreditCard className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm text-blue-600">总支付金额</p>
                  <p className="text-xl font-bold text-blue-900">
                    ¥{(totalPaid / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm text-green-600">成功订单</p>
                  <p className="text-xl font-bold text-green-900">
                    {payments.filter(p => p.status === 'completed').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-gray-600 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">总订单数</p>
                  <p className="text-xl font-bold text-gray-900">
                    {payments.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment History */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">支付记录</h2>
          </div>

          {payments.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无支付记录</h3>
              <p className="text-gray-600 mb-6">您还没有任何支付记录</p>
              <button
                onClick={() => router.push('/pricing')}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                立即购买套餐
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {payments.map((payment) => (
                <div key={payment.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(payment.status)}
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {getPlanDisplayName(payment.plan_type)}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                          <span>订单号: {payment.creem_order_id}</span>
                          <span>•</span>
                          <span>{formatDate(payment.created_at)}</span>
                          {payment.payment_method && (
                            <>
                              <span>•</span>
                              <span>{payment.payment_method}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          ¥{(payment.amount / 100).toFixed(2)}
                        </p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                          {getStatusText(payment.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {payment.paid_at && payment.status === 'completed' && (
                    <div className="mt-3 text-sm text-green-600">
                      支付完成时间: {formatDate(payment.paid_at)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/pricing')}
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors mr-4"
          >
            购买更多套餐
          </button>
          <button
            onClick={() => router.push('/')}
            className="bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition-colors"
          >
            返回聊天
          </button>
        </div>
      </div>
    </div>
  );
}