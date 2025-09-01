# AI情感陪伴聊天机器人 - 支付功能设置指南

## 功能概述

已成功集成Creem支付系统，支持以下套餐：

### 套餐类型
- **免费版**：访客3次/天，登录用户10次/天
- **月订版**：100次/天，¥9.9，30天有效期
- **永久版**：100次/天，¥99，永久有效

### 主要特性
✅ Creem Checkout页面集成
✅ 安全的Webhook支付回调
✅ 实时订阅状态更新
✅ 自动次数限制管理
✅ 优雅的升级提示UI
✅ 双语支持（中文/英文）

## 部署配置

### 1. 数据库迁移

运行以下SQL迁移文件（按顺序）：

```sql
-- 1. 创建订阅系统表结构
\i supabase/migrations/create_subscription_system.sql
```

### 2. 环境变量配置

复制 `.env.example` 到 `.env.local` 并填入实际值：

```bash
cp .env.example .env.local
```

必需配置：
- `CREEM_API_KEY`：Creem API密钥
- `CREEM_WEBHOOK_SECRET`：Webhook验证密钥
- `NEXT_PUBLIC_APP_URL`：应用URL（用于回调）

### 3. Creem支付配置

在Creem控制台配置：
- **成功回调URL**：`https://your-domain.com/payment/success`
- **取消回调URL**：`https://your-domain.com/pricing`
- **Webhook URL**：`https://your-domain.com/api/payment/webhook`

产品ID配置：
- 月订版：`prod_4d5HDu2UIJi1sTRb2IMvDE`
- 永久版：`prod_1p1RujKUJPUS4WXAmRcZ48`

## API端点

### 支付相关API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/payment/create` | POST | 创建支付链接 |
| `/api/payment/webhook` | POST | 处理支付回调 |
| `/payment/success` | GET | 支付成功页面 |
| `/pricing` | GET | 定价页面 |

### 使用示例

创建支付订单：
```javascript
const response = await fetch('/api/payment/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: 'prod_4d5HDu2UIJi1sTRb2IMvDE',
    planType: 'monthly',
    userId: user.id
  })
})
```

## 数据库表结构

### 新增表

1. **subscriptions** - 用户订阅记录
2. **payments** - 支付记录
3. **profiles** - 扩展用户资料（新增订阅字段）

### 关键函数

- `get_user_active_subscription(user_id)` - 获取用户当前订阅
- `activate_user_subscription(...)` - 激活订阅（支付成功后）
- `check_user_conversation_limit_v2(user_id)` - 检查对话限制
- `check_and_update_expired_subscriptions()` - 处理过期订阅

## 用户界面

### 定价页面 (`/pricing`)
- 卡片式布局展示三种套餐
- 支持中英文切换
- 未登录用户需先登录
- 包含FAQ说明

### 聊天界面改进
- 实时显示剩余对话次数
- 显示当前套餐状态
- 次数不足时显示升级按钮
- 月订版显示过期时间

### 支付成功页面
- 显示支付状态（成功/处理中/失败）
- 自动跳转聊天页面
- 订单详情展示

## 安全特性

- ✅ Webhook签名验证
- ✅ 用户身份验证
- ✅ RLS数据权限控制
- ✅ 防重复处理支付
- ✅ SQL注入防护

## 测试流程

### 本地测试

1. **启动开发服务器**
   ```bash
   npm run dev
   ```

2. **测试支付流程**
   - 访问 `/pricing` 页面
   - 选择套餐并测试支付（使用测试模式）
   - 验证Webhook回调

3. **验证数据库更新**
   ```sql
   -- 检查支付记录
   SELECT * FROM payments ORDER BY created_at DESC LIMIT 5;
   
   -- 检查订阅状态
   SELECT * FROM subscriptions WHERE status = 'active';
   
   -- 检查用户profile更新
   SELECT id, plan_type, daily_limit, plan_expires_at FROM profiles;
   ```

### 生产环境验证

1. **Webhook测试**
   - 使用Creem提供的测试工具验证Webhook
   - 检查日志确保回调处理正常

2. **支付流程测试**
   - 小额测试真实支付
   - 验证用户订阅状态更新
   - 测试对话次数限制

## 常见问题

### Q: 支付成功但订阅未激活怎么办？
A: 检查Webhook处理日志，可能是回调处理失败。可以手动运行：
```sql
SELECT activate_user_subscription(user_id, plan_type, order_id, product_id);
```

### Q: 如何处理过期订阅？
A: 系统会自动检查，也可以手动运行：
```sql
SELECT cleanup_expired_subscriptions();
```

### Q: 如何查看支付统计？
A: 查询payments表：
```sql
SELECT 
  plan_type,
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM payments 
WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY plan_type, status;
```

## 联系支持

如遇问题请检查：
1. 环境变量配置
2. 数据库迁移状态
3. Creem Webhook配置
4. 服务器日志

配置完成后，用户即可享受完整的支付和订阅功能！