# Scripts Directory

此目录包含项目的各种脚本文件，按功能分类组织。

## 目录结构

- `tests/` - 测试脚本
- `debug/` - 调试和开发工具脚本  
- `database-fixes/` - 数据库修复和迁移脚本

## 使用方法

从项目根目录运行脚本：

```bash
# 测试脚本
node scripts/tests/test-usage-limits.js
node scripts/tests/test-guest-flow.js

# 调试脚本
node scripts/debug/debug-database.js
node scripts/debug/quick-test.js

# 数据库修复
# 请谨慎执行，建议先在测试环境验证
psql -f scripts/database-fixes/fix-v2-functions.sql
```

## 兼容性

根目录中的脚本文件将逐步迁移到此结构中。