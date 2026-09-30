(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  // Series colors, checked with the dataviz palette validator (light mode, white surface) across
  // every pair, since radar outlines can cross anywhere: all marks clear 3:1 contrast, the worst pair is
  // ΔE 7.5 under protan/deutan simulation (legend, tooltips and the hidden table carry identity too)
  // and ΔE 15.2 in normal vision. LARC's blue is at least ΔE 14.6 from every other model.
  const MODELS = [
    { id: 'janus', name: 'Janus-Pro', color: '#723789' },
    { id: 'emu3', name: 'Emu3', color: '#cd4805' },
    { id: 'showo2', name: 'Show-o2', color: '#c34189' },
    { id: 'bagel', name: 'BAGEL', color: '#467e49' },
    { id: 'unicot', name: 'Uni-CoT', color: '#b18e15' },
    { id: 'larc', name: 'LARC (ours)', color: '#267cdf', ours: true }
  ];

  // Paper Tables 1, 2, 4 and 5. Values follow each benchmark's axis order; a model absent from a benchmark was not reported there.
  const BENCHMARKS = [
    {
      title: 'GenEval', sub: 'Overall: LARC 0.88 / BAGEL 0.81', task: 'Text-to-image generation',
      axes: [['Single Obj.', 'up', 2], ['Two Obj.', 'up', 2], ['Counting', 'up', 2], ['Colors', 'up', 2], ['Position', 'up', 2], ['Attr. Binding', 'up', 2]],
      values: {
        janus: [0.99, 0.89, 0.59, 0.90, 0.79, 0.66], emu3: [0.98, 0.71, 0.34, 0.81, 0.17, 0.21], showo2: [1.00, 0.87, 0.58, 0.92, 0.52, 0.62],
        bagel: [0.99, 0.94, 0.80, 0.87, 0.64, 0.63], unicot: [0.99, 0.96, 0.84, 0.92, 0.57, 0.71], larc: [1.00, 0.98, 0.86, 0.93, 0.77, 0.78]
      }
    },
    {
      title: 'DPG-Bench', sub: 'Overall: LARC 90.04 / BAGEL 85.07', task: 'Prompt following',
      axes: [['Global', 'up', 2], ['Entity', 'up', 2], ['Attribute', 'up', 2], ['Relation', 'up', 2], ['Other', 'up', 2]],
      values: {
        janus: [86.90, 88.90, 89.40, 89.32, 89.48], emu3: [85.21, 86.68, 86.84, 90.22, 83.15], showo2: [89.00, 91.78, 89.96, 91.81, 91.64],
        bagel: [88.94, 90.37, 91.29, 90.82, 88.67], unicot: [87.58, 89.14, 91.62, 91.09, 86.97], larc: [92.25, 91.89, 93.00, 94.70, 92.35]
      }
    },
    {
      title: 'CompBench', sub: 'Multi-object editing', task: 'Image editing',
      axes: [['LC-T', 'up', 3], ['LC-I', 'up', 3], ['PSNR', 'up', 3], ['SSIM', 'up', 3], ['LPIPS', 'down', 3]],
      values: {
        janus: [19.769, 0.801, 21.192, 0.856, 0.097], emu3: [19.536, 0.803, 22.036, 0.868, 0.092], showo2: [20.350, 0.831, 24.661, 0.919, 0.065],
        bagel: [20.434, 0.842, 24.370, 0.917, 0.069], unicot: [20.215, 0.837, 23.925, 0.904, 0.088], larc: [22.509, 0.880, 25.710, 0.953, 0.049]
      }
    },
    {
      title: 'Understanding', sub: 'Perception and visual reasoning', task: 'Multimodal',
      axes: [['MME', 'up', 1], ['MMB', 'up', 1], ['MMMU', 'up', 1], ['MIRA', 'up', 1]],
      values: {
        janus: [1567.1, 79.2, 41.0, 4.9], emu3: [1487.3, 67.4, 31.6, 4.1], showo2: [1620.5, 79.3, 48.9, 6.9],
        bagel: [1687.0, 85.0, 55.3, 7.5], unicot: [1691.7, 85.4, 55.5, 10.6], larc: [1725.3, 88.1, 56.2, 11.7]
      }
    }
  ];

  // Paper Table 11: seconds per sample on one A100, batch size 1.
  const CLOCK = {
    x: [1, 2, 4, 6, 8, 10],
    series: [
      { id: 'bagel', name: 'BAGEL + best-of-N', color: '#467e49', unit: 'N', values: [46.5, 92.8, 187.1, 275.5, 367.7, 469.0] },
      { id: 'larc', name: 'LARC', color: '#267cdf', unit: 'L', ours: true, values: [46.8, 46.9, 47.0, 47.3, 47.6, 48.0] }
    ]
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function svg(tag, attributes) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attributes || {}).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }
  const arrow = dir => (dir === 'down' ? '↓' : '↑');

  function createTip(host) {
    const tip = el('div', 'chart-tip');
    tip.setAttribute('aria-hidden', 'true');
    host.append(tip);
    return tip;
  }
  function placeTip(tip, host, x, y) {
    tip.classList.add('is-visible');
    const half = tip.offsetWidth / 2;
    tip.style.left = `${Math.max(half, Math.min(host.clientWidth - half, x))}px`;
    tip.style.top = `${y}px`;
  }
  function tipRow(color, value, label) {
    const row = el('div', 'tip-value');
    const key = el('span', 'tip-key');
    key.style.background = color;
    row.append(key, el('strong', '', value));
    if (label) row.append(el('span', 'tip-label', label));
    return row;
  }

  function onReveal(target, callback) {
    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      callback();
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      callback();
      observer.disconnect();
    }, { threshold: 0.2 });
    observer.observe(target);
  }

  function hiddenTable(caption, head, rows) {
    // Tables ignore narrow widths, so the visually hidden wrapper does the clipping.
    const wrapper = el('div', 'results-chart-sr-only');
    const table = el('table');
    table.append(el('caption', '', caption));
    const headRow = el('tr');
    head.forEach(label => headRow.append(el('th', '', label)));
    table.append(headRow);
    rows.forEach(cells => {
      const row = el('tr');
      cells.forEach((cell, i) => row.append(el(i === 0 ? 'th' : 'td', '', cell)));
      table.append(row);
    });
    wrapper.append(table);
    return wrapper;
  }

  /* ---------- Benchmarks: one radar per benchmark ---------- */
  function mountRadarGroup(root) {
    const legend = el('ul', 'chart-legend');
    legend.setAttribute('aria-label', 'Models');
    const grid = el('div', 'radar-grid');
    const note = el('p', 'chart-foot', 'Each axis is min–max normalized across the models in its chart, so the outer ring marks the best score; ↓ and ↑ show whether lower or higher raw values are better. Hover a point to read its value. Generation-only references (GPT-4o, SD3-medium, FLUX.1-dev) are left out.');
    root.replaceChildren(legend, grid, note);

    const charts = [];
    const legendItems = MODELS.map(model => {
      const item = el('li', model.ours ? 'is-ours' : '');
      item.tabIndex = 0;
      item.dataset.id = model.id;
      const key = el('span', 'legend-line');
      key.style.setProperty('--c', model.color);
      item.append(key, el('span', '', model.name));
      item.addEventListener('pointerenter', () => focus(model.id));
      item.addEventListener('pointerleave', () => focus(null));
      item.addEventListener('focus', () => focus(model.id));
      item.addEventListener('blur', () => focus(null));
      legend.append(item);
      return item;
    });
    function focus(id) {
      charts.forEach(chart => chart.focus(id));
      legendItems.forEach(item => item.classList.toggle('is-dim', Boolean(id) && item.dataset.id !== id));
    }
    BENCHMARKS.forEach(bench => charts.push(createRadar(grid, bench, focus)));
    document.addEventListener('pointerdown', event => {
      if (!root.contains(event.target)) focus(null);
    });
    onReveal(grid, () => charts.forEach(chart => chart.reveal()));
  }

  function createRadar(grid, bench, focusAll) {
    const axes = bench.axes.map(([label, dir, digits]) => ({ label, dir, digits }));
    const card = el('figure', 'radar-card');
    const caption = el('figcaption', 'radar-title');
    const heading = el('span', 'radar-heading');
    heading.append(el('strong', '', bench.title), el('span', 'radar-task', bench.task));
    caption.append(heading, el('span', 'radar-sub', bench.sub));
    const plot = el('div', 'radar-plot');
    const tip = createTip(plot);
    const models = MODELS.filter(model => bench.values[model.id]);
    card.append(caption, plot, hiddenTable(
      bench.title,
      ['Model', ...axes.map(axis => `${axis.label} ${arrow(axis.dir)}`)],
      models.map(model => [model.name, ...bench.values[model.id].map((value, i) => value.toFixed(axes[i].digits))])
    ));
    grid.append(card);

    // Min–max per axis within this benchmark; the worst model sits on the inner floor ring.
    const floor = 0.18;
    const radii = {};
    models.forEach(model => { radii[model.id] = []; });
    axes.forEach((axis, i) => {
      const column = models.map(model => bench.values[model.id][i]);
      const low = Math.min(...column);
      const high = Math.max(...column);
      models.forEach(model => {
        const value = bench.values[model.id][i];
        const t = high === low ? 1 : axis.dir === 'down' ? (high - value) / (high - low) : (value - low) / (high - low);
        radii[model.id].push(floor + (1 - floor) * t);
      });
    });

    let focused = null;
    let drawnWidth = 0;
    function setFocus(id) {
      focused = id;
      if (id) plot.dataset.focus = id; else delete plot.dataset.focus;
      plot.querySelectorAll('.radar-series').forEach(group => group.classList.toggle('is-focus', group.dataset.id === id));
      if (!id) tip.classList.remove('is-visible');
    }

    function draw() {
      const available = Math.round(plot.clientWidth);
      if (!available || available === drawnWidth) return;
      drawnWidth = available;
      const W = Math.min(available, 440);
      const compact = W < 380;
      const n = axes.length;
      const R = Math.max(62, Math.min(128, W / 2 - (compact ? 62 : 92)));
      const pad = compact ? 30 : 34;
      const H = Math.round(2 * R + 2 * pad);
      const cx = W / 2;
      const cy = H / 2;
      const angle = i => -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const point = (i, r) => [cx + r * R * Math.cos(angle(i)), cy + r * R * Math.sin(angle(i))];
      const fmt = pair => pair.map(v => v.toFixed(1)).join(',');

      const root = svg('svg', {
        class: 'radar-svg', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img',
        'aria-label': `${bench.title}: ${axes.map(axis => axis.label).join(', ')} for each model`
      });
      [0.25, 0.5, 0.75, 1].forEach(ring => {
        root.append(svg('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: (ring * R).toFixed(1), class: ring === 1 ? 'radar-ring is-outer' : 'radar-ring' }));
      });
      axes.forEach((axis, i) => {
        const [x, y] = point(i, 1);
        root.append(svg('line', { x1: cx, y1: cy, x2: x.toFixed(1), y2: y.toFixed(1), class: 'radar-spoke' }));
        const cos = Math.cos(angle(i));
        const sin = Math.sin(angle(i));
        const gap = compact ? 9 : 12;
        const lx = cx + (R + gap) * cos;
        const ly = cy + (R + gap) * sin;
        const anchor = Math.abs(cos) < 0.3 ? 'middle' : cos > 0 ? 'start' : 'end';
        const words = compact && axis.label.includes(' ') ? axis.label.split(' ') : [axis.label];
        const lineHeight = 13;
        const baseY = ly + (sin < -0.5 ? -2 - (words.length - 1) * lineHeight : sin > 0.5 ? 12 : 4 - ((words.length - 1) * lineHeight) / 2);
        const text = svg('text', { x: lx.toFixed(1), y: baseY.toFixed(1), 'text-anchor': anchor, class: 'radar-axis-label' });
        words.forEach((word, k) => {
          const span = svg('tspan', { x: lx.toFixed(1), dy: k === 0 ? 0 : lineHeight });
          span.textContent = word;
          text.append(span);
        });
        const dir = svg('tspan', { class: 'dir' });
        dir.textContent = ` ${arrow(axis.dir)}`;
        text.append(dir);
        root.append(text);
      });

      const order = [...models].sort((a, b) => Number(Boolean(a.ours)) - Number(Boolean(b.ours)));
      order.forEach((model, rank) => {
        const group = svg('g', { class: 'radar-series' });
        group.dataset.id = model.id;
        group.style.transformOrigin = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`;
        group.style.transitionDelay = `${rank * 55}ms`;
        if (focused === model.id) group.classList.add('is-focus');
        const points = radii[model.id].map((r, i) => point(i, r));
        group.append(svg('path', {
          d: `M${points.map(fmt).join('L')}Z`, class: 'radar-area',
          fill: model.color, 'fill-opacity': model.ours ? 0.1 : 0, stroke: model.color, 'stroke-width': 2
        }));
        points.forEach(([x, y]) => group.append(svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 4, fill: model.color, class: 'radar-dot' })));
        root.append(group);
      });
      order.forEach(model => radii[model.id].forEach((r, i) => {
        const [x, y] = point(i, r);
        const hit = svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 12, class: 'radar-hit' });
        const show = () => {
          focusAll(model.id);
          const axis = axes[i];
          const box = root.getBoundingClientRect();
          const host = plot.getBoundingClientRect();
          tip.replaceChildren(tipRow(model.color, bench.values[model.id][i].toFixed(axis.digits)), el('div', 'tip-name', model.name), el('div', 'tip-context', `${axis.label} ${arrow(axis.dir)}`));
          placeTip(tip, plot, box.left - host.left + x, box.top - host.top + y);
        };
        hit.addEventListener('pointerenter', show);
        hit.addEventListener('pointerdown', show);
        hit.addEventListener('pointerleave', () => focusAll(null));
        root.append(hit);
      }));

      plot.querySelector('svg')?.remove();
      plot.append(root);
    }

    draw();
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(plot);
    else window.addEventListener('resize', draw);
    return { focus: setFocus, reveal: () => plot.classList.add('is-revealed') };
  }

  /* ---------- Test-time cost: line chart with a snapping crosshair ---------- */
  function mountClock(root) {
    const legend = el('ul', 'chart-legend');
    legend.setAttribute('aria-label', 'Methods');
    CLOCK.series.forEach(series => {
      const item = el('li', series.ours ? 'is-ours' : '');
      const key = el('span', 'legend-line');
      key.style.setProperty('--c', series.color);
      item.append(key, el('span', '', series.name));
      legend.append(item);
    });
    const plot = el('div', 'line-plot');
    const tip = createTip(plot);
    root.replaceChildren(legend, plot, hiddenTable(
      'Seconds per sample on one NVIDIA A100 (batch size 1)',
      ['Method', ...CLOCK.x.map(x => `N or L = ${x}`)],
      CLOCK.series.map(series => [series.name, ...series.values.map(v => `${v.toFixed(1)} s`)])
    ));

    let drawnWidth = 0;
    function draw() {
      const W = Math.round(plot.clientWidth);
      if (!W || W === drawnWidth) return;
      drawnWidth = W;
      const compact = W < 520;
      const H = compact ? 250 : 290;
      const m = { top: 14, right: compact ? 64 : 132, bottom: 44, left: 48 };
      const iw = W - m.left - m.right;
      const ih = H - m.top - m.bottom;
      const xMin = 1;
      const xMax = 10;
      const yMax = 500;
      const sx = x => m.left + ((x - xMin) / (xMax - xMin)) * iw;
      const sy = y => m.top + ih - (y / yMax) * ih;
      const root = svg('svg', { class: 'line-svg', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': 'Seconds per sample as the test-time budget grows: best-of-N rises linearly, LARC stays nearly flat' });
      [0, 100, 200, 300, 400, 500].forEach(tick => {
        root.append(svg('line', { x1: m.left, x2: W - m.right, y1: sy(tick).toFixed(1), y2: sy(tick).toFixed(1), class: tick === 0 ? 'line-baseline' : 'line-grid' }));
        const label = svg('text', { x: m.left - 8, y: (sy(tick) + 4).toFixed(1), 'text-anchor': 'end', class: 'line-tick' });
        label.textContent = tick;
        root.append(label);
      });
      CLOCK.x.forEach(x => {
        const label = svg('text', { x: sx(x).toFixed(1), y: H - m.bottom + 18, 'text-anchor': 'middle', class: 'line-tick' });
        label.textContent = x;
        root.append(label);
      });
      const xTitle = svg('text', { x: (m.left + iw / 2).toFixed(1), y: H - 6, 'text-anchor': 'middle', class: 'line-axis-title' });
      xTitle.textContent = 'Test-time budget (N sampled images or L latent steps)';
      root.append(xTitle);
      const yTitle = svg('text', { x: 12, y: (m.top + ih / 2).toFixed(1), 'text-anchor': 'middle', class: 'line-axis-title', transform: `rotate(-90 12 ${(m.top + ih / 2).toFixed(1)})` });
      yTitle.textContent = 'Seconds per sample';
      root.append(yTitle);

      const cross = svg('line', { x1: 0, x2: 0, y1: m.top, y2: m.top + ih, class: 'line-cross' });
      root.append(cross);
      CLOCK.series.forEach(series => {
        const pts = CLOCK.x.map((x, i) => [sx(x), sy(series.values[i])]);
        root.append(svg('path', { d: `M${pts.map(p => p.map(v => v.toFixed(1)).join(',')).join('L')}`, class: 'line-path', stroke: series.color }));
        pts.forEach(([x, y]) => root.append(svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 4, fill: series.color, class: 'line-dot' })));
        const last = pts[pts.length - 1];
        const end = svg('text', { x: (last[0] + 10).toFixed(1), y: (last[1] + 4).toFixed(1), class: 'line-end' });
        end.textContent = compact ? `${series.values[series.values.length - 1].toFixed(1)} s` : `${series.ours ? 'LARC' : 'Best-of-N'} ${series.values[series.values.length - 1].toFixed(1)} s`;
        root.append(end);
      });

      const overlay = svg('rect', { x: m.left, y: m.top, width: iw, height: ih, class: 'line-overlay' });
      const show = event => {
        const box = root.getBoundingClientRect();
        const px = ((event.clientX - box.left) / box.width) * W;
        let best = 0;
        CLOCK.x.forEach((x, i) => { if (Math.abs(sx(x) - px) < Math.abs(sx(CLOCK.x[best]) - px)) best = i; });
        const x = sx(CLOCK.x[best]);
        cross.setAttribute('x1', x.toFixed(1));
        cross.setAttribute('x2', x.toFixed(1));
        cross.classList.add('is-visible');
        tip.replaceChildren(
          el('div', 'tip-context', `N = L = ${CLOCK.x[best]}`),
          ...CLOCK.series.map(series => tipRow(series.color, `${series.values[best].toFixed(1)} s`, series.name))
        );
        const host = plot.getBoundingClientRect();
        placeTip(tip, plot, box.left - host.left + (x / W) * box.width, box.top - host.top + (m.top / H) * box.height + 10);
      };
      overlay.addEventListener('pointermove', show);
      overlay.addEventListener('pointerdown', show);
      overlay.addEventListener('pointerleave', () => { cross.classList.remove('is-visible'); tip.classList.remove('is-visible'); });
      root.append(overlay);

      plot.querySelector('svg')?.remove();
      plot.append(root);
    }
    draw();
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(plot);
    else window.addEventListener('resize', draw);
  }

  document.querySelectorAll('[data-radar-group]').forEach(mountRadarGroup);
  document.querySelectorAll('[data-clock-chart]').forEach(mountClock);
})();
