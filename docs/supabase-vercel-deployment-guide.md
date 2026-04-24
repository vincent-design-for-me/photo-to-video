# Supabase + Vercel 部署指南

> 基于 Photo-to-Video 项目的真实踩坑复盘，适用于所有 Next.js + Supabase + Vercel 项目。

---

## 当时出了什么问题

这个项目发生了三个独立的问题，叠加在一起：

### 问题一：TypeScript 类型在 Vercel 上报错

`isSupabaseServiceRoleConfigured(process.env)` —— 把整个 `process.env` 传进去，在本地 TypeScript 类型检查通过，但 Vercel 的构建环境对 `NodeJS.ProcessEnv` 类型更严格，导致 `build` 失败。

**修复**：改为先显式读取变量再传入：

```ts
// 错误写法
isSupabaseServiceRoleConfigured(process.env)

// 正确写法
isSupabaseServiceRoleConfigured({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
})
```

### 问题二：RLS 策略没有覆盖 `service_role`

项目架构是：用户用浏览器（`anon key`）上传图片，但后台 workflow 用 `service_role key` 往数据库写入帧/视频路径。RLS 策略最开始只写了 `auth.uid() = user_id`，完全没有给 `service_role` 开口，导致后台任务全部写入失败。一共改了三版 migration 才修好。

**特别注意**：Supabase 普通表会自动放行 service_role，但 **Storage 不会**，必须手动在策略里加 `auth.role() = 'service_role'`。

### 问题三：认证是事后加的，而不是第一步就设计进去

`user_id` 列、RLS、ownership 检查全部是在功能做完之后才补进去，所以需要写向后兼容的逻辑（处理 `user_id is null` 的旧数据）。

**正确顺序应该是：先设计 Schema + RLS → 再写功能。**

---

## 正确的部署顺序

## 阶段一：启动前的设计（你 + AI）

### 步骤 1 — 设计数据库 Schema，同时把认证和 RLS 设计进去

**执行人：你 + AI**
**时机：写第一行业务代码之前**

> **AI Prompt：**
> ```
> 我正在构建一个 [描述你的应用] 的 Next.js + Supabase 项目。
>
> 请帮我：
> 1. 设计初始 SQL schema，包括所有核心表
> 2. 在 schema 里就加上 user_id uuid references auth.users(id)
> 3. 为每张表写好 RLS 策略，要同时覆盖：
>    - auth.uid() = user_id（用户操作自己的数据）
>    - auth.role() = 'service_role'（后台 API worker 操作）
>    - 需要公开读的行加 public 策略
> 4. 如果有 Supabase Storage，同时写好 storage.objects 的 RLS 策略
>    （注意：Storage 不会自动放行 service_role，必须手动写）
>
> 把这些写成一个完整的 supabase/migrations/001_initial_schema.sql 文件。
> ```

**你需要确认**：表结构是否符合业务逻辑，哪些数据需要公开读、哪些必须私有。

---

### 步骤 2 — 创建 `.env.example`，明确列出所有变量

**执行人：你 + AI**
**时机：写代码之前**

> **AI Prompt：**
> ```
> 根据以下技术栈，帮我生成一份完整的 .env.example：
> - Next.js 15 App Router
> - Supabase Auth + Storage + Database
> - [其他 API，例如 Kling, OpenAI 等]
>
> 规则：
> - NEXT_PUBLIC_ 前缀的变量是客户端可见的（只放 Supabase URL 和 anon key）
> - 没有 NEXT_PUBLIC_ 前缀的是服务端专用（service_role key 绝不能加 NEXT_PUBLIC_ 前缀）
> - 每个变量写上注释说明用途和从哪里获取
> ```

**注意**：同一个 Supabase URL 需要两个变量——`NEXT_PUBLIC_SUPABASE_URL`（客户端）和 `SUPABASE_URL`（服务端），这是必须的，不是重复。

---

## 阶段二：Supabase 项目初始化（你手动操作）

### 步骤 3 — 在 Supabase Dashboard 创建项目

**执行人：你（手动操作）**
**时机：本地开发环境跑通之后**

1. 登录 [supabase.com](https://supabase.com) → New Project
2. 记下这四个值（Settings → API）：

| 值 | 填入哪个变量 |
|----|-------------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` 和 `SUPABASE_URL` |
| anon key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| service_role key | `SUPABASE_SERVICE_ROLE_KEY`（绝不能公开） |

3. 如果用 Storage：Settings → Storage → 确认 bucket 名称和公开/私有设置

---

### 步骤 4 — 跑 Migration，应用 Schema

**执行人：你（手动操作）**

```bash
# 安装 Supabase CLI（如果没有）
npm install -g supabase

# 连接到你的项目
supabase link --project-ref <你的 project ref>

# 应用所有 migration
supabase db push
```

**检查点**：去 Supabase Dashboard → Table Editor，确认表已经创建；Authentication → Policies 里能看到你写的 RLS 策略。

---

### 步骤 5 — 在 Supabase 开启 Email Auth

**执行人：你（手动操作）**

Supabase Dashboard → Authentication → Providers → Email → 确认已启用。

如果不需要邮件验证：Authentication → Settings → 关闭 "Confirm email"。

---

## 阶段三：Vercel 部署（你操作 + AI 协助）

### 步骤 6 — 在 Vercel 添加所有环境变量

**执行人：你（手动操作）**
**时机：第一次 deploy 之前**

1. Vercel Dashboard → Your Project → Settings → Environment Variables
2. 把 `.env.example` 里所有变量逐个填入
3. 每个变量选择适用环境（Production / Preview / Development）
4. **`NEXT_PUBLIC_*` 变量必须勾选 Production + Preview + Development 全部三个**

---

### 步骤 7 — 让 AI 做一次 Vercel Build 检查

**执行人：AI**
**时机：第一次 deploy 前**

> **AI Prompt：**
> ```
> 帮我检查这个 Next.js + Supabase 项目在 Vercel 部署时的常见问题：
>
> 1. 检查所有读取 process.env 的地方，是否有直接把 process.env 整个传给
>    TypeScript 函数的情况（Vercel 的类型更严格，会导致 build 失败）
> 2. 检查 middleware.ts 的 matcher 是否排除了静态文件
> 3. 检查所有 server-only 的代码是否没有被客户端组件 import
> 4. 检查 next.config.ts 里是否有影响 build 的配置
>
> 如果发现问题，直接修复。
> ```

---

### 步骤 8 — 触发第一次 Deploy

**执行人：你（手动操作）**

```bash
git push origin main
```

Vercel 会自动检测到推送并开始构建。在 Vercel Dashboard 的 Deployments 页面观察 build 日志，确认没有报错。

---

### 步骤 9 — 配置 Supabase Auth 的回调 URL

**执行人：你（手动操作）**
**时机：Vercel deploy 完成后，拿到域名后**

Supabase Dashboard → Authentication → URL Configuration：

- **Site URL**：填入生产域名，例如 `https://your-app.vercel.app`
- **Redirect URLs** 添加两条：
  - `https://your-app.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`

**这步漏掉会导致：用户点击邮件验证链接后跳转失败。**

---

### 步骤 10 — 手动验证核心流程

**执行人：你（浏览器验证）**

按顺序验证以下功能：

- [ ] 首页能打开
- [ ] 注册 → 收到邮件 → 点击链接 → 跳回 app
- [ ] 登录成功
- [ ] 核心业务功能正常（上传 → 触发任务 → 结果显示）
- [ ] 刷新页面后登录状态不丢失
- [ ] 登出后不能访问受保护页面

---

## 快速对照表

| 步骤 | 执行人 | 工具 | 常见坑 |
|------|--------|------|--------|
| 1. 设计 Schema + RLS | 你 + AI | SQL | **最重要**：一开始就把 service_role 写进 RLS，Storage 要单独写 |
| 2. 写 .env.example | AI | 代码 | `NEXT_PUBLIC_` vs 服务端变量搞混 |
| 3. 创建 Supabase 项目 | 你 | Dashboard | service_role key 绝不能公开 |
| 4. 跑 migration | 你 | CLI | 先 `supabase db push`，再上线 |
| 5. 开启 Auth | 你 | Dashboard | 按需关闭邮件确认 |
| 6. 填 Vercel 环境变量 | 你 | Dashboard | deploy 前填完，不能 deploy 后再补 |
| 7. Build 检查 | AI | 代码审查 | process.env 类型问题、middleware matcher |
| 8. 触发 Deploy | 你 | git push | 观察 build 日志 |
| 9. 设回调 URL | 你 | Dashboard | 等拿到域名后再填 |
| 10. 手动验证功能 | 你 | 浏览器 | 注册→登录→核心功能全部走一遍 |

---

## RLS 策略模板

每次新建表时，直接复制这个模板：

```sql
-- 开启 RLS
alter table your_table enable row level security;

-- 用户读自己的数据
create policy "Users can view own rows"
  on your_table for select
  using (auth.uid() = user_id or auth.role() = 'service_role');

-- 用户创建自己的数据
create policy "Users can create own rows"
  on your_table for insert
  with check (auth.uid() = user_id or auth.role() = 'service_role');

-- 用户修改自己的数据
create policy "Users can update own rows"
  on your_table for update
  using (auth.uid() = user_id or auth.role() = 'service_role');
```

Storage bucket 的模板：

```sql
-- Storage 必须手动加 service_role，不会自动放行
create policy "Upload policy"
  on storage.objects for insert
  with check (
    bucket_id = 'your-bucket'
    and (auth.uid() is not null or auth.role() = 'service_role')
  );

create policy "Read policy"
  on storage.objects for select
  using (
    bucket_id = 'your-bucket'
    and (auth.uid() is not null or auth.role() = 'service_role')
  );

create policy "Delete policy"
  on storage.objects for delete
  using (
    bucket_id = 'your-bucket'
    and (auth.uid() is not null or auth.role() = 'service_role')
  );
```

---

## 核心原则（一句话版）

> 任何在服务器后台运行的代码，只要它用 `service_role key` 操作 Supabase，就必须在对应的 RLS 策略里加上 `or auth.role() = 'service_role'`，Storage 尤其不能漏。
