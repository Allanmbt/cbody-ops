# pg_cron supabase任务执行文档说明

## 常用命令操作
```sql
-- 开启pg_cron
create extension if not exists pg_cron with schema extensions;

-- 新建计划任务（返回 jobid）
select cron.schedule(
  'apply_due_price_changes',                    -- 任务名，自定义 
  '*/1 * * * *',                                -- CRON 表达式：每 1 分钟 
  $$select public.apply_due_price_changes();$$  --执行的函数名
);

-- 查看任务
SELECT * FROM cron.job;

-- 所有任务
select * from cron.job order by jobid;

-- 立即执行任务 select + 函数名 下方为清理cron记录 （保留30天记录）
select public.cleanup_pgcron_history(30);

-- 最近执行历史（含成功/失败、耗时）
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'apply-price-changes')
ORDER BY start_time DESC LIMIT 10;

select * from cron.job_run_details order by start_time desc limit 50; --最近50次历史

-- 修改计划（示例：把某 jobid 改为每分钟）
select cron.alter_job(job_id := <JOBID>, schedule := '*/1 * * * *');

-- 修改要执行的 SQL（换函数或增加参数）
select cron.alter_job(job_id := <JOBID>, command := $$select public.apply_due_price_changes();$$);

-- 取消/删除 任务
select cron.unschedule(<JOBID>);
--或者
SELECT cron.unschedule('apply-price-changes');

```

## 客户端 CBODY
```sql
-- 暂无
```

## 技师端 CBODY GO
```sql
-- pg_cron: 每分钟执行 到点应用改价（把 pending → applied，并写回生效价）
select cron.schedule('apply_due_price_changes',
       '*/1 * * * *',
       $$select public.apply_due_price_changes();$$);

```

## 管理后端 CBODY-OPS
```sql
-- 暂无
```

## 通用的
```sql
-- 自动清除历史记录 仅保留30天
create or replace function public.cleanup_pgcron_history(p_keep_days int default 30)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  delete from cron.job_run_details
  where start_time < now() - make_interval(days => p_keep_days);
end;
$func$;

-- cleanup_pgcron_history 自动清除历史记录 仅保留30天
do $job$
declare
  jid int;
begin
  select jobid into jid
  from cron.job
  where jobname = 'cleanup_pgcron_history_daily_ict6';

  if jid is null then
    perform cron.schedule(
      'cleanup_pgcron_history_daily_ict6',
      '0 23 * * *',                         -- 23:00 UTC = 06:00 ICT(+7)
      $cmd$select public.cleanup_pgcron_history(30);$cmd$
    );
  else
    perform cron.alter_job(
      job_id  := jid,
      schedule:= '0 23 * * *',
      command := $cmd$select public.cleanup_pgcron_history(30);$cmd$
    );
  end if;
end
$job$;

```
