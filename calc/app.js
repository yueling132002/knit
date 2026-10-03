/* 毛线用量计算器 —— 界面逻辑 */
(function () {
  'use strict';
  const C = window.YarnCalc;
  const STORE_KEY = 'yarn-calc-v1';

  // ---------- 状态 ----------
  function specDefault(mode) {
    return { mode: mode || 'nm', plies: '', count: '', length: '', lenUnit: 'm', weight: '50', wtUnit: 'g' };
  }
  function nmSpec(plies, count) {
    return Object.assign(specDefault('nm'), { plies: String(plies), count: String(count) });
  }
  function lenSpec(length, weight) {
    return Object.assign(specDefault('len'), { length: String(length), weight: String(weight) });
  }
  function newSub() { return { name: '', spec: specDefault('nm'), count: '1', skein: '50' }; }
  function newGroup() { return { name: '', spec: specDefault('len'), grams: '', subs: [newSub()] }; }
  function newColor(name) { return { name: name || '', used: '', share: '100', spec: specDefault('nm'), skein: '50' }; }
  function newPiece(name, qty) { return { name: name || '', top: '', bottom: '', h: '', qty: String(qty || 1) }; }
  function newStrand() { return { spec: specDefault('nm'), count: '1' }; }

  function defaultState() {
    return {
      tab: 'pattern',
      pattern: { groups: [newGroup()], gauge: { pS: '', pR: '', mS: '', mR: '' }, adjust: '0', margin: '10' },
      swatch: {
        w: '15', h: '15', margin: '10',
        colors: [newColor('主线')],
        pieces: [newPiece('衣身', 1), newPiece('袖子', 2)],
      },
      progress: { bought: '', remaining: '', percent: '', done: '', total: '', skein: '50', margin: '5' },
      convert: { strands: [newStrand()] },
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      const d = defaultState();
      return Object.assign(d, s);
    } catch (e) { return null; }
  }
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    }, 200);
  }

  let state = load() || defaultState();

  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function setPath(obj, path, val) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce(function (o, k) { return o[k]; }, obj);
    target[last] = val;
  }

  // ---------- 小工具 ----------
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function ok(n) { return typeof n === 'number' && Number.isFinite(n); }
  function fmt(n, d) {
    if (!ok(n)) return '—';
    d = d == null ? 0 : d;
    return n.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function fmtAuto(n) {
    if (!ok(n)) return '—';
    return fmt(n, Math.abs(n) < 10 ? 2 : Math.abs(n) < 100 ? 1 : 0);
  }

  function num(path, val, ph, cls) {
    return '<input type="number" inputmode="decimal" step="any" min="0" class="' + (cls || '') +
      '" data-path="' + path + '" value="' + esc(val) + '" placeholder="' + esc(ph || '') + '">';
  }
  function text(path, val, ph, cls) {
    return '<input type="text" class="' + (cls || '') + '" data-path="' + path + '" value="' + esc(val) +
      '" placeholder="' + esc(ph || '') + '">';
  }
  function opt(value, label, cur) {
    return '<option value="' + value + '"' + (String(cur) === value ? ' selected' : '') + '>' + label + '</option>';
  }
  function field(label, inner) {
    return '<label class="field">' + label + inner + '</label>';
  }
  function specInput(path, spec) {
    return '<span class="spec" data-mode="' + esc(spec.mode) + '">' +
      '<select data-path="' + path + '.mode" data-rerender="1">' +
      opt('nm', '支数', spec.mode) + opt('len', '米数/克重', spec.mode) + '</select>' +
      '<span class="spec-nm">' + num(path + '.plies', spec.plies, '股', 'xs') +
      '<span class="slash">/</span>' + num(path + '.count', spec.count, '支', 'xs') +
      '<span class="unit">Nm</span></span>' +
      '<span class="spec-len">' + num(path + '.length', spec.length, '米数', 'sm') +
      '<select data-path="' + path + '.lenUnit">' + opt('m', 'm', spec.lenUnit) + opt('yd', 'yd', spec.lenUnit) + '</select>' +
      '<span class="slash">/</span>' + num(path + '.weight', spec.weight, '克重', 'xs') +
      '<select data-path="' + path + '.wtUnit">' + opt('g', 'g', spec.wtUnit) + opt('oz', 'oz', spec.wtUnit) + '</select></span>' +
      '<span class="out" data-spec-out="' + path + '"></span>' +
      '</span>';
  }
  function delBtn(action, attrs) {
    return '<button class="del" title="删除" data-action="' + action + '" ' + attrs + '>×</button>';
  }

  // ---------- ① 按图解换线 ----------
  function renderPattern() {
    const p = state.pattern;
    let h = '';
    h += '<div class="intro">' +
      '<p><b>适合：</b>不用图解推荐的线，换成自己的线。</p>' +
      '<p>原理：先算出图解一共要用<b>多少米</b>线，再按你的线<b>每克多少米</b>换算成克数。多根合织时，每一根都要织够同样的长度。</p>' +
      '</div>';

    h += '<div class="card"><h3>密度与余量</h3>' +
      '<p class="hint">密度可不填。如果你的小样密度和图解不同（例如线更细、你手更紧），填上后会按密度修正用量。</p>' +
      '<div class="grid">' +
      field('图解 针数 / 10cm', num('pattern.gauge.pS', p.gauge.pS, '如 13')) +
      field('图解 行数 / 10cm', num('pattern.gauge.pR', p.gauge.pR, '如 14')) +
      field('我的小样 针数 / 10cm', num('pattern.gauge.mS', p.gauge.mS, '')) +
      field('我的小样 行数 / 10cm', num('pattern.gauge.mR', p.gauge.mR, '')) +
      field('改长度 / 尺寸（± %）', num('pattern.adjust', p.adjust, '0')) +
      field('购买余量 %', num('pattern.margin', p.margin, '10')) +
      '</div><div class="out" id="gauge-out" style="margin-top:6px"></div></div>';

    p.groups.forEach(function (g, gi) {
      const base = 'pattern.groups.' + gi;
      h += '<div class="card">' +
        '<div class="card-head"><span class="badge">图解线材 ' + (gi + 1) + '</span>' +
        text(base + '.name', g.name, '名称，如 Peer Gynt') +
        (p.groups.length > 1 ? delBtn('del-group', 'data-g="' + gi + '"') : '') + '</div>' +
        '<div class="row"><span class="lbl">线材规格</span>' + specInput(base + '.spec', g.spec) + '</div>' +
        '<div class="row"><span class="lbl">图解用量</span>' + num(base + '.grams', g.grams, '克数') +
        '<span class="unit">g（填你要织的尺码）</span><span class="out" data-out="pm-' + gi + '"></span></div>';

      h += '<div class="sub-block"><div class="sub-title">↳ 我用什么线替代它？同一种线多根合织，改“根数”即可</div>';
      g.subs.forEach(function (s, si) {
        const sb = base + '.subs.' + si;
        h += '<div class="item">' +
          text(sb + '.name', s.name, '我的线名称', 'sm-text') +
          specInput(sb + '.spec', s.spec) +
          '<label>根数 ' + num(sb + '.count', s.count, '1', 'xs') + '</label>' +
          '<label>每团 ' + num(sb + '.skein', s.skein, '50', 'xs') + ' g</label>' +
          (g.subs.length > 1 ? delBtn('del-sub', 'data-g="' + gi + '" data-i="' + si + '"') : '') +
          '</div>';
      });
      h += '<div class="btn-row"><button class="btn" data-action="add-sub" data-g="' + gi + '">+ 再加一种线一起合织</button></div>';
      h += '</div></div>';
    });

    h += '<div class="btn-row">' +
      '<button class="btn" data-action="add-group">+ 添加图解中的另一种线</button>' +
      '<button class="btn" data-action="example-pattern">载入示例</button></div>';
    h += '<div class="result" id="pattern-result"></div>';

    h += '<details><summary>为什么不能直接按克数换？</summary>' +
      '<p>不同线材每克的长度差别很大。比如图解用 135 米/50g 的马海毛 400g，一共是 1080 米；换成 1/4 支（200 米/50g）的线，同样 1080 米只需要 270g。反过来，如果换的线更粗更重，需要的克数会比图解多。</p>' +
      '<p>密度修正是经验估算：单位面积用线长度大约和 √(针数×行数) 成正比。差异较大时，用「小样称重」会更准。</p>' +
      '</details>';

    document.getElementById('panel-pattern').innerHTML = h;
  }

  function computePattern() {
    const r = C.patternCalc(state.pattern);
    const gOut = document.getElementById('gauge-out');
    if (gOut) {
      gOut.textContent = r.gaugeFactor !== 1 && ok(r.gaugeFactor)
        ? '密度修正系数 ×' + fmt(r.gaugeFactor, 2) + '（你的用线量约为图解同面积的 ' + fmt(r.gaugeFactor * 100) + '%）'
        : '';
    }
    r.groups.forEach(function (g, gi) {
      const el = document.querySelector('[data-out="pm-' + gi + '"]');
      if (el) el.textContent = ok(g.patternMeters) ? '= 约 ' + fmt(g.patternMeters) + ' 米' : '';
    });

    const box = document.getElementById('pattern-result');
    if (!box) return;
    let rows = '';
    const notes = [];
    r.groups.forEach(function (g, gi) {
      const gname = state.pattern.groups[gi].name || '图解线材 ' + (gi + 1);
      g.subs.forEach(function (s, si) {
        const sname = state.pattern.groups[gi].subs[si].name || ('替代线 ' + (si + 1));
        rows += '<tr><td>' + esc(sname) + '<br><span class="hint">替代「' + esc(gname) + '」' +
          (s.count > 1 ? ' · ' + fmt(s.count) + ' 根合织' : '') + '</span></td>' +
          '<td class="num">' + fmt(s.strandMeters) + ' m</td>' +
          '<td class="num">' + fmt(s.grams) + ' g</td>' +
          '<td class="num"><span class="big">' + fmt(s.gramsWithMargin) + ' g</span></td>' +
          '<td class="num">' + (ok(s.skeins) ? s.skeins + ' 团' : '—') + '</td></tr>';
      });
      if (ok(g.thicknessRatio) && ok(g.patternMeters)) {
        const pct = g.thicknessRatio * 100;
        const msg = '「' + esc(gname) + '」：你的线合起来每米重 ' + fmt(g.subGpm, 3) + ' g，图解原线每米重 ' +
          fmt(g.patternGpm, 3) + ' g，约为原线的 <b>' + fmt(pct) + '%</b>。';
        if (pct < 80 || pct > 125) {
          notes.push('<div class="note warn">' + msg + ' 粗细差别较大，织出来的密度很可能和图解不同。请务必织小样，并在上方填上你的密度。</div>');
        } else {
          notes.push('<div class="note info">' + msg + ' 粗细接近。</div>');
        }
      }
    });

    const any = r.groups.some(function (g) { return g.subs.some(function (s) { return ok(s.grams); }); });
    if (!any) {
      box.innerHTML = '<h3>计算结果</h3><p class="empty">填写图解线材的规格、用量，以及你的替代线规格后，这里会显示你需要买多少。</p>';
      return;
    }
    box.innerHTML = '<h3>计算结果</h3><div class="table-wrap"><table><thead><tr>' +
      '<th>我的线</th><th class="num">需要长度</th><th class="num">净用量</th><th class="num">建议购买<br>(+' +
      fmt((r.margin - 1) * 100) + '%)</th><th class="num">团数</th></tr></thead><tbody>' + rows +
      '</tbody></table></div>' + notes.join('') +
      '<p class="hint">「需要长度」是这种线一共要织的长度（多根合织已乘以根数）。图解用量本身通常已带少量余量。</p>';
  }

  // ---------- ② 小样称重 ----------
  function renderSwatch() {
    const s = state.swatch;
    let h = '<div class="intro">' +
      '<p><b>最准的方法，配色线、提花尤其推荐。</b></p>' +
      '<p>① 用同样的针、花样织一块小样（建议 15×15cm 以上），<b>织之前和织完各称一次每种颜色的线团</b>（厨房秤精确到 0.1g）。' +
      '② 小样洗过、定型后再量尺寸。③ 按图解的尺寸图填衣片面积。</p></div>';

    h += '<div class="card"><h3>小样尺寸（定型后）</h3><div class="grid">' +
      field('宽 cm', num('swatch.w', s.w, '15')) +
      field('高 cm', num('swatch.h', s.h, '15')) +
      field('购买余量 %', num('swatch.margin', s.margin, '10')) +
      '</div></div>';

    h += '<div class="card"><h3>小样各颜色用掉的克数</h3>' +
      '<p class="hint">用量 = 织前线团重量 − 织后线团重量。「占面积」：这种线只用在部分衣片时（比如只在育克提花），填它大约占整件衣服面积的百分比。规格可不填，填了会显示米数。</p>';
    s.colors.forEach(function (c, i) {
      const b = 'swatch.colors.' + i;
      h += '<div class="item">' + text(b + '.name', c.name, '颜色 / 线名', 'sm-text') +
        '<label>用掉 ' + num(b + '.used', c.used, '克', 'sm') + ' g</label>' +
        '<label>占面积 ' + num(b + '.share', c.share, '100', 'xs') + ' %</label>' +
        '<label>每团 ' + num(b + '.skein', c.skein, '50', 'xs') + ' g</label>' +
        specInput(b + '.spec', c.spec) +
        (s.colors.length > 1 ? delBtn('del-color', 'data-i="' + i + '"') : '') + '</div>';
    });
    h += '<div class="btn-row"><button class="btn" data-action="add-color">+ 添加颜色 / 线材</button></div></div>';

    h += '<div class="card"><h3>衣片尺寸（参考图解的尺寸图）</h3>' +
      '<p class="hint">每一片都按梯形算：上宽、下宽、高。矩形只填上宽即可。圈织衣身：宽 = 胸围，高 = 衣长。袖子：上宽 = 袖根围，下宽 = 袖口围，数量 2。</p>';
    s.pieces.forEach(function (pc, i) {
      const b = 'swatch.pieces.' + i;
      h += '<div class="item">' + text(b + '.name', pc.name, '衣片名称', 'sm-text') +
        '<label>上宽 ' + num(b + '.top', pc.top, 'cm', 'xs') + '</label>' +
        '<label>下宽 ' + num(b + '.bottom', pc.bottom, '同上', 'xs') + '</label>' +
        '<label>高 ' + num(b + '.h', pc.h, 'cm', 'xs') + '</label>' +
        '<label>× ' + num(b + '.qty', pc.qty, '1', 'xs') + ' 片</label>' +
        '<span class="out" data-out="pc-' + i + '"></span>' +
        (s.pieces.length > 1 ? delBtn('del-piece', 'data-i="' + i + '"') : '') + '</div>';
    });
    h += '<div class="btn-row"><button class="btn" data-action="add-piece">+ 添加衣片</button>' +
      '<button class="btn" data-action="example-swatch">载入示例</button></div></div>';

    h += '<div class="result" id="swatch-result"></div>';
    h += '<details><summary>提高准确度的小技巧</summary><ul>' +
      '<li>小样越大越准，至少 15×15cm，小样边缘的线头剪掉后再称重。</li>' +
      '<li>麻花、泡泡针这类花样比平针费线 20%–40%。整件织物花样不同的话，最好每种花样各织一块小样，分开计算。</li>' +
      '<li>领口、门襟、口袋、缝合、藏线头都要用线，建议余量至少 10%。</li>' +
      '</ul></details>';
    document.getElementById('panel-swatch').innerHTML = h;
  }

  function computeSwatch() {
    const r = C.swatchCalc(state.swatch);
    r.pieces.forEach(function (pc, i) {
      const el = document.querySelector('[data-out="pc-' + i + '"]');
      if (el) el.textContent = ok(pc.area) ? '= ' + fmt(pc.area) + ' cm²' : '';
    });
    const box = document.getElementById('swatch-result');
    if (!box) return;
    const any = r.colors.some(function (c) { return ok(c.grams); });
    if (!any) {
      box.innerHTML = '<h3>计算结果</h3><p class="empty">填写小样尺寸、各颜色用量和衣片尺寸后显示结果。</p>';
      return;
    }
    let rows = '';
    r.colors.forEach(function (c, i) {
      rows += '<tr><td>' + esc(state.swatch.colors[i].name || '颜色 ' + (i + 1)) + '</td>' +
        '<td class="num">' + fmt(c.gPerCm2 * 100, 2) + ' g</td>' +
        '<td class="num">' + fmt(c.grams) + ' g</td>' +
        '<td class="num"><span class="big">' + fmt(c.gramsWithMargin) + ' g</span></td>' +
        '<td class="num">' + (ok(c.meters) ? fmt(c.meters) + ' m' : '—') + '</td>' +
        '<td class="num">' + (ok(c.skeins) ? c.skeins + ' 团' : '—') + '</td></tr>';
    });
    box.innerHTML = '<h3>计算结果</h3>' +
      '<p>小样面积 ' + fmt(r.swatchArea) + ' cm² · 衣服总面积约 <b>' + fmt(r.totalArea) + ' cm²</b>（约为小样的 ' +
      fmt(r.totalArea / r.swatchArea, 1) + ' 倍）</p>' +
      '<div class="table-wrap"><table><thead><tr><th>线材</th><th class="num">每 100cm²</th><th class="num">净用量</th>' +
      '<th class="num">建议购买<br>(+' + fmt((r.margin - 1) * 100) + '%)</th><th class="num">长度</th><th class="num">团数</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>';
  }

  // ---------- ③ 进度预测 ----------
  function renderProgress() {
    const p = state.progress;
    let h = '<div class="intro"><p><b>织到一半，担心线不够？</b>织完一个完整部分（比如衣身、一只袖子）后，称一下剩下的线，就能预测够不够。越早测，越有时间调整方案。</p></div>';
    h += '<div class="card"><h3>这种线的情况</h3><div class="grid">' +
      field('一共买了 g', num('progress.bought', p.bought, '如 200')) +
      field('现在剩余 g（称所有剩线）', num('progress.remaining', p.remaining, '如 60')) +
      field('每团 g', num('progress.skein', p.skein, '50')) +
      field('剩余部分余量 %', num('progress.margin', p.margin, '5')) +
      '</div></div>';
    h += '<div class="card"><h3>完成了多少？</h3>' +
      '<p class="hint">直接填百分比，或者填「已完成 / 总共」（面积 cm²、行数、片数都可以，单位一致就行）。按面积算最准，用「小样称重」页可以算出衣片面积。</p>' +
      '<div class="grid">' +
      field('完成百分比 %', num('progress.percent', p.percent, '如 70')) +
      field('或：已完成量', num('progress.done', p.done, '面积 / 行数')) +
      field('总量', num('progress.total', p.total, '面积 / 行数')) +
      '</div></div>';
    h += '<div class="result" id="progress-result"></div>';
    h += '<details><summary>如果算出来不够，可以怎么办？</summary><ul>' +
      '<li><b>提前交替混织：</b>找一款相近的线，在还剩不少的时候就开始新旧线每 2 行交替织，过渡会自然很多，不会出现一条明显的分界线。</li>' +
      '<li><b>换个位置用新线：</b>罗纹、领口、门襟、袖口改用另一种颜色或线材，做成"故意的"撞色设计。</li>' +
      '<li><b>调整尺寸：</b>适当缩短袖长、衣长，或者把长袖改成七分袖。</li>' +
      '<li><b>合织线材：</b>如果缺的是马海毛这类合织线，可以考虑找一款粗细相近的同色系马海毛或者丝马海接着织，合织后差异不明显。</li>' +
      '</ul></details>';
    document.getElementById('panel-progress').innerHTML = h;
  }

  function computeProgress() {
    const r = C.progressCalc(state.progress);
    const box = document.getElementById('progress-result');
    if (!box) return;
    if (!ok(r.projected) || !ok(r.diff) || !(r.used > 0)) {
      let msg = '填写买了多少、剩余多少、完成进度后显示预测。';
      if (ok(r.used) && r.used < 0) msg = '剩余量比购买量还多，请检查数字。';
      box.innerHTML = '<h3>预测结果</h3><p class="empty">' + msg + '</p>';
      return;
    }
    const verdict = r.enough
      ? '<div class="verdict ok">✓ 够用，预计还能剩 ' + fmt(r.diff) + ' g</div>'
      : '<div class="verdict bad">✗ 不够，还差约 ' + fmt(-r.diff) + ' g' + (r.shortSkeins ? '（约 ' + r.shortSkeins + ' 团）' : '') + '</div>';
    let tip = '';
    if (!r.enough) tip = '<div class="note bad">建议尽快补线；补不到同款时，参考下方的应对办法，越早开始交替混织，过渡越自然。</div>';
    else if (r.diff < r.futureNeed * 0.1) tip = '<div class="note warn">余量很紧，编织中途的松紧变化就可能导致不够，建议再备一点。</div>';
    box.innerHTML = '<h3>预测结果</h3>' + verdict +
      '<table><tbody>' +
      '<tr><td>已用</td><td class="num">' + fmt(r.used) + ' g（完成 ' + fmt(r.percent, 1) + '%）</td></tr>' +
      '<tr><td>按目前速度，整件预计用</td><td class="num">' + fmt(r.projected) + ' g</td></tr>' +
      '<tr><td>剩余部分还需要（含余量）</td><td class="num">' + fmt(r.futureNeed) + ' g</td></tr>' +
      '<tr><td>手上还剩</td><td class="num">' + fmt(r.remaining) + ' g</td></tr>' +
      '</tbody></table>' + tip +
      '<p class="hint">前提是剩下部分的织法和已完成部分差不多。如果剩下的是更费线的花样（比如麻花），实际用量会更多。</p>';
  }

  // ---------- ④ 支数换算 ----------
  function renderConvert() {
    const c = state.convert;
    let h = '<div class="intro">' +
      '<p><b>支数怎么读？</b>国产线常写成「股数/支数」，比如 <b>2/17.5</b> 就是 2 股 17.5 支（公支 Nm）合成一根线。</p>' +
      '<p>每克米数 = 支数 ÷ 股数，所以 2/17.5 = 8.75 米/克 = 437.5 米/50g。1/4 支 = 4 米/克 = 200 米/50g。</p>' +
      '<p>多根线合在一起织时，按每米重量相加来算合股后的粗细。</p></div>';
    h += '<div class="card"><h3>线材</h3>';
    c.strands.forEach(function (s, i) {
      const b = 'convert.strands.' + i;
      h += '<div class="item">' + specInput(b + '.spec', s.spec) +
        '<label>× ' + num(b + '.count', s.count, '1', 'xs') + ' 根</label>' +
        (c.strands.length > 1 ? delBtn('del-strand', 'data-i="' + i + '"') : '') + '</div>';
    });
    h += '<div class="btn-row"><button class="btn" data-action="add-strand">+ 添加合织的线</button></div></div>';
    h += '<div class="result" id="convert-result"></div>';
    document.getElementById('panel-convert').innerHTML = h;
  }

  function computeConvert() {
    const r = C.convertCalc(state.convert.strands);
    const box = document.getElementById('convert-result');
    if (!box) return;
    if (!r.strands.some(function (s) { return ok(s.mpg); })) {
      box.innerHTML = '<h3>换算结果</h3><p class="empty">填写线材规格后显示。</p>';
      return;
    }
    let rows = '';
    r.strands.forEach(function (s, i) {
      rows += '<tr><td>线 ' + (i + 1) + (s.count > 1 ? ' ×' + fmt(s.count) : '') + '</td>' +
        '<td class="num">' + fmtAuto(s.mpg) + '</td><td class="num">' + fmt(s.m50) + '</td>' +
        '<td class="num">' + fmt(s.m100) + '</td><td class="num">' + fmt(s.yd100) + '</td>' +
        '<td>' + (ok(s.mpg) ? '1/' + fmtAuto(s.mpg) + ' Nm' : '—') + '</td></tr>';
    });
    const multi = r.strands.length > 1 || r.strands[0].count > 1;
    if (multi && ok(r.combined.mpg)) {
      rows += '<tr style="font-weight:600"><td>合股后</td><td class="num">' + fmtAuto(r.combined.mpg) +
        '</td><td class="num">' + fmt(r.combined.m50) + '</td><td class="num">' + fmt(r.combined.m100) +
        '</td><td class="num">' + fmt(r.combined.yd100) + '</td><td>' + (r.combined.cls || '') + '</td></tr>';
    }
    box.innerHTML = '<h3>换算结果</h3><div class="table-wrap"><table><thead><tr><th></th><th class="num">米/克</th>' +
      '<th class="num">米/50g</th><th class="num">米/100g</th><th class="num">码/100g</th><th>等效支数 / 粗细</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>' +
      '<p class="hint">粗细分类按每 100g 米数粗略划分，仅供参考。马海毛等蓬松线材很轻，看起来比分类粗得多。</p>';
  }

  // ---------- 示例 ----------
  function examplePattern() {
    state.pattern = {
      gauge: { pS: '13', pR: '14', mS: '', mR: '' }, adjust: '0', margin: '10',
      groups: [
        { name: 'Peer Gynt', spec: lenSpec(91, 50), grams: '600',
          subs: [{ name: '2/17.5 羊毛', spec: nmSpec(2, 17.5), count: '3', skein: '50' }] },
        { name: 'Chunky Ballerina Mohair', spec: lenSpec(135, 50), grams: '400',
          subs: [{ name: '1/4 支马海', spec: nmSpec(1, 4), count: '1', skein: '50' }] },
      ],
    };
  }
  function exampleSwatch() {
    state.swatch = {
      w: '15', h: '15', margin: '10',
      colors: [
        Object.assign(newColor('2/17.5 羊毛 ×3'), { used: '7.8', spec: nmSpec(2, 17.5) }),
        Object.assign(newColor('1/4 支马海'), { used: '5.6', spec: nmSpec(1, 4) }),
      ],
      pieces: [
        { name: '衣身（圈织）', top: '140', bottom: '', h: '58', qty: '1' },
        { name: '袖子', top: '46', bottom: '26', h: '38', qty: '2' },
      ],
    };
  }

  // ---------- 渲染 / 事件 ----------
  const renderers = { pattern: renderPattern, swatch: renderSwatch, progress: renderProgress, convert: renderConvert };

  function computeAll() {
    computePattern(); computeSwatch(); computeProgress(); computeConvert();
    document.querySelectorAll('[data-spec-out]').forEach(function (el) {
      const mpg = C.metersPerGram(getPath(state, el.getAttribute('data-spec-out')));
      el.textContent = ok(mpg) ? '= ' + fmtAuto(mpg) + ' m/g · ' + fmt(mpg * 50) + ' m/50g' : '';
    });
  }
  function renderAll() {
    Object.keys(renderers).forEach(function (k) { renderers[k](); });
    showTab(state.tab);
    computeAll();
  }
  function showTab(tab) {
    if (!renderers[tab]) tab = 'pattern';
    state.tab = tab;
    document.querySelectorAll('.tab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
      b.setAttribute('aria-selected', b.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('.panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'panel-' + tab);
    });
  }

  document.addEventListener('input', function (e) {
    const path = e.target.getAttribute && e.target.getAttribute('data-path');
    if (!path) return;
    setPath(state, path, e.target.value);
    if (e.target.hasAttribute('data-rerender')) { renderAll(); } else { computeAll(); }
    save();
  });
  document.addEventListener('change', function (e) {
    // 部分浏览器的 select 只触发 change
    const path = e.target.getAttribute && e.target.getAttribute('data-path');
    if (!path || e.target.tagName !== 'SELECT') return;
    if (getPath(state, path) === e.target.value) return;
    setPath(state, path, e.target.value);
    if (e.target.hasAttribute('data-rerender')) renderAll(); else computeAll();
    save();
  });

  document.addEventListener('click', function (e) {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { showTab(tabBtn.getAttribute('data-tab')); save(); window.scrollTo({ top: 0 }); return; }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.getAttribute('data-action');
    const g = +btn.getAttribute('data-g');
    const i = +btn.getAttribute('data-i');
    const P = state.pattern, S = state.swatch;
    switch (a) {
      case 'add-group': P.groups.push(newGroup()); break;
      case 'del-group': P.groups.splice(g, 1); break;
      case 'add-sub': P.groups[g].subs.push(newSub()); break;
      case 'del-sub': P.groups[g].subs.splice(i, 1); break;
      case 'add-color': S.colors.push(newColor()); break;
      case 'del-color': S.colors.splice(i, 1); break;
      case 'add-piece': S.pieces.push(newPiece()); break;
      case 'del-piece': S.pieces.splice(i, 1); break;
      case 'add-strand': state.convert.strands.push(newStrand()); break;
      case 'del-strand': state.convert.strands.splice(i, 1); break;
      case 'example-pattern': examplePattern(); break;
      case 'example-swatch': exampleSwatch(); break;
      case 'reset':
        if (!confirm('确定清空所有填写的数据吗？')) return;
        state = defaultState(); break;
      default: return;
    }
    renderAll();
    save();
  });

  renderAll();
})();
