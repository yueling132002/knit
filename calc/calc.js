/*
 * 毛线用量计算 —— 纯计算函数（无 DOM 依赖，可在浏览器和 Node 中使用）
 *
 * 核心原则：线材之间换算一律按「米数」进行，而不是按「克数」。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.YarnCalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const YD_PER_M = 1.0936133;
  const G_PER_OZ = 28.349523;

  /** 解析数字，空值/非法值返回 NaN */
  function num(v) {
    if (v === null || v === undefined || v === '') return NaN;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }
  /** 解析正数，否则 NaN */
  function pos(v) {
    const n = num(v);
    return n > 0 ? n : NaN;
  }

  /**
   * 线材规格 → 每克多少米
   * spec.mode === 'nm'  : 公支表示法 plies/count，例如 2/17.5 → 17.5 ÷ 2 = 8.75 m/g
   * spec.mode === 'len' : 米数/克重，例如 91 m / 50 g → 1.82 m/g（支持 yd 与 oz）
   */
  function metersPerGram(spec) {
    if (!spec) return NaN;
    if (spec.mode === 'nm') {
      const p = pos(spec.plies);
      const c = pos(spec.count);
      return c / p;
    }
    let L = pos(spec.length);
    let W = pos(spec.weight);
    if (spec.lenUnit === 'yd') L = L / YD_PER_M;
    if (spec.wtUnit === 'oz') W = W * G_PER_OZ;
    return L / W;
  }

  /**
   * 密度修正系数（经验估算）
   * 单位面积用线长度 ≈ 与线圈尺寸成反比 → 按 √(针数×行数) 的比例修正。
   * 只填了针数或行数时，按单一方向的比例修正。都没填则返回 1。
   */
  function gaugeFactor(g) {
    g = g || {};
    const pS = pos(g.pS), pR = pos(g.pR), mS = pos(g.mS), mR = pos(g.mR);
    if (pS && pR && mS && mR) return Math.sqrt((mS * mR) / (pS * pR));
    if (pS && mS) return mS / pS;
    if (pR && mR) return mR / pR;
    return 1;
  }

  function skeinCount(grams, skein) {
    const s = pos(skein);
    if (!(grams > 0) || !s) return NaN;
    return Math.ceil(grams / s - 1e-9);
  }

  /**
   * 按图解换算
   * p = { gauge:{pS,pR,mS,mR}, adjust:%, margin:%, groups:[{ name, spec, grams, subs:[{name, spec, count, skein}] }] }
   */
  function patternCalc(p) {
    const gf = gaugeFactor(p.gauge);
    const adj = 1 + (num(p.adjust) || 0) / 100;
    const mg = 1 + (num(p.margin) || 0) / 100;
    const groups = (p.groups || []).map(function (g) {
      const mpg = metersPerGram(g.spec);
      const grams = pos(g.grams);
      const patternMeters = mpg * grams;
      const needMeters = patternMeters * gf * adj;
      const patternGpm = 1 / mpg;
      let subGpm = 0;
      const subs = (g.subs || []).map(function (s) {
        const smpg = metersPerGram(s.spec);
        const cnt = pos(s.count) || 1;
        const strandMeters = needMeters * cnt; // 这种线的总长度（多根合织则乘以根数）
        const gramsNeed = strandMeters / smpg;
        const gramsWithMargin = gramsNeed * mg;
        subGpm += cnt / smpg;
        return {
          name: s.name,
          mpg: smpg,
          count: cnt,
          strandMeters: strandMeters,
          grams: gramsNeed,
          gramsWithMargin: gramsWithMargin,
          skeins: skeinCount(gramsWithMargin, s.skein),
        };
      });
      return {
        name: g.name,
        mpg: mpg,
        patternGrams: grams,
        patternMeters: patternMeters,
        needMeters: needMeters,
        patternGpm: patternGpm,
        subGpm: subGpm,
        thicknessRatio: subGpm / patternGpm,
        subs: subs,
      };
    });
    return { gaugeFactor: gf, adjust: adj, margin: mg, groups: groups };
  }

  /** 梯形（矩形）面积 × 数量；下宽留空视为矩形 */
  function pieceArea(pc) {
    const top = pos(pc.top);
    const bottom = pos(pc.bottom) || top;
    const h = pos(pc.h);
    const qty = pos(pc.qty) || 1;
    return ((top + bottom) / 2) * h * qty;
  }

  /**
   * 小样称重法
   * s = { w, h, margin, colors:[{name, used, share, spec, skein}], pieces:[{name, top, bottom, h, qty}] }
   */
  function swatchCalc(s) {
    const area = pos(s.w) * pos(s.h);
    const mg = 1 + (num(s.margin) || 0) / 100;
    const pieces = (s.pieces || []).map(function (pc) {
      return { name: pc.name, area: pieceArea(pc) };
    });
    const totalArea = pieces.reduce(function (sum, pc) {
      return sum + (pc.area > 0 ? pc.area : 0);
    }, 0);
    const colors = (s.colors || []).map(function (c) {
      const used = pos(c.used);
      const shareN = num(c.share);
      const share = Number.isFinite(shareN) && shareN >= 0 ? shareN : 100;
      const gPerCm2 = used / area;
      const grams = gPerCm2 * totalArea * (share / 100);
      const gramsWithMargin = grams * mg;
      const mpg = metersPerGram(c.spec);
      return {
        name: c.name,
        gPerCm2: gPerCm2,
        grams: grams,
        gramsWithMargin: gramsWithMargin,
        meters: gramsWithMargin * mpg,
        skeins: skeinCount(gramsWithMargin, c.skein),
      };
    });
    return { swatchArea: area, totalArea: totalArea, pieces: pieces, colors: colors, margin: mg };
  }

  /**
   * 进度预测：根据已用量和完成比例，预测剩余的线够不够
   * p = { bought, remaining, percent, done, total, skein, margin }
   */
  function progressCalc(p) {
    const bought = pos(p.bought);
    const remainingN = num(p.remaining);
    const remaining = remainingN >= 0 ? remainingN : NaN;
    const used = bought - remaining;
    const done = pos(p.done), total = pos(p.total);
    const pct = done && total ? (done / total) * 100 : pos(p.percent);
    const mg = 1 + (num(p.margin) || 0) / 100;
    const projected = used / (pct / 100);
    const futureNeed = (projected - used) * mg;
    const diff = remaining - futureNeed;
    return {
      bought: bought,
      remaining: remaining,
      used: used,
      percent: pct,
      projected: projected,
      projectedWithMargin: used + futureNeed,
      futureNeed: futureNeed,
      diff: diff,
      enough: diff >= 0,
      shortSkeins: diff < 0 ? skeinCount(-diff, p.skein) : 0,
    };
  }

  /** 粗略的线材粗细分类（按每 100g 米数，仅供参考；马海毛等蓬松线材不适用） */
  function weightClass(mPer100g) {
    const m = mPer100g;
    if (!(m > 0)) return '';
    if (m >= 600) return 'Lace 蕾丝线';
    if (m >= 350) return 'Fingering 细线';
    if (m >= 250) return 'Sport 运动线';
    if (m >= 200) return 'DK 中细';
    if (m >= 120) return 'Worsted / Aran 中粗';
    if (m >= 80) return 'Bulky 粗线';
    return 'Super Bulky 超粗';
  }

  /** 支数换算 + 合股 */
  function convertCalc(strands) {
    let gpm = 0;
    let ok = true;
    const list = (strands || []).map(function (s) {
      const mpg = metersPerGram(s.spec);
      const cnt = pos(s.count) || 1;
      if (mpg > 0) gpm += cnt / mpg;
      else ok = false;
      return {
        mpg: mpg,
        count: cnt,
        m50: mpg * 50,
        m100: mpg * 100,
        yd100: mpg * 100 * YD_PER_M,
        cls: weightClass(mpg * 100),
      };
    });
    const cmpg = ok && gpm > 0 ? 1 / gpm : NaN;
    return {
      strands: list,
      combined: {
        mpg: cmpg,
        gpm: ok ? gpm : NaN,
        m50: cmpg * 50,
        m100: cmpg * 100,
        yd100: cmpg * 100 * YD_PER_M,
        cls: weightClass(cmpg * 100),
      },
    };
  }

  return {
    YD_PER_M: YD_PER_M,
    G_PER_OZ: G_PER_OZ,
    num: num,
    pos: pos,
    metersPerGram: metersPerGram,
    gaugeFactor: gaugeFactor,
    patternCalc: patternCalc,
    pieceArea: pieceArea,
    swatchCalc: swatchCalc,
    progressCalc: progressCalc,
    convertCalc: convertCalc,
    weightClass: weightClass,
  };
});
