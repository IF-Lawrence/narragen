/**
 * MD3 动态取色服务
 * 从图片提取源色，用于全局主题和书脊
 */
import {
    hexFromArgb,
    sourceColorFromImage,
    Hct,
} from '@material/material-color-utilities';

function rgbToHex(r, g, b) {
    return `#${[r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function extractCanvasAverageColor(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const w = 64;
    const h = 64;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);

    const { data } = ctx.getImageData(0, 0, w, h);
    let r = 0;
    let g = 0;
    let b = 0;
    let weightTotal = 0;

    for (let i = 0; i < data.length; i += 4 * 3) {
        const alpha = data[i + 3] / 255;
        if (alpha < 0.2) continue;

        const pr = data[i];
        const pg = data[i + 1];
        const pb = data[i + 2];
        const max = Math.max(pr, pg, pb);
        const min = Math.min(pr, pg, pb);
        const saturation = max === 0 ? 0 : (max - min) / max;
        const brightness = max / 255;

        // Prefer visible, moderately saturated pixels; avoid white/black background dominance.
        const weight = alpha * (0.35 + saturation) * (brightness > 0.18 && brightness < 0.95 ? 1 : 0.35);
        r += pr * weight;
        g += pg * weight;
        b += pb * weight;
        weightTotal += weight;
    }

    if (!weightTotal) return null;
    return rgbToHex(r / weightTotal, g / weightTotal, b / weightTotal);
}

/**
 * 从图片 URL 或 base64 提取 MD3 源色
 * @param {string} imageSrc - 图片 URL 或 base64
 * @returns {Promise<string|null>} - hex 颜色值，如 "#C5A059"
 */
export async function extractSourceColor(imageSrc) {
    if (!imageSrc) return null;

    try {
        // 创建 Image 对象
        const img = new Image();
        img.crossOrigin = 'Anonymous';

        const loaded = new Promise((resolve, reject) => {
            img.onload = () => resolve(img);
            img.onerror = reject;
        });

        img.src = imageSrc;
        await loaded;

        // 使用 MD3 官方算法提取源色
        const sourceColorArgb = await sourceColorFromImage(img);
        const sourceColorHex = hexFromArgb(sourceColorArgb);

        return sourceColorHex.toUpperCase();
    } catch (error) {
        console.warn('[DynamicColor] 取色失败:', error);
        return null;
    }
}

/**
 * 从图片快速提取主色（Canvas 方式，用于同步场景）
 * 这是一个简化版，用于书脊等需要立即返回的场景
 * @param {string} imageSrc - 图片 URL 或 base64
 * @param {function} callback - 回调函数，接收 hex 颜色值
 */
export function extractColorSync(imageSrc, callback) {
    if (!imageSrc) {
        callback?.(null);
        return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    let handled = false;

    img.onload = async () => {
        if (handled) return;
        handled = true;
        try {
            let sourceColorArgb = null;
            try {
                sourceColorArgb = await sourceColorFromImage(img);
            } catch (error) {
                console.warn('[DynamicColor] MD3 取色失败，尝试 Canvas 兜底:', error);
                const fallbackColor = extractCanvasAverageColor(img);
                callback?.(fallbackColor);
                return;
            }

            // 下面尝试检测图片整体饱和度，修正 MD3 算法在黑白图片上容易提取出高饱和度噪点颜色的问题
            let finalColorArgb = sourceColorArgb;

            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                // 缩小尺寸加速计算
                const w = 64;
                const h = 64;
                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(img, 0, 0, w, h);
                const imageData = ctx.getImageData(0, 0, w, h);
                const data = imageData.data;

                let totalSat = 0;
                let count = 0;

                for (let i = 0; i < data.length; i += 4 * 4) { // 步长4 (每4个像素采样一次)
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    const max = Math.max(r, g, b);
                    const min = Math.min(r, g, b);
                    const delta = max - min;
                    // HSV Saturation
                    const sat = max === 0 ? 0 : (delta / max);

                    totalSat += sat;
                    count++;
                }

                const avgSat = totalSat / count;

                // 如果图片平均饱和度极低（< 10%），说明是黑白或极低饱和度图片
                // 此时强制将提取出的颜色的 Chroma 压低，避免提取出原本只是噪点的鲜艳色
                if (avgSat < 0.1) {
                    const hct = Hct.fromInt(sourceColorArgb);
                    // 如果提取出的颜色饱和度明显高于图片的平均饱和度（例如 > 30），说明是误判
                    if (hct.chroma > 30) {
                        // 强制降低饱和度到极低水平，保留一点色调
                        hct.chroma = 5;
                        finalColorArgb = hct.toInt();
                    }
                }
            } catch (e) {
                console.warn('[DynamicColor] Saturation check failed:', e);
            }

            const sourceColorHex = hexFromArgb(finalColorArgb);
            callback?.(sourceColorHex.toUpperCase());
        } catch (error) {
            console.warn('[DynamicColor] 同步取色失败:', error);
            callback?.(null);
        }
    };

    img.onerror = () => {
        if (handled) return;
        handled = true;
        console.warn('[DynamicColor] 图片加载失败');
        callback?.(null);
    };

    img.src = imageSrc;

    if (img.complete && img.naturalWidth > 0) {
        img.onload();
    }
}

/**
 * 默认主色（Nobel Gold）
 */
export const DEFAULT_PRIMARY = '#C5A059';

/**
 * 深色模式下的默认主色（更亮的金色）
 */
export const DEFAULT_PRIMARY_DARK = '#DBC08E';
