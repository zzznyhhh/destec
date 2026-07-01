/**
 * DESTEC — Main JavaScript
 */

document.addEventListener('DOMContentLoaded', async () => {

  /* ============================================================
     GLOBAL (Navbar, Mobile Menu)
     ============================================================ */
  const navbar = document.getElementById('navbar');
  const navHamburger = document.getElementById('navHamburger');
  const navLinks = document.getElementById('navLinks');

  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 20);
    });
  }

  if (navHamburger && navLinks) {
    navHamburger.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      navHamburger.classList.toggle('active');
    });
  }

  /* ============================================================
     DASHBOARD
     ============================================================ */
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  }

  // Logout link in sidebar
  const sideLogout = document.getElementById('sideLogout');
  if (sideLogout && window.DestecAuth) {
    sideLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      await DestecAuth.signOut();
    });
  }

  /* ============================================================
     PAGES THAT NEED AUTH GUARD
     ============================================================ */
  const isDashboard = document.body.classList.contains('dashboard-page');
  const isGenerator = document.body.classList.contains('generator-page');

  if ((isDashboard || isGenerator) && window.DestecAuth) {
    try {
      const session = await DestecAuth.requireAuth();
      if (!session) return; // redirected to login.html

      // Load user profile & update UI
      try {
        const token = await DestecAuth.getAccessToken();
        const meRes = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (meRes.ok) {
          const me = await meRes.json();
          updateQuotaUI(me);
          if (isDashboard) renderDashboard(me);
        }
      } catch (e) {
        console.error('Failed to load profile:', e);
      }

      // Logout button in generator navbar
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.style.display = 'inline-flex';
        logoutBtn.addEventListener('click', () => DestecAuth.signOut());
      }
    } catch (e) {
      console.error('Auth initialization failed, UI will still function:', e);
      // Continue — tone/lang/pricing buttons must work regardless of auth state
    }
  }

  /* ============================================================
     QUOTA UI (navbar indicator)
     ============================================================ */
  function updateQuotaUI(me) {
    const quotaCount = document.getElementById('quotaCount');
    const quotaFillMini = document.getElementById('quotaFillMini');

    if (quotaCount) {
      if (me.quotaLimit === -1) {
        quotaCount.textContent = `${me.quotaUsed}/∞`;
      } else {
        quotaCount.textContent = `${me.quotaUsed}/${me.quotaLimit}`;
      }
    }
    if (quotaFillMini) {
      const pct = me.quotaLimit === -1 ? 20 : Math.min((me.quotaUsed / me.quotaLimit) * 100, 100);
      quotaFillMini.style.width = `${pct}%`;
    }
  }

  /* ============================================================
     DASHBOARD RENDER
     ============================================================ */
  function renderDashboard(me) {
    // Greeting
    const hour = new Date().getHours();
    const greetWord = hour < 12 ? 'pagi' : hour < 15 ? 'siang' : hour < 19 ? 'sore' : 'malam';
    const firstName = (me.fullName || 'Pengguna').split(' ')[0];
    const greetEl = document.getElementById('dashGreeting');
    if (greetEl) greetEl.textContent = `Selamat ${greetWord}, ${firstName}! 👋`;

    // Date
    const dateEl = document.getElementById('dashDate');
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    }

    // Stat cards
    const quotaLeft = me.quotaLimit === -1 ? '∞' : Math.max(0, me.quotaLimit - me.quotaUsed);
    setText('statQuotaUsed', me.quotaUsed);
    setText('statQuotaLeft', quotaLeft);
    setText('statTotal', me.totalGenerations ?? '—');

    const planLabels = { free: 'Freemium', basic: 'Basic', pro: 'Pro' };
    setText('statPlan', planLabels[me.plan] || me.plan);

    const trendEl = document.getElementById('statQuotaTrend');
    if (trendEl) {
      if (me.quotaLimit !== -1 && me.quotaUsed >= me.quotaLimit) {
        trendEl.textContent = '⚠ Habis';
        trendEl.className = 'stat-card-trend trend--warn';
      } else if (me.quotaLimit !== -1 && (me.quotaLimit - me.quotaUsed) <= 2) {
        trendEl.textContent = '⚠ Hampir habis';
        trendEl.className = 'stat-card-trend trend--warn';
      } else {
        trendEl.textContent = 'Masih tersedia';
        trendEl.className = 'stat-card-trend trend--up';
      }
    }

    const expiryEl = document.getElementById('statPlanExpiry');
    if (expiryEl) {
      if (me.planExpiresAt) {
        const exp = new Date(me.planExpiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        expiryEl.textContent = `Aktif hingga ${exp}`;
        expiryEl.className = 'stat-card-trend trend--up';
      } else {
        expiryEl.textContent = me.plan === 'free' ? 'Selamanya gratis' : '';
        expiryEl.className = 'stat-card-trend trend--up';
      }
    }

    // Sidebar user info
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = me.fullName || 'Pengguna';
    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl) {
      const initials = (me.fullName || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
      avatarEl.textContent = initials;
    }

    // Plan badge
    const planBadgeEl = document.getElementById('userPlanBadge');
    if (planBadgeEl) {
      planBadgeEl.textContent = planLabels[me.plan] || me.plan;
      planBadgeEl.className = `user-plan plan-badge--${me.plan}`;
    }

    // Quota card
    const quotaUsedNum = document.getElementById('quotaUsedNum');
    const quotaTotalNum = document.getElementById('quotaTotalNum');
    const quotaProgressFill = document.getElementById('quotaProgressFill');
    const quotaResetInfo = document.getElementById('quotaResetInfo');
    const quotaWarning = document.getElementById('quotaWarning');
    const quotaWarningText = document.getElementById('quotaWarningText');
    const quotaPlanBadge = document.getElementById('quotaPlanBadge');

    if (quotaUsedNum) quotaUsedNum.textContent = me.quotaUsed;
    if (quotaTotalNum) quotaTotalNum.textContent = me.quotaLimit === -1 ? '∞' : me.quotaLimit;
    if (quotaProgressFill) {
      const pct = me.quotaLimit === -1 ? 20 : Math.min((me.quotaUsed / me.quotaLimit) * 100, 100);
      quotaProgressFill.style.width = `${pct}%`;
    }
    if (quotaResetInfo && me.quotaReset) {
      const resetDate = new Date(me.quotaReset).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      quotaResetInfo.textContent = `Reset pada ${resetDate}`;
    }
    if (quotaPlanBadge) {
      quotaPlanBadge.textContent = planLabels[me.plan] || me.plan;
      quotaPlanBadge.className = `plan-badge plan-badge--${me.plan}`;
    }
    if (quotaWarning && quotaWarningText) {
      if (me.quotaLimit !== -1 && me.quotaUsed >= me.quotaLimit) {
        quotaWarningText.textContent = 'Kuota habis! Upgrade paket untuk terus generate.';
        quotaWarning.style.display = 'flex';
      } else if (me.quotaLimit !== -1 && (me.quotaLimit - me.quotaUsed) <= 2) {
        const left = me.quotaLimit - me.quotaUsed;
        quotaWarningText.textContent = `Kuota tersisa ${left}. Upgrade untuk generate lebih banyak!`;
        quotaWarning.style.display = 'flex';
      }
    }

    // Load history table
    loadDashboardHistory();
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  async function loadDashboardHistory() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    try {
      const token = await DestecAuth.getAccessToken();
      const res = await fetch('/api/history?limit=10', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed');
      const rows = await res.json();

      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">Belum ada riwayat generate. <a href="generator.html" style="color:var(--mint)">Mulai generate →</a></td></tr>`;
        return;
      }

      const toneLabel = { casual: 'Santai', formal: 'Formal', persuasive: 'Persuasif' };
      const toneClass = { casual: 'tone-pill--casual', formal: 'tone-pill--formal', persuasive: 'tone-pill--persuasive' };
      const langFlag = { id: '🇮🇩', en: '🇺🇸', zh: '🇨🇳' };

      tbody.innerHTML = rows.map(r => {
        const date = new Date(r.createdAt);
        const now = new Date();
        const diffDays = Math.floor((now - date) / 86400000);
        let dateStr;
        if (diffDays === 0) dateStr = `Hari ini, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
        else if (diffDays === 1) dateStr = `Kemarin, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
        else dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

        const seoW = r.seoScore || 0;
        return `<tr>
          <td><span class="product-name-cell">${escHtml(r.productName || '—')}</span></td>
          <td><span class="tone-pill ${toneClass[r.tone] || ''}">${toneLabel[r.tone] || r.tone || '—'}</span></td>
          <td>${langFlag[r.language] || r.language || '—'}</td>
          <td><div class="seo-mini"><div class="seo-mini-bar" style="width:${seoW}%"></div><span>${seoW}</span></div></td>
          <td class="date-cell">${dateStr}</td>
          <td><div class="table-actions"><button class="tbl-btn" title="Salin" onclick="copyHistoryItem('${r.id}')">📋</button></div></td>
        </tr>`;
      }).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">Gagal memuat riwayat.</td></tr>`;
    }
  }

  window.copyHistoryItem = function(id) {
    // Placeholder — full detail fetch could be added
    alert('Fitur lihat detail akan segera hadir!');
  };

  function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ============================================================
     GENERATOR WORKSPACE
     ============================================================ */
  const generateBtn = document.getElementById('generateBtn');
  const outputEmpty = document.getElementById('outputEmpty');
  const outputLoading = document.getElementById('outputLoading');
  const outputContent = document.getElementById('outputContent');

  if (generateBtn) {
    const productName = document.getElementById('productName');
    const keyFeatures = document.getElementById('keyFeatures');
    const nameCount = document.getElementById('nameCount');
    const featuresCount = document.getElementById('featuresCount');

    // Character counters
    if (productName && nameCount) {
      productName.addEventListener('input', () => {
        nameCount.textContent = `${productName.value.length}/${productName.maxLength}`;
      });
    }
    if (keyFeatures && featuresCount) {
      keyFeatures.addEventListener('input', () => {
        featuresCount.textContent = `${keyFeatures.value.length}/${keyFeatures.maxLength}`;
      });
    }

    // Tone selection
    let selectedTone = 'casual';
    const toneBtns = document.querySelectorAll('.tone-btn');
    toneBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        toneBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedTone = btn.dataset.tone;
      });
    });

    // Language selection
    let selectedLang = 'id';
    const langBtns = document.querySelectorAll('.lang-btn');
    langBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        langBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedLang = btn.dataset.lang;
      });
    });

    // Photo upload
    const uploadArea = document.getElementById('uploadArea');
    const productImage = document.getElementById('productImage');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const uploadPreview = document.getElementById('uploadPreview');
    const imagePreview = document.getElementById('imagePreview');
    const removeImageBtn = document.getElementById('removeImageBtn');
    let compressedImageBase64 = null;

    if (uploadArea && productImage) {
      uploadArea.addEventListener('click', (e) => {
        if (e.target === removeImageBtn || removeImageBtn?.contains(e.target)) return;
        productImage.click();
      });

      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
      });
      uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handleImageFile(file);
      });

      productImage.addEventListener('change', () => {
        if (productImage.files[0]) handleImageFile(productImage.files[0]);
      });
    }

    if (removeImageBtn) {
      removeImageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        compressedImageBase64 = null;
        productImage.value = '';
        if (uploadPreview) uploadPreview.style.display = 'none';
        if (uploadPlaceholder) uploadPlaceholder.style.display = 'flex';
      });
    }

    function handleImageFile(file) {
      if (!file.type.startsWith('image/')) {
        alert('File harus berupa gambar (JPG, PNG, WEBP).');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('Ukuran gambar maksimal 10MB.');
        return;
      }
      compressImage(file, 1024, 0.8, (base64) => {
        compressedImageBase64 = base64;
        if (imagePreview) {
          imagePreview.src = `data:image/jpeg;base64,${base64}`;
        }
        if (uploadPlaceholder) uploadPlaceholder.style.display = 'none';
        if (uploadPreview) uploadPreview.style.display = 'flex';
      });
    }

    function compressImage(file, maxSide, quality, callback) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxSide || height > maxSide) {
            if (width > height) { height = Math.round((height / width) * maxSide); width = maxSide; }
            else { width = Math.round((width / height) * maxSide); height = maxSide; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          // Strip prefix: "data:image/jpeg;base64,"
          callback(dataUrl.split(',')[1]);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    // Load history strip
    loadHistoryStrip();

    // Regenerate button
    const regenerateBtn = document.getElementById('regenerateBtn');
    if (regenerateBtn) {
      regenerateBtn.addEventListener('click', () => generateBtn.click());
    }

    // Copy panel button
    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = document.getElementById('outputTextArea')?.textContent;
        if (text) navigator.clipboard.writeText(text);
      });
    }

    // Main generate handler
    generateBtn.addEventListener('click', async () => {
      if (!productName?.value.trim() || !keyFeatures?.value.trim()) {
        alert('Mohon isi Nama Produk dan Fitur Utama terlebih dahulu.');
        return;
      }

      // Auth check
      if (window.DestecAuth) {
        const session = await DestecAuth.getSession();
        if (!session) { window.location.href = '/login.html'; return; }
      }

      const lengthMap = { '1': 'short', '2': 'standard', '3': 'long' };
      const descLength = document.getElementById('descLength');
      const selectedLength = lengthMap[descLength?.value] || 'standard';
      const selectedCategory = document.getElementById('productCategory')?.value || '';
      const selectedAudience = document.getElementById('targetAudience')?.value || '';

      // UI: loading state
      generateBtn.classList.add('loading');
      generateBtn.disabled = true;
      if (outputEmpty) outputEmpty.style.display = 'none';
      if (outputContent) outputContent.style.display = 'none';
      if (outputLoading) outputLoading.style.display = 'flex';

      const phases = document.querySelectorAll('.phase');
      phases.forEach(p => p.classList.remove('active'));
      setTimeout(() => phases[0]?.classList.add('active'), 400);
      setTimeout(() => phases[1]?.classList.add('active'), 1500);
      setTimeout(() => phases[2]?.classList.add('active'), 2800);

      try {
        const token = window.DestecAuth ? await DestecAuth.getAccessToken() : null;
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/generate', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            productName: productName.value.trim(),
            category: selectedCategory,
            features: keyFeatures.value.trim(),
            targetAudience: selectedAudience,
            tone: selectedTone,
            length: selectedLength,
            language: selectedLang,
            imageBase64: compressedImageBase64 || undefined
          })
        });

        const data = await res.json();

        if (res.status === 403 && data.error === 'quota_exceeded') {
          if (outputLoading) outputLoading.style.display = 'none';
          if (outputEmpty) outputEmpty.style.display = 'flex';
          showQuotaExceededMsg();
          return;
        }

        if (res.status === 429) {
          alert('Terlalu banyak permintaan ke AI. Tunggu sebentar lalu coba lagi.');
          if (outputLoading) outputLoading.style.display = 'none';
          if (outputEmpty) outputEmpty.style.display = 'flex';
          return;
        }

        if (!res.ok) {
          alert(data.message || 'Terjadi kesalahan saat generate. Coba lagi.');
          if (outputLoading) outputLoading.style.display = 'none';
          if (outputEmpty) outputEmpty.style.display = 'flex';
          return;
        }

        // Success
        if (outputLoading) outputLoading.style.display = 'none';
        if (outputContent) outputContent.style.display = 'flex';

        const toneLabels = { casual: 'Santai', formal: 'Formal', persuasive: 'Persuasif' };
        const langFlags = { id: '🇮🇩 Indonesia', en: '🇺🇸 English', zh: '🇨🇳 中文' };
        const outputToneTag = document.getElementById('outputToneTag');
        const outputLangTag = document.getElementById('outputLangTag');
        if (outputToneTag) outputToneTag.textContent = toneLabels[selectedTone] || selectedTone;
        if (outputLangTag) outputLangTag.textContent = langFlags[selectedLang] || selectedLang;

        const outputTextArea = document.getElementById('outputTextArea');
        if (outputTextArea) outputTextArea.textContent = data.text;

        const outputWordCount = document.getElementById('outputWordCount');
        if (outputWordCount) outputWordCount.textContent = `${data.wordCount} kata`;

        // Animate SEO bar
        setTimeout(() => {
          const seoBarFill = document.getElementById('seoBarFill');
          const seoValue = document.getElementById('seoValue');
          if (seoBarFill) seoBarFill.style.width = `${data.seoScore}%`;
          if (seoValue) seoValue.textContent = data.seoScore;
        }, 300);

        // Enable action buttons
        ['regenerateBtn', 'copyBtn', 'saveBtn'].forEach(id => {
          const btn = document.getElementById(id);
          if (btn) btn.disabled = false;
        });

        // Update quota in navbar
        if (data.quotaLimit !== undefined) {
          updateQuotaUI({ quotaUsed: data.quotaUsed, quotaLimit: data.quotaLimit });
        }

        // Refresh history strip
        loadHistoryStrip();

      } catch (err) {
        console.error('Generate error:', err);
        alert('Gagal terhubung ke server. Periksa koneksi internetmu.');
        if (outputLoading) outputLoading.style.display = 'none';
        if (outputEmpty) outputEmpty.style.display = 'flex';
      } finally {
        generateBtn.classList.remove('loading');
        generateBtn.disabled = false;
      }
    });

    // Copy full button
    const copyFullBtn = document.getElementById('copyFullBtn');
    if (copyFullBtn) {
      copyFullBtn.addEventListener('click', () => {
        const text = document.getElementById('outputTextArea')?.textContent;
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyFullBtn.innerHTML;
          copyFullBtn.innerHTML = '✅ Berhasil Disalin!';
          setTimeout(() => { copyFullBtn.innerHTML = orig; }, 2000);
        });
      });
    }
  }

  function showQuotaExceededMsg() {
    const emptyText = document.querySelector('.output-empty-text');
    if (emptyText) {
      emptyText.innerHTML = '⚠️ <strong>Kuota habis!</strong><br/>Upgrade paket untuk terus generate deskripsi.';
    }
    // Add upgrade button
    const tips = document.querySelector('.output-empty-tips');
    if (tips) {
      tips.innerHTML = `<a href="pricing.html" class="btn btn-primary" style="margin-top:1rem">Lihat Paket Upgrade →</a>`;
    }
  }

  async function loadHistoryStrip() {
    const strip = document.getElementById('historyStripItems');
    if (!strip || !window.DestecAuth) return;
    try {
      const token = await DestecAuth.getAccessToken();
      if (!token) return;
      const res = await fetch('/api/history?limit=5', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const rows = await res.json();
      if (!rows.length) return;
      strip.innerHTML = rows.map(r =>
        `<div class="history-chip" title="${escHtml(r.productName || '')}">${escHtml((r.productName || '').slice(0, 30))}</div>`
      ).join('');
    } catch (e) { /* silent */ }
  }

  function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ============================================================
     PRICING — Toggle, FAQ, Midtrans Snap
     ============================================================ */
  const toggleSwitch = document.getElementById('toggleSwitch');
  if (toggleSwitch) {
    const labelMonthly = document.getElementById('labelMonthly');
    const labelYearly = document.getElementById('labelYearly');
    let isYearly = false;

    toggleSwitch.addEventListener('click', () => {
      isYearly = !isYearly;
      toggleSwitch.setAttribute('aria-checked', isYearly);
      labelMonthly.classList.toggle('active', !isYearly);
      labelYearly.classList.toggle('active', isYearly);

      document.querySelectorAll('.price-amount').forEach(el => {
        const raw = isYearly ? el.dataset.yearly : el.dataset.monthly;
        el.textContent = parseInt(raw).toLocaleString('id-ID');
      });
      const periodLabel = isYearly ? '/tahun' : '/bulan';
      document.querySelectorAll('.price-period').forEach(el => {
        // keep "/bulan, selamanya" for free plan unchanged
        if (!el.textContent.includes('selamanya')) el.textContent = periodLabel;
      });
    });

    // FAQ Accordion
    document.querySelectorAll('.faq-item').forEach(item => {
      const btn = item.querySelector('.faq-q');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(f => {
          f.classList.remove('open');
          f.querySelector('.faq-q')?.classList.remove('active');
        });
        if (!isOpen) {
          item.classList.add('open');
          btn.classList.add('active');
        }
      });
    });

    // Load Midtrans Snap script dynamically
    let snapLoaded = false;
    async function loadSnap() {
      if (snapLoaded) return;
      try {
        const cfgRes = await fetch('/api/config');
        const cfg = await cfgRes.json();
        const snapSrc = cfg.midtransIsProduction
          ? 'https://app.midtrans.com/snap/snap.js'
          : 'https://app.sandbox.midtrans.com/snap/snap.js';
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = snapSrc;
          s.setAttribute('data-client-key', cfg.midtransClientKey);
          s.onload = resolve;
          s.onerror = reject;
          document.body.appendChild(s);
        });
        snapLoaded = true;
      } catch (e) {
        console.error('Failed to load Snap:', e);
      }
    }

    // Hook upgrade buttons
    async function handleUpgradeClick(plan) {
      if (!window.DestecAuth) return;
      const session = await DestecAuth.getSession();
      if (!session) { window.location.href = '/login.html'; return; }

      const period = isYearly ? 'yearly' : 'monthly';
      const paymentAlert = document.getElementById('paymentAlert');

      try {
        await loadSnap();
        if (!window.snap) {
          alert('Payment gateway belum siap. Pastikan MIDTRANS_CLIENT_KEY sudah diisi.');
          return;
        }

        const token = await DestecAuth.getAccessToken();
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ plan, period })
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.message || 'Gagal membuat transaksi. Coba lagi.');
          return;
        }

        window.snap.pay(data.token, {
          onSuccess: async () => {
            if (paymentAlert) {
              paymentAlert.textContent = '✅ Pembayaran diterima! Paket sedang diaktifkan, harap tunggu sebentar...';
              paymentAlert.className = 'payment-alert payment-alert--success';
              paymentAlert.style.display = 'block';
            }
            // Poll /api/me until plan is upgraded (webhook may take a moment)
            let attempts = 0;
            const poll = setInterval(async () => {
              attempts++;
              try {
                const t = await DestecAuth.getAccessToken();
                const meRes = await fetch('/api/me', { headers: { Authorization: `Bearer ${t}` } });
                if (meRes.ok) {
                  const me = await meRes.json();
                  if (me.plan === plan || attempts >= 10) {
                    clearInterval(poll);
                    if (me.plan === plan && paymentAlert) {
                      paymentAlert.textContent = `✅ Paket ${plan.charAt(0).toUpperCase() + plan.slice(1)} berhasil diaktifkan! Selamat menikmati fitur lengkap DESTEC.`;
                    }
                  }
                }
              } catch (e) { clearInterval(poll); }
            }, 3000);
          },
          onPending: () => {
            if (paymentAlert) {
              paymentAlert.textContent = '⏳ Pembayaran pending. Paket akan aktif setelah pembayaran dikonfirmasi.';
              paymentAlert.className = 'payment-alert payment-alert--pending';
              paymentAlert.style.display = 'block';
            }
          },
          onError: () => {
            if (paymentAlert) {
              paymentAlert.textContent = '❌ Pembayaran gagal. Silakan coba lagi.';
              paymentAlert.className = 'payment-alert payment-alert--error';
              paymentAlert.style.display = 'block';
            }
          },
          onClose: () => {
            // User closed popup without paying — no action needed
          }
        });
      } catch (e) {
        console.error('Checkout error:', e);
        alert('Terjadi kesalahan. Coba lagi.');
      }
    }

    const ctaBasic = document.getElementById('ctaBasic');
    const ctaPro = document.getElementById('ctaPro');
    if (ctaBasic) ctaBasic.addEventListener('click', () => handleUpgradeClick('basic'));
    if (ctaPro) ctaPro.addEventListener('click', () => handleUpgradeClick('pro'));
  }

});
