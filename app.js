/**
 * 2026年度营销中心即时激励公示 — 主逻辑
 * @file app.js
 */

/** @type {'sales' | 'management'} */
let activeDept = 'management';

/**
 * @param {'sales' | 'management'} dept
 * @param {string} monthLabel
 * @param {string} name
 * @returns {string}
 */
function employeeKey(dept, monthLabel, name) {
  return `${dept}|${monthLabel}|${name}`;
}

/**
 * 小皇冠 SVG（显示约 22×14px）
 * @returns {string}
 */
function crownSvg() {
  return `<svg class="crown-icon" viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fill="#d69e2e" d="M8 38 L12 18 L22 28 L32 8 L42 28 L52 18 L56 38 Z"/>
    <circle fill="#f6e05e" cx="12" cy="16" r="3"/>
    <circle fill="#f6e05e" cx="32" cy="6" r="3.5"/>
    <circle fill="#f6e05e" cx="52" cy="16" r="3"/>
    <rect fill="#b7791f" x="6" y="36" width="52" height="8" rx="2"/>
  </svg>`;
}

/**
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

/**
 * 事迹正文：先转义 HTML，再将 **文字** 转为加粗（仅在 config 中自行标记）
 * @param {string} s
 * @returns {string}
 */
function formatStoryText(s) {
  if (!s) return '';
  const safe = escapeHtml(s);
  return safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/**
 * 关键词标签 HTML
 * @param {string} [keywords]
 * @returns {string}
 */
function keywordsHtml(keywords) {
  if (!keywords) return '';
  const tags = keywords.split(/[、,，·]/).map((t) => t.trim()).filter(Boolean);
  if (!tags.length) return '';
  return `<div class="keyword-tags">${tags
    .map((t) => `<span class="keyword-tag">${escapeHtml(t)}</span>`)
    .join('')}</div>`;
}

/**
 * 卡片正文下方关键词（与正文左对齐）
 * @param {string} [keywords]
 * @returns {string}
 */
function keywordsFooterHtml(keywords) {
  if (!keywords) return '';
  const tags = keywords.split(/[、,，·]/).map((t) => t.trim()).filter(Boolean);
  if (!tags.length) return '';
  return `<div class="card-keywords-footer">${tags
    .map((t) => `<span class="keyword-tag keyword-tag--footer">${escapeHtml(t)}</span>`)
    .join('')}</div>`;
}

/**
 * 卡片左上角斜角金奖章（卓越奖 / 优秀奖）
 * @param {{ award: string }} emp
 * @returns {string}
 */
function renderAwardRibbon(emp) {
  const isExcellence = emp.award === '卓越奖';
  const cls = isExcellence ? 'award-ribbon--excellence' : 'award-ribbon--merit';
  return `<span class="award-ribbon ${cls}" aria-label="${escapeHtml(emp.award)}">${escapeHtml(emp.award)}</span>`;
}

/**
 * 卡片右上角爱心按钮
 * @param {string} dataKey
 * @returns {string}
 */
function renderCardHeartBtn(dataKey) {
  return `<button type="button" class="card-heart-btn" data-heart-key="${escapeHtml(dataKey)}" aria-label="点赞" aria-pressed="false">
    <span class="card-heart-icon" aria-hidden="true">♡</span>
  </button>`;
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function getHeartLiked(key) {
  try {
    return localStorage.getItem('honor-heart:' + key) === '1';
  } catch {
    return false;
  }
}

/**
 * @param {string} key
 * @param {boolean} liked
 */
function setHeartLiked(key, liked) {
  try {
    if (liked) localStorage.setItem('honor-heart:' + key, '1');
    else localStorage.removeItem('honor-heart:' + key);
  } catch {
    /* 离线或隐私模式忽略 */
  }
}

/**
 * @param {HTMLButtonElement} btn
 */
function applyHeartBtnState(btn) {
  const key = btn.getAttribute('data-heart-key');
  if (!key) return;
  const loved = getHeartLiked(key);
  btn.classList.toggle('is-loved', loved);
  btn.setAttribute('aria-pressed', loved ? 'true' : 'false');
  const icon = btn.querySelector('.card-heart-icon');
  if (icon) icon.textContent = loved ? '♥' : '♡';
}

/**
 * 荣誉卡外壳：上基础信息、下表彰词
 * @param {string} dataKey
 * @param {boolean} isExcellence
 * @param {{ award: string, keywords?: string }} emp
 * @param {string} identityHtml
 * @param {string} storiesHtml
 * @returns {string}
 */
function renderHonorCardShell(dataKey, isExcellence, emp, identityHtml, storiesHtml) {
  return `
    <article class="honor-card ${isExcellence ? 'is-excellence' : ''}" data-key="${dataKey}">
      ${renderAwardRibbon(emp)}
      ${renderCardHeartBtn(dataKey)}
      <div class="card-top">
        <div class="card-identity">${identityHtml}</div>
      </div>
      <div class="card-body">
        <div class="card-story-panel">
          ${storiesHtml}
          ${keywordsFooterHtml(emp.keywords)}
        </div>
      </div>
    </article>`;
}

/**
 * 解析「YYYY年M月」为可排序数值
 * @param {string} label
 * @returns {number}
 */
function parseMonthLabel(label) {
  const m = label.match(/(\d{4})年(\d{1,2})月/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 100 + parseInt(m[2], 10);
}

/**
 * 合并两部门月份列表，按时间从近到远排序（5月 → 4月 → 3月）
 * @returns {{ label: string, sales: import('./config.js').SalesEmployee[], management: import('./config.js').ManagementEmployee[] }[]}
 */
function mergeMonthTimeline() {
  const order = [];
  const map = new Map();

  INCENTIVE_CONFIG.management.months.forEach((m) => {
    if (!map.has(m.label)) {
      map.set(m.label, { label: m.label, sales: [], management: [] });
      order.push(m.label);
    }
    map.get(m.label).management = m.employees;
  });

  INCENTIVE_CONFIG.sales.months.forEach((m) => {
    if (!map.has(m.label)) {
      map.set(m.label, { label: m.label, sales: [], management: [] });
      order.push(m.label);
    }
    map.get(m.label).sales = m.employees;
  });

  return order
    .sort((a, b) => parseMonthLabel(b) - parseMonthLabel(a))
    .map((label) => map.get(label));
}

/**
 * @param {import('./config.js').SalesEmployee} emp
 * @returns {import('./config.js').StoryItem[]}
 */
function normalizeSalesStories(emp) {
  if (emp.stories && emp.stories.length) return emp.stories;
  if (emp.story) return [{ title: '', text: emp.story }];
  return [{ title: '', text: '' }];
}

/**
 * 头像区域 HTML（单人）
 * @param {string} key
 * @param {boolean} isExcellence
 * @param {string} [photo]
 * @param {boolean} [compact] - 同奖多人时缩小头像
 * @returns {string}
 */
function avatarBlockHtml(key, isExcellence, photo, compact) {
  const crown = isExcellence ? crownSvg() : '';
  const inner = photo
    ? `<img class="avatar-img" src="${photo}" alt=""/>`
    : '<span class="avatar-empty" aria-hidden="true"></span>';
  const duoClass = compact ? ' avatar-duo' : '';
  const crownClass = isExcellence ? ' has-crown' : '';
  return `
    <div class="avatar-wrap has-avatar-glow${crownClass}">
      ${crown}
      <div class="avatar-uploader${duoClass}" data-key="${key}">${inner}</div>
      <div class="avatar-glow" aria-hidden="true">
        <span class="avatar-glow-wave"></span>
        <span class="avatar-glow-wave avatar-glow-wave--delay"></span>
      </div>
    </div>`;
}

/**
 * @param {'sales' | 'management'} dept
 * @param {string} monthLabel
 * @param {{ name: string, award: string, photo?: string }} emp
 * @returns {string}
 */
function avatarSectionHtml(dept, monthLabel, emp) {
  const key = employeeKey(dept, monthLabel, emp.name);
  return avatarBlockHtml(key, emp.award === '卓越奖', emp.photo, false);
}

/**
 * 管理部事迹 HTML
 * @param {import('./config.js').ManagementEmployee} emp
 * @returns {string}
 */
function renderManagementStoriesHtml(emp) {
  return (emp.stories || [])
    .map((s) => {
      if (s.text) {
        let titleHtml = '';
        if (s.title) {
          titleHtml = `<div class="story-header">${escapeHtml(s.title)}</div>`;
        }
        return `
      <div class="story-block">
        ${titleHtml}
        <p class="story-text">${formatStoryText(s.text)}</p>
      </div>`;
      }
      return `
      <div class="story-block">
        <div class="story-header">${escapeHtml(s.title)}</div>
        <div class="sub-box">
          <div class="sub-label task">💡 关键事项</div>
          <p class="story-text">${formatStoryText(s.keyItems || '')}</p>
        </div>
        <div class="sub-box result">
          <div class="sub-label result">🏆 成果描述</div>
          <p class="story-text">${formatStoryText(s.achievements || '')}</p>
        </div>
      </div>`;
    })
    .join('');
}

/**
 * 管理部基础信息区（头像、姓名、部门；奖项与关键词在顶栏）
 * @param {import('./config.js').ManagementEmployee} emp
 * @param {string} monthLabel
 * @returns {string}
 */
function renderManagementIdentity(emp, monthLabel) {
  const isExcellence = emp.award === '卓越奖';
  const members = emp.members && emp.members.length >= 2 ? emp.members : null;

  if (members) {
    const heads = members
      .map(
        (m) => `
      <div class="co-recipient-item">
        ${avatarBlockHtml(employeeKey('management', monthLabel, m.name), isExcellence, m.photo, true)}
        <h3 class="user-name user-name--co">${escapeHtml(m.name)}</h3>
      </div>`
      )
      .join('');
    return `
      <div class="co-recipients-row">${heads}</div>
      <div class="user-dept">${escapeHtml(emp.role)}</div>`;
  }

  const key = employeeKey('management', monthLabel, emp.name);
  return `
      ${avatarBlockHtml(key, isExcellence, emp.photo, false)}
      <h3 class="user-name">${escapeHtml(emp.name)}</h3>
      <div class="user-dept">${escapeHtml(emp.role)}</div>`;
}

/**
 * 管理部表彰卡（与四月相同布局；同奖双人仅头像、姓名分开）
 * @param {import('./config.js').ManagementEmployee} emp
 * @param {string} monthLabel
 * @returns {string}
 */
function renderManagementSingleCard(emp, monthLabel) {
  const key = employeeKey('management', monthLabel, emp.name);
  const isExcellence = emp.award === '卓越奖';
  return renderHonorCardShell(
    key,
    isExcellence,
    emp,
    renderManagementIdentity(emp, monthLabel),
    renderManagementStoriesHtml(emp)
  );
}

/**
 * 行销部基础信息区（头像、姓名、部门；多人同奖共用一个头像与姓名框）
 * @param {import('./config.js').SalesEmployee} emp
 * @param {string} monthLabel
 * @returns {string}
 */
function renderSalesIdentity(emp, monthLabel) {
  const isExcellence = emp.award === '卓越奖';
  const key = employeeKey('sales', monthLabel, emp.name);
  const nameCls = emp.name.includes('、') ? 'user-name user-name--multi' : 'user-name';
  return `
      ${avatarBlockHtml(key, isExcellence, emp.photo, false)}
      <h3 class="${nameCls}">${escapeHtml(emp.name)}</h3>
      <div class="user-dept">${escapeHtml(emp.role)}</div>`;
}

/**
 * @param {import('./config.js').SalesEmployee} emp
 * @param {string} monthLabel
 * @returns {string}
 */
function renderSalesCard(emp, monthLabel) {
  const key = employeeKey('sales', monthLabel, emp.name);
  const isExcellence = emp.award === '卓越奖';
  const stories = normalizeSalesStories(emp);
  const storiesHtml = stories
    .map((s) => {
      const titleHtml = s.title
        ? `<div class="story-header">${escapeHtml(s.title)}</div>`
        : '';
      return `<div class="story-block">${titleHtml}<p class="story-text">${formatStoryText(s.text)}</p></div>`;
    })
    .join('');

  return renderHonorCardShell(key, isExcellence, emp, renderSalesIdentity(emp, monthLabel), storiesHtml);
}

/**
 * @param {import('./config.js').ManagementEmployee} emp
 * @param {string} monthLabel
 * @returns {string}
 */
function renderManagementCard(emp, monthLabel) {
  return renderManagementSingleCard(emp, monthLabel);
}

/**
 * 每行两张荣誉卡（2×N 网格）
 * @param {string[]} cardHtmlList
 * @returns {string}
 */
function layoutHonorCardGrid(cardHtmlList) {
  if (!cardHtmlList.length) return '';
  let rows = '';
  for (let i = 0; i < cardHtmlList.length; i += 2) {
    rows += `<div class="honor-card-row">${cardHtmlList.slice(i, i + 2).join('')}</div>`;
  }
  return `<div class="honor-card-grid">${rows}</div>`;
}

/**
 * 部门激励目的与标准说明（透明卡片）
 * @param {'sales' | 'management'} dept
 * @returns {string}
 */
function renderDeptIntro(dept) {
  const deptData =
    dept === 'sales' ? INCENTIVE_CONFIG.sales : INCENTIVE_CONFIG.management;
  const intro = deptData.intro;
  if (!intro) return '';

  const standardsHtml = intro.standards
    .map(
      (item) => `
      <div class="dept-intro-standard-box">
        <span class="dept-intro-standard-icon" aria-hidden="true">${escapeHtml(item.icon || '★')}</span>
        <div class="dept-intro-standard-label">${escapeHtml(item.label)}</div>
        <p class="dept-intro-standard-text">${formatStoryText(item.text)}</p>
      </div>`
    )
    .join('');

  const gridMod =
    intro.standards.length >= 5 ? '5' : intro.standards.length >= 3 ? '3' : '';

  return `
    <section class="dept-intro-floor" aria-label="${escapeHtml(deptData.label)}激励说明">
      <div class="section-title">${escapeHtml(deptData.label)}</div>
      <div class="dept-intro-panel">
        <h3 class="dept-intro-heading">激励目的</h3>
        <p class="dept-intro-purpose">${escapeHtml(intro.purpose)}</p>
        <h3 class="dept-intro-heading">即时激励标准</h3>
        <div class="dept-intro-standards-grid dept-intro-standards-grid--${gridMod}">
          ${standardsHtml}
        </div>
      </div>
    </section>`;
}

/**
 * 瀑布流渲染（按当前 Tab 过滤部门）
 */
function renderWaterfall() {
  const root = document.getElementById('blocks-root');
  if (!root) return;

  const html = mergeMonthTimeline()
    .map((month) => {
      const employees =
        activeDept === 'sales' ? month.sales : month.management;

      if (!employees.length) {
        return `
        <section class="month-floor">
          <div class="month-banner">📅 ${escapeHtml(month.label)}</div>
          <div class="section-floor">
            <p class="empty-hint">本月公示内容待发布</p>
          </div>
        </section>`;
      }

      const cardList =
        activeDept === 'sales'
          ? employees.map((emp) =>
              renderSalesCard(/** @type {import('./config.js').SalesEmployee} */ (emp), month.label)
            )
          : employees.map((emp) =>
              renderManagementCard(
                /** @type {import('./config.js').ManagementEmployee} */ (emp),
                month.label
              )
            );

      const cards = layoutHonorCardGrid(cardList);

      return `
        <section class="month-floor">
          <div class="month-banner">📅 ${escapeHtml(month.label)}</div>
          <div class="section-floor">
            ${cards}
          </div>
        </section>`;
    })
    .filter(Boolean)
    .join('');

  const body = html || '<p class="empty-hint">暂无该月份公示数据</p>';
  root.innerHTML = renderDeptIntro(activeDept) + body + renderPolicyCta();
  bindCardHearts(root);
  bindPolicyButtons(root);
}

/**
 * 制度入口按钮文案
 * @param {'sales' | 'management'} dept
 * @returns {string}
 */
function policyCtaLabel(dept) {
  return dept === 'management'
    ? '点击查看2026年营销综合管理部·即时激励制度'
    : '点击查看2026年营销中心-行销部 · 即时激励制度';
}

/**
 * 部门底部制度入口
 * @returns {string}
 */
function renderPolicyCta() {
  return `
    <div class="policy-cta-wrap">
      <button type="button" class="policy-cta-btn" data-policy-dept="${activeDept}">
        ${escapeHtml(policyCtaLabel(activeDept))}
      </button>
    </div>`;
}

/**
 * @param {'sales' | 'management'} dept
 */
function openPolicyModal(dept) {
  const policy = DEPT_POLICIES[dept];
  const overlay = document.getElementById('policy-modal');
  const titleEl = document.getElementById('policy-modal-title');
  const bodyEl = document.getElementById('policy-modal-body');
  const attachEl = /** @type {HTMLAnchorElement} */ (document.getElementById('policy-attachment'));
  if (!policy || !overlay || !titleEl || !bodyEl) return;

  titleEl.textContent = policy.title;
  bodyEl.innerHTML = policy.html;

  if (attachEl && policy.attachmentUrl) {
    attachEl.href = policy.attachmentUrl;
    attachEl.textContent = policy.attachmentLabel || '下载附件';
    attachEl.hidden = false;
  } else if (attachEl) {
    attachEl.hidden = true;
  }

  overlay.hidden = false;
  document.body.classList.add('policy-modal-open');
  document.body.style.overflow = 'hidden';
}

/** 关闭制度弹窗 */
function closePolicyModal() {
  const overlay = document.getElementById('policy-modal');
  if (overlay) overlay.hidden = true;
  document.body.classList.remove('policy-modal-open');
  document.body.style.overflow = '';
}

/**
 * @param {HTMLElement} root
 */
function bindPolicyButtons(root) {
  root.querySelectorAll('.policy-cta-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dept = /** @type {'sales' | 'management'} */ (btn.getAttribute('data-policy-dept'));
      openPolicyModal(dept);
    });
  });
}

/** 初始化弹窗交互 */
function initPolicyModal() {
  const overlay = document.getElementById('policy-modal');
  if (!overlay) return;

  overlay.querySelector('.modal-close')?.addEventListener('click', closePolicyModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePolicyModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closePolicyModal();
  });
}

/**
 * 卡片右上角爱心点赞（本机 localStorage 记录）
 * @param {HTMLElement} root
 */
function bindCardHearts(root) {
  root.querySelectorAll('.card-heart-btn').forEach((btn) => {
    applyHeartBtnState(/** @type {HTMLButtonElement} */ (btn));
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.getAttribute('data-heart-key');
      if (!key) return;
      setHeartLiked(key, !getHeartLiked(key));
      applyHeartBtnState(/** @type {HTMLButtonElement} */ (btn));
    });
  });
}

/**
 * 行销部 Tab 时显示右侧竖排文化词
 * @param {'sales' | 'management'} dept
 */
function updateCultureSideRail(dept) {
  const isSales = dept === 'sales';
  document.body.classList.toggle('dept-sales-active', isSales);
  const rail = document.getElementById('culture-side-rail');
  if (!rail) return;
  if (isSales) {
    rail.removeAttribute('hidden');
    rail.setAttribute('aria-hidden', 'false');
  } else {
    rail.setAttribute('hidden', '');
    rail.setAttribute('aria-hidden', 'true');
  }
}

/**
 * @param {'sales' | 'management'} dept
 */
function switchTab(dept) {
  activeDept = dept;
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-dept') === dept);
  });
  updateCultureSideRail(dept);
  renderWaterfall();
}

/**
 * 获取内嵌 Logo 地址
 * @returns {string}
 */
function getLogoDataUri() {
  return typeof LOGO_DATA_URI !== 'undefined' ? LOGO_DATA_URI : 'assets/logo-anheng.png';
}

/**
 * 将 Logo 应用到页面左上角
 */
function applyBrandLogo() {
  const img = document.querySelector('.brand-logo');
  if (img) img.src = getLogoDataUri();
}

/**
 * 初始化
 */
function init() {
  applyBrandLogo();

  const titleEl = document.getElementById('banner-title');
  if (titleEl) titleEl.textContent = INCENTIVE_CONFIG.title;

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTab(/** @type {'sales' | 'management'} */ (btn.getAttribute('data-dept')));
    });
  });

  initPolicyModal();
  switchTab('management');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
