create table if not exists leads (id text primary key,name text not null default '',surname text not null default '',email text not null default '',whatsapp text not null default '',stage text not null default 'welcome',utm_source text not null default '',utm_medium text not null default '',utm_content text not null default '',test_generated boolean not null default false,test_username text,test_password text,test_playlist text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),test_generated_at timestamptz,test_ip_hash text,test_device_hash text);

create table if not exists chat_sessions (
 id uuid primary key default gen_random_uuid(),
 session_id text not null unique,
 lead_id text,
 stage text not null default 'welcome',
 utm_source text not null default '',
 utm_medium text not null default '',
 utm_content text not null default '',
 ip_hash text not null default '',
 device_hash text not null default '',
 user_agent text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists chat_sessions_created_idx on chat_sessions(created_at desc);
create index if not exists chat_sessions_stage_idx on chat_sessions(stage);
create index if not exists chat_sessions_lead_idx on chat_sessions(lead_id);

create table if not exists test_attempts (
 id uuid primary key default gen_random_uuid(),
 lead_id text,
 whatsapp_hash text not null,
 ip_hash text not null,
 device_hash text not null,
 fingerprint_hash text not null,
 user_agent text not null default '',
 status text not null default 'pending' check (status in ('pending','generated','failed','blocked')),
 block_reason text,
 upstream_username text,
 created_at timestamptz not null default now(),
 completed_at timestamptz
);
create index if not exists test_attempts_ip_created_idx on test_attempts(ip_hash,created_at desc);
create index if not exists test_attempts_device_idx on test_attempts(device_hash);
create index if not exists test_attempts_fingerprint_idx on test_attempts(fingerprint_hash);
create index if not exists test_attempts_whatsapp_idx on test_attempts(whatsapp_hash);
create index if not exists test_attempts_whatsapp_created_idx on test_attempts(whatsapp_hash,created_at desc);
create index if not exists test_attempts_whatsapp_generated_idx on test_attempts(whatsapp_hash,completed_at desc) where status='generated';
create index if not exists test_attempts_device_generated_idx on test_attempts(device_hash,completed_at desc) where status='generated';
create index if not exists test_attempts_fingerprint_generated_idx on test_attempts(fingerprint_hash,completed_at desc) where status='generated';
