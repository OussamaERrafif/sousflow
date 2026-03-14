# SoussFlow — Multi-Role & Chat Overhaul: Detailed Implementation Plan

> **Scope:** Restructure the database and application from a single-user model to a
> **Farm-scoped, role-based model** with Super Admin / Farm Owner / Farm Employee roles,
> plus a first-class Chat Conversations system with persistent history.
>
> **Not** a multi-tenant architecture — all farms share the same schema,
> access is controlled by RLS + role logic per request.
>
> **Super Admin** (app developer) interacts only via the `/dashboard` backend route —
> **no backend auth is added for the super admin in this phase.**

---

## Table of Contents

1. [Role Model](#1-role-model)
2. [Database Schema Changes](#2-database-schema-changes)
   - 2.1 New Tables
   - 2.2 Modified Tables
   - 2.3 Dropped / Replaced Columns
   - 2.4 RLS Policy Redesign
   - 2.5 Migration Strategy
3. [Backend Changes](#3-backend-changes)
   - 3.1 Auth Layer
   - 3.2 New Routes
   - 3.3 Modified Routes & Services
   - 3.4 Chat Conversations
4. [Frontend Changes](#4-frontend-changes)
   - 4.1 Auth State
   - 4.2 New Pages / Components
   - 4.3 API Codegen
5. [File-by-File Change Map](#5-file-by-file-change-map)
6. [Implementation Order](#6-implementation-order)
7. [Full New SQL Schema](#7-full-new-sql-schema)

---

## 1. Role Model

### Roles

| Role | Who | Access |
|------|-----|--------|
| `super_admin` | App developer (you) | Backend `/dashboard` only — no API auth in this phase |
| `farm_owner` | Business owner of a farm | Full CRUD on their farm's data, zones, employees, alerts, chat |
| `farm_employee` | Worker assigned to a farm | Read most data; write IoT readings; cannot manage employees or delete alert rules |

### Key Design Decisions

- **Farm is the central entity.** IoT readings, predictions, alerts, and chat conversations are all scoped to a `farm_id`, not a `user_id`.
- **`user_profiles` table** (public schema) extends `auth.users` with `role`, `full_name`, `phone`, and `farm_id` (for employees). Farm owners are linked to farms via the `farms.owner_id` column.
- **`farm_memberships` table** allows a farm owner to add employees to their farm. One employee can only belong to one farm at a time (simplest model — revisit if needed).
- **Super Admin is not a Supabase auth user in this phase.** They access the unauthenticated `/dashboard` HTML page directly. This keeps the backend simple.
- **No cross-farm data leakage.** RLS ensures a farm owner or employee can only see rows where `farm_id` matches their farm.

---

## 2. Database Schema Changes

### 2.1 New Tables

#### `user_profiles`
Extends `auth.users` one-to-one. Stores application-level role and metadata.

```sql
CREATE TABLE user_profiles (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role       TEXT NOT NULL DEFAULT 'farm_employee'
                   CHECK (role IN ('farm_owner', 'farm_employee')),
    full_name  TEXT,
    phone      TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- `id` is the same UUID as `auth.users.id` (1-to-1 relationship).
- Role `super_admin` is **not** stored here — super admin does not have a Supabase auth account in this phase.
- A Supabase trigger auto-creates a `user_profiles` row on `auth.users` INSERT.

#### `farms`
The central entity. Each farm belongs to one owner.

```sql
CREATE TABLE farms (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    name         TEXT NOT NULL,
    location     TEXT,                  -- e.g. "Ait Melloul, Agadir"
    total_zones  INTEGER DEFAULT 4,
    description  TEXT,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- `owner_id` must also have `role = 'farm_owner'` in `user_profiles` (enforced at app level, not DB level to keep schema simple).
- A farm owner can own multiple farms (one-to-many owner→farms). Frontend shows a farm picker.

#### `farm_memberships`
Links farm employees to a farm. Farm owners are NOT in this table — they own via `farms.owner_id`.

```sql
CREATE TABLE farm_memberships (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id     UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    permissions JSONB NOT NULL DEFAULT '{"read": true, "write_readings": true}',
    is_active   BOOLEAN DEFAULT TRUE,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, user_id)
);
```

`permissions` JSONB structure (evolve over time without schema migrations):
```json
{
  "read": true,
  "write_readings": true,
  "manage_alerts": false,
  "manage_employees": false
}
```

#### `conversations`
First-class chat conversation entity. Each conversation belongs to a user AND a farm.

```sql
CREATE TABLE conversations (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    farm_id    UUID REFERENCES farms(id) ON DELETE SET NULL,
    title      TEXT NOT NULL DEFAULT 'New Conversation',
    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- `farm_id` links the conversation to a farm so the AI can pull that farm's sensor data as context.
- `title` is auto-generated from the first user message (truncated to ~60 chars) or manually renamed.
- `updated_at` is bumped on every new message (used for "most recent first" ordering in the UI).

---

### 2.2 Modified Tables

#### `iot_readings` — replace `user_id` with `farm_id`

```diff
- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
+ farm_id      UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
+ recorded_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
```

- `farm_id` is the primary scope for all queries.
- `recorded_by` tracks which user (owner or employee) inserted the reading (nullable for simulator/IoT device inserts).

#### `predictions` — replace `user_id` with `farm_id`

```diff
- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
+ farm_id     UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
+ created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
```

#### `alert_rules` — replace `user_id` with `farm_id`

```diff
- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
+ farm_id     UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
+ created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
```

#### `alert_history` — replace `user_id` with `farm_id`

```diff
- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
+ farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
```

#### `chat_messages` — replace `conversation_id TEXT` with proper FK

```diff
- conversation_id TEXT NOT NULL,
- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
+ conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
+ sender_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
```

- `conversation_id` becomes a proper UUID FK to the `conversations` table.
- `sender_id` replaces `user_id` (assistant messages have `sender_id = NULL`).

---

### 2.3 Dropped / Replaced Columns

| Table | Dropped | Reason |
|-------|---------|--------|
| `iot_readings` | `user_id` | Replaced by `farm_id` + `recorded_by` |
| `predictions` | `user_id` | Replaced by `farm_id` + `created_by` |
| `alert_rules` | `user_id` | Replaced by `farm_id` + `created_by` |
| `alert_history` | `user_id` | Replaced by `farm_id` |
| `chat_messages` | `user_id`, `conversation_id TEXT` | Replaced by `sender_id`, `conversation_id UUID FK` |

---

### 2.4 RLS Policy Redesign

All tables use the same access pattern: **"can the requesting user access this farm?"**

We create a PostgreSQL helper function to check membership:

```sql
-- Returns TRUE if the calling auth.uid() is the owner of farm_id
-- OR is an active member of farm_id
CREATE OR REPLACE FUNCTION can_access_farm(farm_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM farms WHERE id = farm_uuid AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM farm_memberships
    WHERE farm_id = farm_uuid AND user_id = auth.uid() AND is_active = TRUE
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
```

Then each table's SELECT policy becomes:
```sql
CREATE POLICY "farm_access_select" ON iot_readings
  FOR SELECT USING (can_access_farm(farm_id));
```

**Write policies differentiate roles:**

```sql
-- Only farm owner can create alert rules
CREATE POLICY "owner_insert_alert_rules" ON alert_rules
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM farms WHERE id = farm_id AND owner_id = auth.uid())
  );

-- Employees can insert IoT readings
CREATE POLICY "member_insert_readings" ON iot_readings
  FOR INSERT WITH CHECK (can_access_farm(farm_id));
```

**`user_profiles` RLS:**
```sql
-- Users can only read/update their own profile
CREATE POLICY "own_profile_select" ON user_profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "own_profile_update" ON user_profiles FOR UPDATE USING (id = auth.uid());
```

**`farms` RLS:**
```sql
-- Owners see their farms; members see their farm
CREATE POLICY "farms_select" ON farms FOR SELECT USING (can_access_farm(id));
-- Only owners can update/delete their farm
CREATE POLICY "farms_update" ON farms FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "farms_delete" ON farms FOR DELETE USING (owner_id = auth.uid());
-- Anyone authenticated can create a farm (they become owner)
CREATE POLICY "farms_insert" ON farms FOR INSERT WITH CHECK (owner_id = auth.uid());
```

**`farm_memberships` RLS:**
```sql
-- Members and owners can see memberships for their farm
CREATE POLICY "memberships_select" ON farm_memberships
  FOR SELECT USING (can_access_farm(farm_id));
-- Only farm owners can add/remove members
CREATE POLICY "memberships_insert" ON farm_memberships
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM farms WHERE id = farm_id AND owner_id = auth.uid())
  );
CREATE POLICY "memberships_update" ON farm_memberships
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM farms WHERE id = farm_id AND owner_id = auth.uid())
  );
CREATE POLICY "memberships_delete" ON farm_memberships
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM farms WHERE id = farm_id AND owner_id = auth.uid())
  );
```

**`conversations` RLS:**
```sql
-- User sees only their own conversations
CREATE POLICY "own_conversations_select" ON conversations
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own_conversations_insert" ON conversations
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_conversations_update" ON conversations
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "own_conversations_delete" ON conversations
  FOR DELETE USING (user_id = auth.uid());
```

**`chat_messages` RLS:**
```sql
-- Users see messages in conversations they own
CREATE POLICY "own_chat_messages_select" ON chat_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND user_id = auth.uid())
  );
CREATE POLICY "own_chat_messages_insert" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND user_id = auth.uid())
  );
```

---

### 2.5 Migration Strategy

Since this is a **breaking schema change**, the migration approach is:

1. **Create new tables** (`user_profiles`, `farms`, `farm_memberships`, `conversations`) first.
2. **Add new columns** (`farm_id`, `recorded_by`, etc.) as nullable to existing tables.
3. **Data migration script**: For each existing `user_id`, create one farm per user and back-fill `farm_id`.
4. **Make `farm_id` NOT NULL** after back-fill.
5. **Drop old `user_id` columns**.
6. **Recreate indexes** on `farm_id`.
7. **Drop and recreate RLS policies**.

> **Note:** Because this is a dev/pre-production project, the migration can be run as a single destructive SQL script in the Supabase SQL Editor. A `ROLLBACK`-safe migration script will be provided.

---

## 3. Backend Changes

### 3.1 Auth Layer (`app/auth.py`)

**Current:** `get_current_user()` returns `{id, email, role, user_metadata}`.

**New:** `get_current_user()` additionally fetches `user_profiles` and the user's active farm(s), returning:

```python
{
    "id": "uuid",
    "email": "user@example.com",
    "role": "farm_owner",          # from user_profiles
    "full_name": "Ahmed Benali",
    "farm_ids": ["uuid1", "uuid2"], # farms owned or memberships
    "active_farm_id": "uuid1",      # resolved from X-Farm-ID header or first farm
}
```

New helper: `get_current_farm_id(request, current_user)` — reads `X-Farm-ID` header or falls back to first farm.

New dependency: `require_farm_owner` — raises 403 if `current_user["role"] != "farm_owner"`.

---

### 3.2 New Routes

#### `app/routes/farm_routes.py` — `/api/farms`

| Method | Path | Who | Action |
|--------|------|-----|--------|
| `GET` | `/api/farms` | owner/employee | List accessible farms |
| `POST` | `/api/farms` | owner | Create a farm |
| `GET` | `/api/farms/{farm_id}` | owner/employee | Get farm details |
| `PUT` | `/api/farms/{farm_id}` | owner | Update farm |
| `DELETE` | `/api/farms/{farm_id}` | owner | Delete farm |

#### `app/routes/member_routes.py` — `/api/farms/{farm_id}/members`

| Method | Path | Who | Action |
|--------|------|-----|--------|
| `GET` | `/api/farms/{farm_id}/members` | owner | List members |
| `POST` | `/api/farms/{farm_id}/members` | owner | Invite a member (by email) |
| `PUT` | `/api/farms/{farm_id}/members/{user_id}` | owner | Update permissions |
| `DELETE` | `/api/farms/{farm_id}/members/{user_id}` | owner | Remove member |

#### `app/routes/conversation_routes.py` — `/api/conversations`

| Method | Path | Who | Action |
|--------|------|-----|--------|
| `GET` | `/api/conversations` | any | List user's conversations (paginated) |
| `POST` | `/api/conversations` | any | Create a new conversation |
| `GET` | `/api/conversations/{conv_id}` | any | Get conversation metadata |
| `PUT` | `/api/conversations/{conv_id}` | any | Rename conversation |
| `DELETE` | `/api/conversations/{conv_id}` | any | Delete conversation + all messages |

---

### 3.3 Modified Routes & Services

#### `app/routes/iot_routes.py`
- All endpoints: replace `user["id"]` with `farm_id` (resolved via `X-Farm-ID` header helper).
- `create_reading`: add `recorded_by=user["id"]` to the insert payload.
- Simulator routes: restrict to `farm_owner` role only.

#### `app/routes/openai_routes.py`
- `/api/chat` now accepts `conversation_id` (UUID). If not provided, the backend auto-creates a new conversation for the user.
- `/api/chat/history/{conversation_id}` — existing endpoint, updated to use new FK.
- Remove `/api/chat/history/{conversation_id}` string-based lookup; now UUID-based.
- Auto-title: after the first AI response, if `conversations.title == 'New Conversation'`, update title to first 60 chars of the user message.

#### `app/services/openai_service.py`
- `chat(user_id, conversation_id, user_message)` → `chat(user_id, farm_id, conversation_id, user_message)`
- Sensor context pulled using `farm_id` instead of `user_id`.
- `get_history(conversation_id)` remains the same signature.
- New: `list_conversations(user_id)` — returns paginated list with last message preview.
- New: `create_conversation(user_id, farm_id, title)` — inserts into `conversations`.
- New: `delete_conversation(user_id, conversation_id)` — deletes conversation + cascades messages.

#### `app/services/iot_service.py`
- Replace all `user_id` params with `farm_id`.
- Update all Supabase queries: `.eq("user_id", user_id)` → `.eq("farm_id", farm_id)`.

#### `app/services/prediction_service.py`
- Same `user_id` → `farm_id` replacement.

---

### 3.4 Chat Conversations

**New flow:**

```
Frontend                          Backend
   │                                 │
   │── POST /api/conversations ──────►│ creates row in conversations
   │◄─ {id, title, farm_id} ─────────│
   │                                 │
   │── POST /api/chat ───────────────►│ {conversation_id, message}
   │  (conversation_id in body)       │  → saves user msg → calls OpenAI
   │                                 │  → saves assistant msg
   │                                 │  → if first msg: auto-update title
   │◄─ {response, conversation_id} ──│
   │                                 │
   │── GET /api/conversations ────────►│ returns list sorted by updated_at DESC
   │◄─ [{id, title, last_message,    │
   │     updated_at, message_count}] │
```

**Conversation list response shape:**
```json
[
  {
    "id": "uuid",
    "title": "Soil moisture zone 3 dropping",
    "farm_id": "uuid",
    "message_count": 12,
    "last_message": "The soil moisture in zone 3 has dropped below...",
    "last_message_at": "2026-03-14T10:23:00Z",
    "created_at": "2026-03-14T09:00:00Z"
  }
]
```

---

## 4. Frontend Changes

### 4.1 Auth State (`src/lib/store/slices/authSlice.ts`)

Add fields to auth state:

```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  // NEW:
  role: 'farm_owner' | 'farm_employee' | null;
  activeFarmId: string | null;
  farms: Farm[];
}
```

The `activeFarmId` is persisted to `localStorage` and sent as `X-Farm-ID` header in all API requests via the RTK Query `prepareHeaders` function.

### 4.2 New Pages / Components

#### `src/app/[locale]/farms/page.tsx` (Farm Owner only)
- Farm list + create form.
- Each farm card links to member management.

#### `src/app/[locale]/farms/[farmId]/members/page.tsx` (Farm Owner only)
- List current employees with their permissions.
- "Invite employee" form (by email).
- Toggle permissions (manage alerts, etc.).
- Remove employee button.

#### `src/components/FarmSwitcher.tsx`
- Shown in `Sidebar` for users with multiple farms.
- Dropdown: lists farm names. On select → updates `activeFarmId` in Redux + localStorage.

#### `src/app/[locale]/chat/page.tsx` — Updated
Current: single conversation view.
New layout:
```
┌─────────────────────────────────────────────────────────┐
│  Sidebar (conversations list)  │  Chat window           │
│  ──────────────────────────    │  ──────────────────   │
│  [+ New Conversation]          │  Message 1 (user)      │
│  ──────────────────────────    │  Message 2 (assistant) │
│  📝 Soil moisture zone 3...    │  ...                   │
│  📝 Weekly irrigation plan     │  [Input + Send]        │
│  📝 Reservoir level alert...   │                        │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- `ConversationList` — paginated list, sorted by `updated_at DESC`.
- `ConversationItem` — shows title + last message preview + relative timestamp.
- `ChatWindow` — existing message thread, updated to load by `conversation_id`.
- `NewConversationButton` — calls `POST /api/conversations` then navigates to new convo.

### 4.3 API Codegen

After backend changes, run:
```bash
cd frontend
npm run codegen
```

This regenerates `src/lib/store/generated/api.ts` with new endpoints:
- `useFarmsQuery`, `useCreateFarmMutation`
- `useFarmMembersQuery`, `useInviteMemberMutation`, `useRemoveMemberMutation`
- `useConversationsQuery`, `useCreateConversationMutation`, `useDeleteConversationMutation`

---

## 5. File-by-File Change Map

### Backend

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/supabase_schema.sql` | **REPLACE** | Full new schema (see §7) |
| `backend/app/auth.py` | **MODIFY** | Add role + farm context to `get_current_user`; add `require_farm_owner` dependency |
| `backend/app/config.py` | **MODIFY** | Add `IOT_SIMULATOR_FARM_ID` replacing `IOT_SIMULATOR_USER_ID` |
| `backend/app/schemas/auth.py` | **MODIFY** | Add `role`, `farm_ids` to `UserProfile` response |
| `backend/app/schemas/iot.py` | **MODIFY** | Replace `user_id` with `farm_id` in request/response models |
| `backend/app/schemas/openai_schemas.py` | **MODIFY** | Add `conversation_id` to `ChatRequest`; add `ConversationResponse` schema |
| `backend/app/schemas/prediction.py` | **MODIFY** | Replace `user_id` with `farm_id` |
| `backend/app/schemas/farm.py` | **NEW** | `FarmCreate`, `FarmResponse`, `MemberCreate`, `MemberResponse`, `PermissionsSchema` |
| `backend/app/routes/__init__.py` | **MODIFY** | Export new routers |
| `backend/app/routes/farm_routes.py` | **NEW** | CRUD for farms + membership management |
| `backend/app/routes/conversation_routes.py` | **NEW** | CRUD for conversations |
| `backend/app/routes/iot_routes.py` | **MODIFY** | `user_id` → `farm_id`; resolve farm from header |
| `backend/app/routes/openai_routes.py` | **MODIFY** | Accept `conversation_id`; auto-create if missing |
| `backend/app/routes/prediction_routes.py` | **MODIFY** | `user_id` → `farm_id` |
| `backend/app/routes/auth_routes.py` | **MODIFY** | `/profile` returns role + farms; `/signup` creates `user_profiles` row |
| `backend/app/services/iot_service.py` | **MODIFY** | All queries: `user_id` → `farm_id` |
| `backend/app/services/iot_simulator.py` | **MODIFY** | `user_id` param → `farm_id` param |
| `backend/app/services/prediction_service.py` | **MODIFY** | `user_id` → `farm_id` |
| `backend/app/services/openai_service.py` | **MODIFY** | Add `farm_id`; update sensor context; add `list_conversations`, `create_conversation`, `delete_conversation` |
| `backend/app/services/farm_service.py` | **NEW** | Business logic for farm CRUD and membership management |
| `backend/main.py` | **MODIFY** | Register new routers; update simulator startup to use `farm_id` |

### Frontend

| File | Change Type | Description |
|------|-------------|-------------|
| `src/lib/store/slices/authSlice.ts` | **MODIFY** | Add `role`, `activeFarmId`, `farms` to state + actions |
| `src/lib/store/apiSlice.ts` | **MODIFY** | Add `X-Farm-ID` to `prepareHeaders` |
| `src/lib/store/slices/api.ts` | **MODIFY** | Add/update manual endpoints for farms, conversations |
| `src/lib/store/generated/api.ts` | **REGENERATE** | Run `npm run codegen` |
| `src/app/[locale]/page.tsx` | **MODIFY** | Load farms on auth; redirect to farm setup if no farms |
| `src/app/[locale]/chat/page.tsx` | **MODIFY/REWRITE** | Two-panel layout with conversation list + chat window |
| `src/app/[locale]/farms/page.tsx` | **NEW** | Farm management page |
| `src/app/[locale]/farms/[farmId]/members/page.tsx` | **NEW** | Member management page |
| `src/components/Sidebar.tsx` | **MODIFY** | Add "Farm" nav item (owner only); add `FarmSwitcher` |
| `src/components/FarmSwitcher.tsx` | **NEW** | Farm selection dropdown |
| `src/components/chat/ConversationList.tsx` | **NEW** | Left panel: list of conversations |
| `src/components/chat/ConversationItem.tsx` | **NEW** | Single conversation row |
| `src/components/chat/ChatWindow.tsx` | **NEW** | Right panel: message thread (extracted from chat page) |
| `frontend/messages/ar.json` | **MODIFY** | Add translation keys for farms, members, conversations |
| `frontend/messages/fr.json` | **MODIFY** | Add translation keys for farms, members, conversations |

---

## 6. Implementation Order

### Step 1 — Database (run in Supabase SQL Editor)
1. Run `backend/supabase_schema.sql` (new full schema — see §7).
   - Creates all new tables.
   - Back-fills farm from existing users.
   - Drops old columns.
   - Sets up new RLS.

### Step 2 — Backend Core
2. Update `app/config.py` — add `IOT_SIMULATOR_FARM_ID`.
3. Add `app/schemas/farm.py`.
4. Update `app/auth.py` — enriched `get_current_user` + `require_farm_owner`.
5. Add `app/services/farm_service.py`.
6. Add `app/routes/farm_routes.py` + `app/routes/conversation_routes.py`.
7. Register new routers in `app/routes/__init__.py` and `main.py`.

### Step 3 — Backend: Update Existing Services
8. Update `app/services/iot_service.py` — `user_id` → `farm_id`.
9. Update `app/services/iot_simulator.py` — `user_id` → `farm_id`.
10. Update `app/services/prediction_service.py`.
11. Update `app/services/openai_service.py` — add conversation management + `farm_id` context.

### Step 4 — Backend: Update Existing Routes
12. Update `app/routes/iot_routes.py`.
13. Update `app/routes/openai_routes.py`.
14. Update `app/routes/auth_routes.py` — include role + farms in profile.
15. Update `app/routes/prediction_routes.py`.
16. Update `app/schemas/` (auth, iot, openai_schemas, prediction).

### Step 5 — Frontend Auth & Farm Context
17. Update `authSlice.ts` — add role, activeFarmId, farms.
18. Update `apiSlice.ts` — inject `X-Farm-ID` header.
19. Update `page.tsx` (dashboard) — fetch farms on login.

### Step 6 — Frontend: New Pages
20. Build `farms/page.tsx` + `FarmSwitcher` component.
21. Build `farms/[farmId]/members/page.tsx`.

### Step 7 — Frontend: Chat Overhaul
22. Build `ConversationList`, `ConversationItem`, `ChatWindow` components.
23. Rewrite `chat/page.tsx` with two-panel layout.

### Step 8 — Codegen + Translations
24. Run `npm run codegen` in `frontend/`.
25. Update `messages/ar.json` and `messages/fr.json`.

### Step 9 — Sidebar + Guards
26. Update `Sidebar.tsx` — add Farm nav item + role guard.
27. Add route guard for owner-only pages.

---

## 7. Full New SQL Schema

The complete replacement schema is saved at:
**`backend/supabase_schema_v2.sql`**

It includes (in order):
1. Extensions
2. `user_profiles` table + trigger (auto-create on signup)
3. `farms` table
4. `farm_memberships` table
5. `conversations` table
6. Modified `iot_readings` (farm-scoped)
7. Modified `predictions` (farm-scoped)
8. Modified `alert_rules` (farm-scoped)
9. Modified `alert_history` (farm-scoped)
10. Modified `chat_messages` (proper FK to conversations)
11. `whatsapp_messages` (unchanged)
12. All indexes
13. `can_access_farm()` helper function
14. All RLS policies

---

## Open Questions / Decisions Needed Before Implementation

| # | Question | Current Assumption |
|---|----------|--------------------|
| 1 | Can an employee belong to more than one farm? | No — `UNIQUE(farm_id, user_id)` but one user = one active farm |
| 2 | Can a farm owner also be an employee of another farm? | Allowed (different `farm_id`) |
| 3 | Does employee signup require an invite link, or can anyone sign up and then be added? | Owner adds by email after signup |
| 4 | Should conversations be farm-scoped or user-scoped? | User-scoped with optional farm context for AI sensor data |
| 5 | Should `super_admin` ever need API access (not just dashboard)? | No — dashboard only, no auth for this phase |
| 6 | Max farms per owner? | Unlimited for now |
| 7 | Should the IoT simulator be farm-aware (per-farm simulator)? | Yes — `IOT_SIMULATOR_FARM_ID` env var |

---

*Document version: 1.0 — 2026-03-14*
*Next step: Confirm open questions, then begin Step 1 (database schema).*
