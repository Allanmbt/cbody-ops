-- ========================================
-- 聊天记录清理 SQL 文档
-- ========================================
-- 功能：
-- 1. 清除超过90天的聊天记录及其图片文件
-- 2. 清除无效线程（无已完成订单且超过3天的线程）
-- 3. 支持单条线程测试删除
-- ========================================

-- ========================================
-- 一、查询需要清理的数据（测试用）
-- ========================================

-- 1.1 查询超过90天的聊天消息（包含图片 URL）
SELECT
    cm.id AS message_id,
    cm.thread_id,
    cm.created_at,
    cm.content_type,
    cm.attachment_url,
    DATE_PART('day', NOW() - cm.created_at) AS days_old
FROM chat_messages cm
WHERE cm.created_at < NOW() - INTERVAL '90 days'
ORDER BY cm.created_at ASC
LIMIT 100;

-- 1.2 查询超过90天的聊天消息中的图片文件路径
-- 返回格式：chat-images/007ad5d2-0bf8-495c-b4c7-146d5823b0ee/b0b0d822-6a47-4638-b444-xxx.jpg
SELECT
    cm.id,
    cm.thread_id,
    cm.attachment_url,
    cm.created_at,
    DATE_PART('day', NOW() - cm.created_at) AS days_old
FROM chat_messages cm
WHERE cm.created_at < NOW() - INTERVAL '90 days'
  AND cm.content_type = 'image'
  AND cm.attachment_url IS NOT NULL
ORDER BY cm.created_at ASC;

-- 1.3 统计超过90天的消息数量
SELECT
    COUNT(*) AS total_old_messages,
    COUNT(*) FILTER (WHERE content_type = 'image') AS total_old_images
FROM chat_messages
WHERE created_at < NOW() - INTERVAL '90 days';

-- 1.4 查询无效线程（顾客与技师无任何已完成订单，且线程超过3天）
-- c2g 线程类型
SELECT
    ct.id AS thread_id,
    ct.thread_type,
    ct.customer_id,
    ct.girl_id,
    ct.created_at,
    ct.last_message_at,
    DATE_PART('day', NOW() - ct.created_at) AS days_since_created,
    COUNT(DISTINCT o.id) AS completed_orders_count
FROM chat_threads ct
LEFT JOIN orders o
    ON ct.customer_id = o.user_id
    AND ct.girl_id = o.girl_id
    AND o.status = 'completed'
WHERE ct.thread_type = 'c2g'
  AND ct.created_at < NOW() - INTERVAL '3 days'
GROUP BY ct.id, ct.thread_type, ct.customer_id, ct.girl_id, ct.created_at, ct.last_message_at
HAVING COUNT(DISTINCT o.id) = 0
ORDER BY ct.created_at ASC
LIMIT 100;

-- 1.5 统计无效线程数量
SELECT
    COUNT(DISTINCT ct.id) AS invalid_threads_count
FROM chat_threads ct
LEFT JOIN orders o
    ON ct.customer_id = o.user_id
    AND ct.girl_id = o.girl_id
    AND o.status = 'completed'
WHERE ct.thread_type = 'c2g'
  AND ct.created_at < NOW() - INTERVAL '3 days'
GROUP BY ct.id
HAVING COUNT(DISTINCT o.id) = 0;

-- ========================================
-- 二、单条线程测试删除（用于测试）
-- ========================================

-- 2.1 查询指定线程的消息（包含图片）
-- 替换 'THREAD_ID_HERE' 为实际的线程 ID
SELECT
    cm.id,
    cm.content_type,
    cm.attachment_url,
    cm.text_content,
    cm.created_at
FROM chat_messages cm
WHERE cm.thread_id = 'THREAD_ID_HERE'
ORDER BY cm.created_at DESC;

-- 2.2 查询指定线程的图片文件路径（需要从存储桶删除）
-- 替换 'THREAD_ID_HERE' 为实际的线程 ID
SELECT
    cm.attachment_url
FROM chat_messages cm
WHERE cm.thread_id = 'THREAD_ID_HERE'
  AND cm.content_type = 'image'
  AND cm.attachment_url IS NOT NULL;

-- 2.3 删除指定线程（会级联删除消息和已读记录）
-- 替换 'THREAD_ID_HERE' 为实际的线程 ID
-- 注意：执行前先用上面的查询保存图片路径列表
DELETE FROM chat_threads
WHERE id = 'THREAD_ID_HERE';

-- ========================================
-- 三、批量清理超过90天的聊天记录
-- ========================================

-- 3.1 创建临时表存储需要删除的图片路径
CREATE TEMP TABLE IF NOT EXISTS temp_images_to_delete (
    attachment_url TEXT
);

-- 3.2 插入需要删除的图片路径到临时表
INSERT INTO temp_images_to_delete (attachment_url)
SELECT DISTINCT cm.attachment_url
FROM chat_messages cm
WHERE cm.created_at < NOW() - INTERVAL '90 days'
  AND cm.content_type = 'image'
  AND cm.attachment_url IS NOT NULL;

-- 3.3 查看临时表中的图片路径（用于手动删除或脚本删除）
SELECT * FROM temp_images_to_delete;

-- 3.4 批量删除超过90天的聊天消息
-- 注意：执行前确保已导出图片路径列表
DELETE FROM chat_messages
WHERE created_at < NOW() - INTERVAL '90 days';

-- 3.5 清理临时表
DROP TABLE IF EXISTS temp_images_to_delete;

-- ========================================
-- 四、批量清理无效线程（无已完成订单且超过3天）
-- ========================================

-- 4.1 创建临时表存储需要删除的无效线程ID
CREATE TEMP TABLE IF NOT EXISTS temp_invalid_threads (
    thread_id UUID
);

-- 4.2 插入无效线程ID到临时表
INSERT INTO temp_invalid_threads (thread_id)
SELECT DISTINCT ct.id
FROM chat_threads ct
LEFT JOIN orders o
    ON ct.customer_id = o.user_id
    AND ct.girl_id = o.girl_id
    AND o.status = 'completed'
WHERE ct.thread_type = 'c2g'
  AND ct.created_at < NOW() - INTERVAL '3 days'
GROUP BY ct.id
HAVING COUNT(DISTINCT o.id) = 0;

-- 4.3 查看需要删除的无效线程
SELECT
    tit.thread_id,
    ct.customer_id,
    ct.girl_id,
    ct.created_at,
    ct.last_message_at
FROM temp_invalid_threads tit
JOIN chat_threads ct ON ct.id = tit.thread_id;

-- 4.4 收集无效线程中的图片路径（需要从存储桶删除）
CREATE TEMP TABLE IF NOT EXISTS temp_invalid_thread_images (
    attachment_url TEXT
);

INSERT INTO temp_invalid_thread_images (attachment_url)
SELECT DISTINCT cm.attachment_url
FROM chat_messages cm
JOIN temp_invalid_threads tit ON cm.thread_id = tit.thread_id
WHERE cm.content_type = 'image'
  AND cm.attachment_url IS NOT NULL;

-- 4.5 查看无效线程的图片路径
SELECT * FROM temp_invalid_thread_images;

-- 4.6 批量删除无效线程（会级联删除消息和已读记录）
-- 注意：执行前确保已导出图片路径列表
DELETE FROM chat_threads
WHERE id IN (SELECT thread_id FROM temp_invalid_threads);

-- 4.7 清理临时表
DROP TABLE IF EXISTS temp_invalid_threads;
DROP TABLE IF EXISTS temp_invalid_thread_images;

-- ========================================
-- 五、创建存储过程用于自动清理（定时任务）
-- ========================================

-- 5.1 创建函数：清理超过90天的聊天记录
-- 返回：删除的消息数量
CREATE OR REPLACE FUNCTION cleanup_old_chat_messages()
RETURNS TABLE(
    deleted_messages INTEGER,
    deleted_images_count INTEGER,
    image_paths TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_image_count INTEGER := 0;
    v_image_paths TEXT[];
BEGIN
    -- 收集需要删除的图片路径
    SELECT
        COUNT(*),
        ARRAY_AGG(DISTINCT attachment_url)
    INTO v_image_count, v_image_paths
    FROM chat_messages
    WHERE created_at < NOW() - INTERVAL '90 days'
      AND content_type = 'image'
      AND attachment_url IS NOT NULL;

    -- 删除超过90天的消息
    DELETE FROM chat_messages
    WHERE created_at < NOW() - INTERVAL '90 days';

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- 返回删除统计和图片路径
    RETURN QUERY SELECT
        v_deleted_count,
        v_image_count,
        v_image_paths;
END;
$$;

-- 函数注释
COMMENT ON FUNCTION cleanup_old_chat_messages() IS '自动清理超过90天的聊天记录，返回删除统计和需要从存储桶删除的图片路径';

-- 5.2 创建函数：清理无效线程
-- 返回：删除的线程数量和图片路径
CREATE OR REPLACE FUNCTION cleanup_invalid_chat_threads()
RETURNS TABLE(
    deleted_threads INTEGER,
    deleted_messages INTEGER,
    deleted_images_count INTEGER,
    image_paths TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_thread_ids UUID[];
    v_deleted_threads INTEGER := 0;
    v_deleted_messages INTEGER := 0;
    v_image_count INTEGER := 0;
    v_image_paths TEXT[];
BEGIN
    -- 收集无效线程ID
    SELECT ARRAY_AGG(DISTINCT ct.id)
    INTO v_thread_ids
    FROM chat_threads ct
    LEFT JOIN orders o
        ON ct.customer_id = o.user_id
        AND ct.girl_id = o.girl_id
        AND o.status = 'completed'
    WHERE ct.thread_type = 'c2g'
      AND ct.created_at < NOW() - INTERVAL '3 days'
    GROUP BY ct.id
    HAVING COUNT(DISTINCT o.id) = 0;

    -- 如果没有无效线程，直接返回
    IF v_thread_ids IS NULL OR ARRAY_LENGTH(v_thread_ids, 1) = 0 THEN
        RETURN QUERY SELECT 0, 0, 0, ARRAY[]::TEXT[];
        RETURN;
    END IF;

    -- 收集这些线程中的图片路径
    SELECT
        COUNT(*),
        ARRAY_AGG(DISTINCT attachment_url)
    INTO v_image_count, v_image_paths
    FROM chat_messages
    WHERE thread_id = ANY(v_thread_ids)
      AND content_type = 'image'
      AND attachment_url IS NOT NULL;

    -- 统计这些线程的消息数量
    SELECT COUNT(*)
    INTO v_deleted_messages
    FROM chat_messages
    WHERE thread_id = ANY(v_thread_ids);

    -- 删除无效线程（会级联删除消息和已读记录）
    DELETE FROM chat_threads
    WHERE id = ANY(v_thread_ids);

    GET DIAGNOSTICS v_deleted_threads = ROW_COUNT;

    -- 返回删除统计
    RETURN QUERY SELECT
        v_deleted_threads,
        v_deleted_messages,
        v_image_count,
        v_image_paths;
END;
$$;

-- 函数注释
COMMENT ON FUNCTION cleanup_invalid_chat_threads() IS '自动清理无效聊天线程（无已完成订单且超过3天），返回删除统计和需要从存储桶删除的图片路径';

-- ========================================
-- 六、手动执行清理（示例）
-- ========================================

-- 6.1 执行清理超过90天的聊天记录
-- 返回值包含：删除的消息数、图片数、图片路径列表
SELECT * FROM cleanup_old_chat_messages();

-- 6.2 执行清理无效线程
-- 返回值包含：删除的线程数、消息数、图片数、图片路径列表
SELECT * FROM cleanup_invalid_chat_threads();

-- ========================================
-- 七、图片文件删除说明
-- ========================================

/*
注意事项：
1. SQL 只能删除数据库记录，无法直接删除 Supabase Storage 中的图片文件
2. 需要配合后端脚本或手动删除存储桶中的图片文件

删除图片文件的步骤：

方法一：使用 Supabase Admin Client（推荐）
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 使用 Service Role Key
)

// 从函数返回的图片路径列表中删除
const imagePaths = ['chat-images/007ad5d2-0bf8-495c-b4c7-146d5823b0ee/xxx.jpg', ...]

for (const path of imagePaths) {
  const { error } = await supabase.storage
    .from('chat-images')
    .remove([path.replace('chat-images/', '')]) // 移除桶名前缀

  if (error) {
    console.error('删除失败:', path, error)
  }
}
```

方法二：使用 pg_cron 定时任务配合 Edge Function
1. 在 Edge Function 中调用清理函数获取图片路径
2. 使用 Supabase Storage API 删除文件
3. 使用 pg_cron 定期执行

方法三：手动删除（小规模）
1. 执行查询获取图片路径列表
2. 在 Supabase Dashboard > Storage > chat-images 中手动删除

推荐流程：
1. 先执行清理函数（cleanup_old_chat_messages 或 cleanup_invalid_chat_threads）
2. 函数返回需要删除的图片路径列表
3. 使用返回的路径列表，通过后端脚本调用 Storage API 删除文件
4. 验证删除结果

注意：
- 图片路径格式：chat-images/线程ID/消息ID.扩展名
- 删除前建议先备份重要数据
- 建议在低峰期执行批量删除
- 可以分批删除，避免一次性删除过多数据
*/

-- ========================================
-- 八、定时任务设置（使用 pg_cron）
-- ========================================

/*
如果 Supabase 实例启用了 pg_cron 扩展，可以设置自动定时清理

-- 8.1 启用 pg_cron 扩展（需要 Supabase 管理员权限）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 8.2 创建定时任务：每周日凌晨2点清理超过90天的聊天记录
SELECT cron.schedule(
    'cleanup-old-chat-messages',    -- 任务名称
    '0 2 * * 0',                     -- 每周日凌晨2点（Cron表达式）
    'SELECT cleanup_old_chat_messages();'
);

-- 8.3 创建定时任务：每天凌晨3点清理无效线程
SELECT cron.schedule(
    'cleanup-invalid-threads',       -- 任务名称
    '0 3 * * *',                     -- 每天凌晨3点
    'SELECT cleanup_invalid_chat_threads();'
);

-- 8.4 查看已设置的定时任务
SELECT * FROM cron.job;

-- 8.5 删除定时任务
SELECT cron.unschedule('cleanup-old-chat-messages');
SELECT cron.unschedule('cleanup-invalid-threads');

注意：
1. Supabase 默认可能未启用 pg_cron，需联系 Supabase 支持
2. 定时任务只清理数据库记录，不删除存储桶文件
3. 需要配合 Edge Function 或后端脚本定期删除存储桶文件
*/

-- ========================================
-- 九、数据验证和回滚建议
-- ========================================

-- 9.1 删除前备份（推荐）
-- 创建备份表
CREATE TABLE chat_messages_backup AS
SELECT * FROM chat_messages
WHERE created_at < NOW() - INTERVAL '90 days';

-- 9.2 验证备份
SELECT COUNT(*) FROM chat_messages_backup;

-- 9.3 如需恢复
INSERT INTO chat_messages
SELECT * FROM chat_messages_backup;

-- 9.4 清理备份表
DROP TABLE chat_messages_backup;

-- ========================================
-- 十、级联删除说明
-- ========================================

/*
根据 DB.md 中的外键约束：

chat_messages 表：
- FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
  含义：删除线程时，会自动级联删除该线程下的所有消息

chat_receipts 表：
- FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
  含义：删除线程时，会自动级联删除该线程的已读记录

因此：
- 删除 chat_threads 时，会自动删除：
  1. 该线程的所有 chat_messages
  2. 该线程的所有 chat_receipts

- 删除 chat_messages 时：
  只删除消息本身，不影响线程

建议：
- 如果要清理整个线程，直接删除 chat_threads 即可
- 如果只清理旧消息，直接删除 chat_messages
- 删除前确保已收集图片路径列表，用于后续删除存储桶文件
*/
