# 项目工程规范

## 数据库与迁移

- Prisma Migration 必须先修改 `schema.prisma`，再通过 Prisma CLI 直接生成；禁止手工创建 Migration、手写或修改 `migration.sql`
- 生成后必须检查 Migration 内容，并通过 Prisma 官方命令从空数据库完整执行验证
- 如果 Prisma CLI 无法生成所需迁移，应停止并说明阻塞，不得自行补写 SQL
