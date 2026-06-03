#!/usr/bin/env node
/**
 * build-seed.mjs — 把当前 SQLite DB 里的"示例项目"打包成出厂种子数据
 *
 * 输出到 data/seed/：
 *   - projects.json / volumes.json / chapter_nodes.json / characters.json
 *   - constraints.json / core_outlines.json / settings.json
 *   - images/covers/*.webp / images/characters/*.webp
 *
 * 排除：
 *   - 全局 API/模型配置（apiPresets / featureConfig* / apiKey / baseUrl / model / demoMode）
 *   - 运行时状态（plot_states / plot_events / char_dynamic_states / char_growth_arcs /
 *     compressed_contexts / agent_activities / prompt_logs / chapters）
 *
 * 包含项目级 settings：core_outline_* / narragen_form_draft_* / volumePlan_*
 *
 * 格式说明（图片）：
 *   - **seed 图片统一压缩为 webp**（节省仓库体积：原 19MB → 1.5MB）
 *   - 正常流程生成的图片仍然是 PNG（imageGeneration.js:894 写死 .png + image/png base64）
 *   - 两者的 URL 都通过 vite image API（data/images/{type}/{filename}）按文件路径 serve，
 *     mimeType 自动判定，所以 webp / png 都能正常显示，不冲突
 *   - 打包时 DB 引用里的图片 URL 也会从 .png 改写为 .webp（见 `toWebp`）
 *
 * 用法：node scripts/build-seed.mjs
 */

import Database from 'better-sqlite3';
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DB_PATH = resolve('data/app.sqlite');
const SEED_DIR = resolve('data/seed');
const IMG_SRC = {
    covers: resolve('data/images/covers'),
    characters: resolve('data/images/characters'),
};
const IMG_DST = {
    covers: resolve('data/seed/images/covers'),
    characters: resolve('data/seed/images/characters'),
};

// 全局配置 key：绝不能进 seed
const GLOBAL_CONFIG_KEYS = new Set([
    'apiKey', 'apiPresets', 'baseUrl', 'model', 'demoMode',
    'summaryApiKey', 'summaryModel', 'useSeparateSummaryModel',
    'featureConfig',
]);
// 项目级 settings key 前缀：项目相关，跟随项目
const PROJECT_SETTINGS_PREFIXES = [
    'core_outline_',
    'narragen_form_draft_',
    'volumePlan_subplots_',
    'volumePlan_foreshadowing_',
    'character_presets_',
];
// 运行时表：不进 seed
const RUNTIME_TABLES = new Set([
    'plot_states', 'plot_events',
    'char_dynamic_states', 'char_growth_arcs', 'compressed_contexts',
    'agent_activities', 'prompt_logs', 'chapters',
    'settings', // 单独处理
]);

// characters 表里存为 JSON 字符串的字段
const CHARACTERS_JSON_FIELDS = ['currentState', 'relationships', 'stateHistory', 'chapterAppearances'];

// 抽取一个项目中所有被引用的图片文件（cover + character avatar/displayImage 等）
function collectImageRefs(projects, characters) {
    const refs = new Set();
    for (const p of projects) {
        if (p.cover) refs.add(p.cover);
    }
    for (const c of characters) {
        if (c.avatar) refs.add(c.avatar);
        if (c.displayImage) refs.add(c.displayImage);
        if (c.originalAvatar) refs.add(c.originalAvatar);
        if (c.originalDisplayImage) refs.add(c.originalDisplayImage);
    }
    return refs;
}

// 把 URL 里的 .png 改成 .webp
function toWebp(url) {
    if (!url || typeof url !== 'string') return url;
    return url.replace(/\.png$/i, '.webp');
}

// 拷贝 + 转码为 webp
function transcodeToWebp(srcPath, dstPath) {
    if (!existsSync(srcPath)) {
        console.warn(`  ⚠️  source not found: ${srcPath}`);
        return false;
    }
    try {
        execFileSync('cwebp', ['-q', '82', srcPath, '-o', dstPath], { stdio: 'pipe' });
        return true;
    } catch (e) {
        console.warn(`  ⚠️  cwebp failed for ${srcPath}: ${e.message}`);
        return false;
    }
}

// 把字符串字段解析为对象（前端 parseJsonFields 做的事，这里反向做一遍以便导出）
function parseJsonField(table, row) {
    const jsonMap = {
        characters: CHARACTERS_JSON_FIELDS,
        volumes: ['keyEvents'],
        projects: ['bookStyle', 'tags'],
    };
    const fields = jsonMap[table];
    if (!fields) return row;
    for (const f of fields) {
        if (row[f] && typeof row[f] === 'string') {
            try { row[f] = JSON.parse(row[f]); }
            catch { /* keep as string */ }
        }
    }
    return row;
}

function main() {
    console.log('▶ build-seed: starting');
    const db = new Database(DB_PATH, { readonly: true });

    // 1) 取出所有项目 ID
    const projects = db.prepare('SELECT * FROM projects ORDER BY createdAt ASC').all()
        .map(r => parseJsonField('projects', r));
    if (projects.length === 0) {
        console.error('❌ DB 里没有项目，先创建一些再跑此脚本');
        process.exit(1);
    }
    console.log(`  · ${projects.length} projects: ${projects.map(p => p.name).join(', ')}`);

    const projectIds = projects.map(p => p.id);

    // 2) 关联子表
    const inList = (table) => {
        const placeholders = projectIds.map(() => '?').join(',');
        return db.prepare(`SELECT * FROM ${table} WHERE projectId IN (${placeholders})`).all(...projectIds);
    };

    const volumes = inList('volumes').map(r => parseJsonField('volumes', r));
    const chapterNodes = inList('chapter_nodes');
    const characters = inList('characters').map(r => parseJsonField('characters', r));
    const constraints = inList('constraints');

    // 3) 核心大纲（独立表）
    const coreOutlines = db.prepare(
        `SELECT * FROM core_outlines WHERE projectId IN (${projectIds.map(() => '?').join(',')})`
    ).all(...projectIds);

    // 4) 项目级 settings（过滤掉全局配置 + 孤儿 key，即属于已删除项目的）
    const allSettings = db.prepare('SELECT key, value FROM settings').all();
    const projectIdSet = new Set(projectIds);
    const projectSettings = allSettings.filter(({ key }) => {
        if (GLOBAL_CONFIG_KEYS.has(key)) return false;
        if (key.startsWith('featureConfig_')) return false; // 项目级 featureConfig 也排除（绑定到 API 配置）
        if (!PROJECT_SETTINGS_PREFIXES.some(p => key.startsWith(p))) return false;
        // 必须归属到当前 5 个项目之一，否则视为孤儿（项目已删除留下的）
        const idMatch = key.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        return idMatch ? projectIdSet.has(idMatch[0]) : false;
    });

    // 5) 收集图片引用 → 转 webp
    const imageRefs = collectImageRefs(projects, characters);
    console.log(`  · ${imageRefs.size} unique image references`);

    mkdirSync(IMG_DST.covers, { recursive: true });
    mkdirSync(IMG_DST.characters, { recursive: true });

    const transcoded = new Set();
    for (const url of imageRefs) {
        // URL 形如 /api/images/covers/xxx.png
        const m = url.match(/^\/api\/images\/(covers|characters)\/(.+)$/);
        if (!m) continue;
        const [, type, filename] = m;
        const srcDir = IMG_SRC[type];
        const dstDir = IMG_DST[type];
        if (!srcDir || !dstDir) continue;

        const srcPath = join(srcDir, filename);
        const webpName = filename.replace(/\.png$/i, '.webp');
        const dstPath = join(dstDir, webpName);

        if (transcodeToWebp(srcPath, dstPath)) transcoded.add(url);
    }
    console.log(`  · ${transcoded.size} images transcoded to webp`);

    // 6) 把所有 URL 改成 .webp
    const rewrite = (row, fields) => {
        for (const f of fields) {
            if (row[f]) row[f] = toWebp(row[f]);
        }
        return row;
    };
    projects.forEach(p => rewrite(p, ['cover']));
    characters.forEach(c => rewrite(c, ['avatar', 'displayImage', 'originalAvatar', 'originalDisplayImage']));

    // 7) 写入 JSON
    mkdirSync(SEED_DIR, { recursive: true });

    const write = (name, data) => {
        const path = join(SEED_DIR, `${name}.json`);
        writeFileSync(path, JSON.stringify(data, null, 2));
        console.log(`  · wrote ${name}.json (${data.length} rows)`);
    };

    write('projects', projects);
    write('volumes', volumes);
    write('chapter_nodes', chapterNodes);
    write('characters', characters);
    write('constraints', constraints);
    write('core_outlines', coreOutlines);
    write('settings', projectSettings);

    // 8) 元信息
    const manifest = {
        version: 1,
        createdAt: new Date().toISOString(),
        projectCount: projects.length,
        imageCount: transcoded.size,
        note: '出厂种子数据。加载时机：DB 中 projects 表为空时自动加载。',
    };
    writeFileSync(join(SEED_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

    db.close();
    console.log(`✅ build-seed: done → ${SEED_DIR}`);
}

main();
