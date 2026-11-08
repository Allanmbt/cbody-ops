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
const image = slot => `${slot}/550e8400-e29b-41d4-a716-446655440000.jpg`
const replacement = '1/550e8400-e29b-41d4-a716-446655440001.png'
const stamp = '2026-11-08T01:00:00+00:00'
const slide = slot => ({ slot, image_path: image(slot), link_type: 'none', link_target: null, created_at: stamp, updated_at: stamp })

// 只在内存编译 TS，数据库和 Storage 均为隔离模拟，不连接线上。
function load(file, overrides = {}, cache = new Map()) {
    const resolved = path.resolve(root, file)
    if (cache.has(resolved)) return cache.get(resolved).exports
    const mod = { exports: {} }
    cache.set(resolved, mod)
    const compiled = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText
    const localRequire = name => {
        if (Object.hasOwn(overrides, name)) return overrides[name]
        if (name.startsWith('.') || name.startsWith('@/')) {
            let target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(resolved), name)
            target = fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, 'index.ts')
            return load(target, overrides, cache)
        }
        return nodeRequire(name)
    }
    new Function('require', 'module', 'exports', 'console', compiled)(localRequire, mod, mod.exports, { error() {} })
    return mod.exports
}

function harness(initial = [], options = {}) {
    const rows = structuredClone(initial)
    const audits = [], removed = [], signatures = [], reads = [], roles = [], mutations = [], revalidated = []
    const client = {
        from(table) {
            let method = 'select', values, single = false, limit, order
            const filters = []
            const query = {
                select() { return query },
                eq(key, value) { filters.push(row => row[key] === value); return query },
                order(key) { order = key; return query },
                limit(value) { limit = value; return query },
                insert(value) { method = 'insert'; values = value; return query },
                update(value) { method = 'update'; values = value; return query },
                delete() { method = 'delete'; return query },
                maybeSingle() { single = true; return query },
                async then(resolve, reject) {
                    try {
                        if (table === 'admin_operation_logs') {
                            if (options.auditThrows) throw new Error('模拟审计网络失败')
                            audits.push(values)
                            return resolve({ error: null })
                        }
                        if (method !== 'select' && options.race && rows.length) rows[0].updated_at = '2026-11-08T02:00:00+00:00'
                        let matched = rows.filter(row => filters.every(filter => filter(row)))
                        if (method === 'select') {
                            reads.push({ limit, order })
                            if (options.readError) return resolve({ data: null, error: { message: '读取失败' } })
                            if (order) matched.sort((a, b) => a[order] - b[order])
                            if (limit) matched = matched.slice(0, limit)
                        } else {
                            if (options.writeError) return resolve({ data: null, error: { code: options.writeError } })
                            if (method === 'insert') {
                                if (rows.some(row => row.slot === values.slot) || options.insertRace) return resolve({ data: null, error: { code: '23505' } })
                                matched = [{ ...values, created_at: stamp, updated_at: stamp }]
                                rows.push(...matched)
                            } else if (method === 'update') {
                                matched.forEach(row => Object.assign(row, values, { updated_at: '2026-11-08T03:00:00+00:00' }))
                            } else matched.forEach(row => rows.splice(rows.indexOf(row), 1))
                            if (matched.length) mutations.push(method)
                        }
                        return resolve({ data: structuredClone(single ? matched[0] ?? null : matched), error: null })
                    } catch (error) { return reject(error) }
                },
            }
            return query
        },
        storage: { from(bucket) {
            assert.equal(bucket, 'home-slides')
            return {
                async createSignedUploadUrl(objectPath, config) {
                    signatures.push({ path: objectPath, config })
                    return options.signError ? { data: null, error: {} } : { data: { token: 'temporary-token' }, error: null }
                },
                async info(objectPath) {
                    if (options.missingFile) return { data: null, error: {} }
                    return { data: { contentType: objectPath.endsWith('.png') ? 'image/png' : 'image/jpeg', size: 1000, ...options.fileInfo }, error: null }
                },
                async remove(paths) {
                    if (options.removeThrows) throw new Error('模拟清理网络失败')
                    if (options.removeError) return { error: {} }
                    removed.push(...paths)
                    return { error: null }
                },
            }
        } },
    }
    const actions = load('app/dashboard/configs/slides/actions.ts', {
        '@/lib/supabase': { getSupabaseAdminClient: () => client },
        '@/lib/auth': { requireAdmin: async required => {
            roles.push(required)
            if (options.unauthorized) throw new Error('无权限')
            return { id: adminId }
        } },
        'next/cache': { revalidatePath: value => revalidated.push(value) },
    })
    return { actions, rows, audits, removed, signatures, reads, roles, mutations, revalidated }
}

const validation = load('lib/features/slides/validations.ts')
const saveInput = (slot = 1, extra = {}) => ({ slot, image_path: image(slot), link_type: 'none', link_target: '', expected_updated_at: null, ...extra })

test('空数组、一张、三张均按位置升序一次查询，最多读取 3 条', async () => {
    for (const slots of [[], [1], [3, 1, 2]]) {
        const h = harness(slots.map(slide))
        const result = await h.actions.getHomeSlides()
        assert.equal(result.ok, true)
        assert.deepEqual(result.data.map(row => row.slot), [...slots].sort())
        assert.deepEqual(h.reads, [{ limit: 3, order: 'slot' }])
    }
})

test('第四个位置、非整数和不匹配位置路径不能保存或申请上传', async () => {
    for (const slot of [0, 4, 1.5]) {
        assert.equal(validation.saveSlideSchema.safeParse(saveInput(slot)).success, false)
        assert.equal(validation.slideUploadSchema.safeParse({ slot, mime: 'image/jpeg', size: 1000 }).success, false)
    }
    assert.equal(validation.saveSlideSchema.safeParse(saveInput(1, { image_path: image(2) })).success, false)
})

test('不跳转、内部路径、外部 HTTPS 及无效地址校验', () => {
    for (const [type, target] of [['none', ''], ['internal', '/'], ['internal', '/page?id=1'], ['external', 'https://example.com/page?q=中文']]) {
        assert.equal(validation.isValidSlideTarget(type, target), true, `${type}: ${target}`)
    }
    for (const [type, target] of [
        ['none', '/page'], ['internal', '//example.com'], ['internal', '/%2fexample.com'],
        ['internal', '/\\example.com'], ['internal', '/%5cexample.com'], ['internal', '/%00test'],
        ['internal', '/%0atest'], ['internal', '/test\n'], ['internal', '/%'],
        ['external', 'http://example.com'], ['external', 'javascript:alert(1)'],
        ['external', 'https://user:pass@example.com'], ['external', 'https://'],
    ]) assert.equal(validation.isValidSlideTarget(type, target), false, `${type}: ${target}`)
})

test('签名上传限定位置、规范 UUID 和 MIME 扩展名且禁止覆盖', async () => {
    const h = harness()
    for (const [mime, ext] of Object.entries(validation.SLIDE_MIME_EXTENSIONS)) {
        const result = await h.actions.createSlideUpload({ slot: 2, mime, size: 1024 })
        assert.equal(result.ok, true)
        assert.match(result.data.path, new RegExp(`^2/[0-9a-f-]{36}\\.${ext}$`))
        assert.equal(result.data.token, 'temporary-token')
    }
    assert.ok(h.signatures.every(item => item.config.upsert === false))
    for (const values of [{ mime: 'image/svg+xml', size: 100 }, { mime: 'image/jpeg', size: 5242881 }, { mime: 'image/png', size: 0 }]) {
        assert.equal((await h.actions.createSlideUpload({ slot: 1, ...values })).ok, false)
    }
    assert.equal(h.signatures.length, 3)
})

test('保存三种跳转，不跳转以 NULL 入库，审计和缓存刷新正确', async () => {
    for (const [type, target] of [['none', ''], ['internal', '/page'], ['external', 'https://example.com']]) {
        const h = harness()
        const result = await h.actions.saveHomeSlide(saveInput(1, { link_type: type, link_target: target }))
        assert.equal(result.ok, true)
        assert.equal(h.rows[0].link_target, type === 'none' ? null : target)
        assert.equal(h.audits.length, 1)
        assert.equal(h.audits[0].operator_id, adminId)
        assert.equal(h.audits[0].target_admin_id, adminId)
        assert.deepEqual(h.revalidated, ['/dashboard/configs/slides', '/dashboard/configs'])
        assert.deepEqual(h.roles[0], ['superadmin', 'admin'])
    }
})

test('缺少对象、超限、未知 MIME 和 MIME/扩展名不匹配均拒绝发布', async () => {
    for (const options of [
        { missingFile: true }, { fileInfo: { size: 5242881 } }, { fileInfo: { size: 0 } },
        { fileInfo: { size: undefined } }, { fileInfo: { contentType: 'image/svg+xml' } },
        { fileInfo: { contentType: 'image/png' } },
    ]) {
        const h = harness([], options)
        assert.equal((await h.actions.saveHomeSlide(saveInput())).ok, false)
        assert.equal(h.mutations.length, 0)
    }
})

test('替换成功后才清理旧图，只修改跳转时保留原图', async () => {
    const h = harness([slide(1)])
    assert.equal((await h.actions.saveHomeSlide(saveInput(1, { expected_updated_at: stamp, image_path: replacement }))).ok, true)
    assert.equal(h.rows[0].image_path, replacement)
    assert.deepEqual(h.removed, [image(1)])
    const current = h.rows[0]
    assert.equal((await h.actions.saveHomeSlide(saveInput(1, { expected_updated_at: current.updated_at, image_path: replacement, link_type: 'internal', link_target: '/page' }))).ok, true)
    assert.equal(h.removed.length, 1)
})

test('保存失败保留旧图，清理未发布的新图且不误删正在引用的文件', async () => {
    const h = harness([slide(1)], { writeError: 'XX000' })
    const result = await h.actions.saveHomeSlide(saveInput(1, { expected_updated_at: stamp, image_path: replacement }))
    assert.equal(result.ok, false)
    assert.match(result.error, /保存幻灯片失败/)
    assert.equal(h.rows[0].image_path, image(1))
    assert.equal(h.removed.length, 0)
    await h.actions.discardSlideUpload(replacement)
    await h.actions.discardSlideUpload(image(1))
    assert.deepEqual(h.removed, [replacement])
})

test('陈旧版本、读写之间并发修改及空位置同时新增均提示冲突', async () => {
    for (const [initial, options, expected] of [
        [[slide(1)], {}, null], [[slide(1)], { race: true }, stamp], [[], { insertRace: true }, null],
    ]) {
        const h = harness(initial, options)
        const result = await h.actions.saveHomeSlide(saveInput(1, { expected_updated_at: expected }))
        assert.equal(result.ok, false)
        assert.match(result.error, /其他管理员修改/)
        assert.equal(h.audits.length, 0)
        assert.equal(h.removed.length, 0)
    }
})

test('删除先移除配置，清理失败仍返回成功和明确提示', async () => {
    for (const options of [{}, { removeError: true }, { removeThrows: true }]) {
        const h = harness([slide(1)], options)
        const result = await h.actions.deleteHomeSlide({ slot: 1, expected_updated_at: stamp })
        assert.equal(result.ok, true)
        assert.equal(h.rows.length, 0)
        assert.equal(h.audits.length, 1)
        assert.equal(Boolean(result.warning), Boolean(options.removeError || options.removeThrows))
    }
})

test('删除冲突和写入失败不删除图片；审计失败不会把已保存操作误报为失败', async () => {
    for (const options of [{ race: true }, { writeError: 'XX000' }]) {
        const h = harness([slide(1)], options)
        assert.equal((await h.actions.deleteHomeSlide({ slot: 1, expected_updated_at: stamp })).ok, false)
        assert.equal(h.removed.length, 0)
        assert.equal(h.rows.length, 1)
    }
    const h = harness([], { auditThrows: true })
    const result = await h.actions.saveHomeSlide(saveInput())
    assert.equal(result.ok, true)
    assert.match(result.warning, /审计日志/)
})

test('无权限时所有管理入口、签名和文件清理均被拒绝', async () => {
    const h = harness([slide(1)], { unauthorized: true })
    const calls = [h.actions.getHomeSlides(), h.actions.createSlideUpload({ slot: 1, mime: 'image/jpeg', size: 100 }),
        h.actions.saveHomeSlide(saveInput()), h.actions.deleteHomeSlide({ slot: 1, expected_updated_at: stamp }),
        h.actions.discardSlideUpload(image(1))]
    for (const result of await Promise.all(calls)) assert.equal(result.ok, false)
    assert.equal(h.signatures.length + h.removed.length + h.audits.length + h.mutations.length, 0)
})

test('规范外路径及引用检查失败不清理文件，避免删除其他桶或业务图片', async () => {
    for (const objectPath of ['../avatars/one.jpg', '1/file.svg', 'upload/1/a.jpg']) {
        const h = harness()
        assert.ok((await h.actions.discardSlideUpload(objectPath)).warning)
        assert.equal(h.removed.length, 0)
    }
    const h = harness([], { readError: true })
    assert.ok((await h.actions.discardSlideUpload(replacement)).warning)
    assert.equal(h.removed.length, 0)
})

test('迁移静态检查：独立表最多三条、匿名只读、管理员写入、独立公开桶及版本触发器', () => {
    const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261108_home_slides.sql'), 'utf8')
    assert.match(sql, /slot SMALLINT PRIMARY KEY CHECK \(slot BETWEEN 1 AND 3\)/)
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
    assert.match(sql, /FOR SELECT TO anon, authenticated USING \(true\)/)
    for (const operation of ['INSERT', 'UPDATE', 'DELETE']) {
        assert.match(sql, new RegExp(`FOR ${operation} TO authenticated[\\s\\S]*?public\\.is_admin\\(\\)`))
    }
    assert.match(sql, /VALUES \('home-slides', 'home-slides', true, 5242880/)
    assert.match(sql, /OLD.updated_at \+ interval '1 microsecond'/)
    assert.doesNotMatch(sql, /CREATE (?:UNIQUE )?INDEX|ALTER TABLE public\.(?!home_slides)|UPDATE storage\.buckets/i)
    assert.match(sql, /BEGIN;/)
    assert.match(sql, /COMMIT;/)
})

test('多语言封面同一条记录保存，英文作为默认封面，缺失语言有回退', async () => {
    const h = harness()
    const paths = { en: image(1), zh: replacement, th: '1/550e8400-e29b-41d4-a716-446655440003.jpg' }
    const result = await h.actions.saveHomeSlide(saveInput(1, { image_paths: paths }))
    assert.equal(result.ok, true)
    assert.deepEqual(result.data.image_paths, paths)
    assert.equal(result.data.image_path, paths.en)
    assert.equal(h.rows.length, 1)
    const { getSlideImagePath } = load('lib/features/slides/images.ts')
    assert.equal(getSlideImagePath(result.data, 'zh'), paths.zh)
    assert.equal(getSlideImagePath({ ...result.data, image_paths: { en: paths.en } }, 'th'), paths.en)
    const zhOnly = harness()
    const saved = await zhOnly.actions.saveHomeSlide(saveInput(1, { image_paths: { zh: replacement } }))
    assert.equal(saved.ok, true)
    assert.equal(saved.data.image_path, replacement)
    assert.equal(getSlideImagePath(saved.data, 'th'), replacement)
})

test('多语言路径不允许空对象、未知语言、跨位置或非法文件', () => {
    for (const paths of [{}, { ja: image(1) }, { en: image(2) }, { zh: '1/invalid.svg' }]) {
        assert.equal(validation.saveSlideSchema.safeParse(saveInput(1, { image_paths: paths })).success, false)
    }
})

test('只改跳转的旧调用保留三语图片，引用中的非默认封面不清理', async () => {
    const paths = { en: image(1), zh: replacement }
    const h = harness([{ ...slide(1), image_paths: paths }])
    assert.equal((await h.actions.saveHomeSlide(saveInput(1, { expected_updated_at: stamp }))).ok, true)
    assert.deepEqual(h.rows[0].image_paths, paths)
    await h.actions.discardSlideUpload(replacement)
    assert.deepEqual(h.removed, [])
})

test('替换某语言只清理该语言旧图，删除幻灯片清理全部语言图片', async () => {
    const oldZh = '1/550e8400-e29b-41d4-a716-446655440003.jpg'
    const h = harness([{ ...slide(1), image_paths: { en: image(1), zh: oldZh } }])
    const result = await h.actions.saveHomeSlide(saveInput(1, { expected_updated_at: stamp, image_paths: { en: image(1), zh: replacement } }))
    assert.equal(result.ok, true)
    assert.deepEqual(h.removed, [oldZh])
    await h.actions.deleteHomeSlide({ slot: 1, expected_updated_at: result.data.updated_at })
    assert.deepEqual(new Set(h.removed), new Set([oldZh, image(1), replacement]))
})

test('多语言升级保留旧字段和图片，沿用 RLS 和 Storage 策略', () => {
    const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261108_home_slides_i18n.sql'), 'utf8')
    assert.match(sql, /ADD COLUMN image_paths JSONB NOT NULL/)
    assert.match(sql, /jsonb_build_object\('en', image_path\)/)
    assert.match(sql, /valid_home_slide_images/)
    assert.doesNotMatch(sql, /DROP COLUMN|CREATE POLICY|ALTER POLICY|storage\.objects|CREATE (?:UNIQUE )?INDEX/i)
})
