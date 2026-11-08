import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const nodeRequire = createRequire(import.meta.url)
const adminId = '10000000-0000-4000-8000-000000000001'
const mediaId = '20000000-0000-4000-8000-000000000001'
const otherId = '20000000-0000-4000-8000-000000000002'

// 内存编译并替换外部服务，不接触真实数据库或 Storage。
function load(file, overrides = {}, cache = new Map()) {
    const resolved = path.resolve(root, file)
    if (cache.has(resolved)) return cache.get(resolved).exports
    const mod = { exports: {} }
    cache.set(resolved, mod)
    const compiled = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText
    const localRequire = (name) => {
        if (Object.hasOwn(overrides, name)) return overrides[name]
        if (name.startsWith('.') || name.startsWith('@/')) {
            let target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(resolved), name)
            target = fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, 'index.ts')
            return load(target, overrides, cache)
        }
        return nodeRequire(name)
    }
    new Function('require', 'module', 'exports', 'console', compiled)(localRequire, mod, mod.exports, { log() {}, error() {} })
    return mod.exports
}

function fixture(overrides = {}) {
    return { id: mediaId, girl_id: otherId, kind: 'image', provider: 'supabase', status: 'pending',
        storage_key: 'source/photo.jpg', thumb_key: null, min_user_level: 0,
        visible_on_ios: false, visible_on_android: false,
        meta: { mime: 'image/jpeg', custom: '保留元数据', live: { image_key: 'source/pair.jpg', video_key: 'source/pair.mov' } },
        ...overrides }
}

function harness(records, options = {}) {
    const rows = structuredClone(records)
    const writes = []
    const audits = []
    const revalidated = []
    const roles = []
    const files = []
    const client = {
        from(table) {
            let patch, inserted, single = false
            const filters = []
            const query = {
                select() { return query },
                eq(key, value) { filters.push(row => row[key] === value); return query },
                in(key, values) { filters.push(row => values.includes(row[key])); return query },
                update(value) { patch = value; return query },
                insert(value) { inserted = value; return query },
                single() { single = true; return query },
                maybeSingle() { single = true; return query },
                then(resolve, reject) {
                    try {
                        if (inserted) { audits.push(inserted); return Promise.resolve({ error: null }).then(resolve, reject) }
                        const matched = rows.filter(row => filters.every(filter => filter(row)))
                        if (patch) {
                            if (matched.some(row => row.id === options.failId)) return Promise.resolve({ error: { message: '模拟写入失败' } }).then(resolve, reject)
                            if (matched.length > 0) writes.push({ table, patch, ids: matched.map(row => row.id) })
                            matched.forEach(row => Object.assign(row, patch))
                        }
                        return Promise.resolve({ data: single ? matched[0] ?? null : matched, error: null, count: matched.length }).then(resolve, reject)
                    } catch (error) { return Promise.reject(error).then(resolve, reject) }
                },
            }
            return query
        },
        storage: { from(bucket) { return {
            async download(key) { files.push({ bucket, operation: 'download', key }); return { data: { type: 'image/jpeg' }, error: null } },
            async upload(key) { files.push({ bucket, operation: 'upload', key }); return { error: null } },
            async remove() { return { error: null } },
        } } },
    }
    const actions = load('app/dashboard/media/actions.ts', {
        '@/lib/supabase': { getSupabaseAdminClient: () => client },
        '@/lib/auth': { requireAdmin: async required => {
            roles.push(required)
            if (options.unauthorized) throw new Error('无权限')
            return { id: adminId }
        } },
        'next/cache': { revalidatePath: value => revalidated.push(value) },
    })
    return { actions, rows, writes, audits, revalidated, roles, files }
}

const { approveMediaSchema, batchApproveMediaSchema, updateMediaSettingsSchema } = load('lib/features/media/validations.ts')
const { buildMediaPlatformVisibility, getMediaPlatformScope } = load('lib/features/media/platforms.ts')

test('三种组合可往返映射，旧参数省略不生成默认覆盖值，非法组合和单字段被拒绝', () => {
    for (const schema of [approveMediaSchema, batchApproveMediaSchema, updateMediaSettingsSchema]) {
        const base = schema === batchApproveMediaSchema ? { ids: [mediaId], min_user_level: 0 } : { id: mediaId, min_user_level: 0 }
        assert.equal(schema.parse(base).visible_on_ios, undefined)
        for (const scope of ['all', 'android_web', 'web']) {
            const visibility = buildMediaPlatformVisibility(scope)
            assert.equal(getMediaPlatformScope(visibility), scope)
            assert.equal(schema.safeParse({ ...base, ...visibility }).success, true)
        }
        for (const invalid of [
            { visible_on_ios: true, visible_on_android: false },
            { visible_on_ios: false }, { visible_on_android: true },
            { visible_on_ios: 'false', visible_on_android: true },
        ]) assert.equal(schema.safeParse({ ...base, ...invalid }).success, false)
    }
    assert.equal(getMediaPlatformScope({}), 'all')
})

for (const kind of ['image', 'video', 'live_photo', 'cloudflare']) {
    for (const batch of [false, true]) {
        test(`${batch ? '批量' : '单条'}审核 ${kind} 同次写入平台设置并保留原元数据`, async () => {
            const record = fixture(kind === 'cloudflare' ? { kind: 'video', provider: 'cloudflare' } : { kind })
            const h = harness([record])
            const result = await h.actions[batch ? 'batchApproveMedia' : 'approveMedia']({
                ...(batch ? { ids: [mediaId] } : { id: mediaId }), min_user_level: 3,
                visible_on_ios: false, visible_on_android: true,
            })
            assert.equal(result.success, true)
            assert.equal(h.rows[0].status, 'approved')
            assert.equal(h.rows[0].visible_on_android, true)
            assert.equal(h.rows[0].visible_on_ios, false)
            assert.equal(h.rows[0].min_user_level, 3)
            assert.equal(h.rows[0].meta.custom, record.meta.custom)
            assert.equal(h.audits.length, 1)
            assert.equal(h.audits[0].target_admin_id, adminId)
            assert.deepEqual(h.audits[0].operation_details.media_ids, [mediaId])
            assert.deepEqual(h.roles[0], ['superadmin', 'admin'])
            assert.deepEqual(h.revalidated, ['/dashboard/media'])
            if (kind === 'cloudflare') assert.equal(h.files.length, 0)
            else assert.ok(h.files.some(file => file.operation === 'upload' && file.bucket === 'girls-media'))
        })
    }
}

test('旧单条和批量审核调用不回写平台字段，保留仅 Web 设置', async () => {
    for (const action of ['approveMedia', 'batchApproveMedia']) {
        const h = harness([fixture()])
        const result = await h.actions[action]({ id: mediaId, ids: [mediaId], min_user_level: 0 })
        assert.equal(result.success, true)
        assert.equal(h.rows[0].visible_on_android, false)
        assert.equal(h.rows[0].visible_on_ios, false)
        assert.equal(Object.hasOwn(h.writes[0].patch, 'visible_on_ios'), false)
        assert.equal(h.audits.length, 0)
    }
})

test('编辑保存三种组合；只改会员等级保留平台设置', async () => {
    const h = harness([fixture({ status: 'approved' })])
    for (const scope of ['all', 'android_web', 'web']) {
        assert.equal((await h.actions.updateMediaLevel({ id: mediaId, min_user_level: 2, ...buildMediaPlatformVisibility(scope) })).success, true)
        assert.equal(getMediaPlatformScope(h.rows[0]), scope)
    }
    assert.equal((await h.actions.updateMediaLevel({ id: mediaId, min_user_level: 4 })).success, true)
    assert.equal(getMediaPlatformScope(h.rows[0]), 'web')
    assert.equal(h.audits.length, 3)
    assert.equal(Object.hasOwn(h.writes.at(-1).patch, 'visible_on_ios'), false)
})

test('批量改等级、驳回、恢复待审核和排序不重置平台设置', async () => {
    const h = harness([fixture({ status: 'approved' })])
    await h.actions.batchUpdateMediaLevel({ ids: [mediaId], min_user_level: 4 })
    await h.actions.rejectMedia({ id: mediaId, reason: '测试驳回' })
    await h.actions.restoreToPending(mediaId)
    await h.actions.reorderMedia({ girl_id: otherId, items: [{ id: mediaId, sort_order: 1 }] })
    assert.ok(h.writes.length >= 4)
    assert.ok(h.writes.every(write => !Object.hasOwn(write.patch, 'visible_on_ios') && !Object.hasOwn(write.patch, 'visible_on_android')))
    assert.equal(getMediaPlatformScope(h.rows[0]), 'web')
})

test('部分审核失败只合并记录成功媒体；全部失败返回失败', async () => {
    const h = harness([fixture({ provider: 'cloudflare', kind: 'video' }), fixture({ id: otherId, provider: 'cloudflare', kind: 'video' })], { failId: otherId })
    const result = await h.actions.batchApproveMedia({ ids: [mediaId, otherId], min_user_level: 0, ...buildMediaPlatformVisibility('all') })
    assert.equal(result.success, true)
    assert.ok(result.error)
    assert.equal(h.audits.length, 1)
    assert.deepEqual(h.audits[0].operation_details.media_ids, [mediaId])
    const failed = harness([fixture({ provider: 'cloudflare', kind: 'video' })], { failId: mediaId })
    assert.equal((await failed.actions.batchApproveMedia({ ids: [mediaId], min_user_level: 0, ...buildMediaPlatformVisibility('all') })).success, false)
    assert.equal(failed.audits.length, 0)
})

test('无权限、无效参数、未发布、记录不存在或写入失败均不报告编辑成功', async () => {
    for (const scenario of ['unauthorized', 'invalid', 'pending', 'missing', 'write_error']) {
        const h = harness(scenario === 'missing' ? [] : [fixture({ status: scenario === 'pending' ? 'pending' : 'approved' })], {
            unauthorized: scenario === 'unauthorized', failId: scenario === 'write_error' ? mediaId : undefined,
        })
        const visibility = scenario === 'invalid' ? { visible_on_ios: true, visible_on_android: false } : buildMediaPlatformVisibility('all')
        assert.equal((await h.actions.updateMediaLevel({ id: mediaId, min_user_level: 2, ...visibility })).success, false)
        assert.equal(h.audits.length, 0)
        assert.equal(h.writes.length, 0)
    }
})

test('SQL 静态检查：视图只末尾加列，回滚恢复原列顺序；不改 RLS 或增加索引', () => {
    const original = fs.readFileSync(path.join(root, 'docs/sql/media_management_optimization.sql'), 'utf8')
    const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261108_media_platform_visibility.sql'), 'utf8')
    const rollback = fs.readFileSync(path.join(root, 'docs/sql/rollback_media_platform_visibility.sql'), 'utf8')
    const columns = sql => sql.match(/CREATE (?:OR REPLACE )?VIEW (?:public\.)?v_admin_media_list AS\s*SELECT\s*([\s\S]*?)FROM (?:public\.)?girls_media m/i)[1]
        .replace(/--[^\n]*/g, '').split(',').map(column => column.trim())
    assert.deepEqual(columns(migration), [...columns(original), 'm.visible_on_ios', 'm.visible_on_android'])
    assert.deepEqual(columns(rollback), columns(original))
    for (const column of ['visible_on_ios', 'visible_on_android']) {
        assert.match(migration, new RegExp(`ADD COLUMN ${column} BOOLEAN NOT NULL DEFAULT true`))
        assert.match(rollback, new RegExp(`DROP COLUMN ${column}`))
    }
    assert.ok(rollback.indexOf('DROP VIEW public.v_admin_media_list') < rollback.indexOf('DROP COLUMN visible_on_ios'))
    assert.match(rollback, /aclexplode\(c.relacl\)/)
    for (const sql of [migration, rollback]) {
        assert.match(sql, /\nBEGIN;/)
        assert.match(sql, /COMMIT;/)
        assert.doesNotMatch(sql, /CREATE (?:UNIQUE )?INDEX|(?:CREATE|ALTER|DROP) POLICY|ALTER TABLE[^;]*ROW LEVEL SECURITY|UPDATE public\.girls_media/i)
    }
})
