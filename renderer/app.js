(() => {
  let flightsData = {};
  let currentYear, currentMonth;
  let selectedDate = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ===== 初始化 =====
  async function init() {
    flightsData = await window.api.readFlights();
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
    renderCalendar();
    bindEvents();

    // Electron 模式下从 Supabase 同步；Web 模式已直接用 Supabase 作为数据源
    if (!window.__WEB_MODE__) syncFromCloud();
  }

  async function syncFromCloud() {
    console.log('[Sync] 尝试从 Supabase 拉取数据...');
    const cloudData = await SupabaseService.fetchFlights();
    if (cloudData) {
      console.log('[Sync] 云端数据拉取成功:', cloudData);
      flightsData = cloudData;
      await window.api.saveFlights(flightsData);
      renderCalendar();
      if (selectedDate) openDetail(selectedDate);
    } else {
      console.log('[Sync] 云端无数据或拉取失败，使用本地数据');
    }
  }

  // ===== 事件绑定 =====
  function bindEvents() {
    $('#prevMonth').addEventListener('click', () => { changeMonth(-1); });
    $('#nextMonth').addEventListener('click', () => { changeMonth(1); });
    $('#todayBtn').addEventListener('click', goToday);
    $('#searchBox').addEventListener('input', onSearchInput);
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrapper')) hideSearchResults();
    });
    $('#voiceBtn').addEventListener('click', toggleVoiceRecognition);
    $('#imgOcrBtn').addEventListener('click', () => $('#imageInput').click());
    $('#imageInput').addEventListener('change', onImageSelected);
    $('#smartCloseBtn').addEventListener('click', hideSmartPanel);
    $('#smartAddBtn').addEventListener('click', onSmartAdd);
    $('#closeDetail').addEventListener('click', closeDetail);
    $('#addFlightBtn').addEventListener('click', () => openModal(selectedDate));
    $('#cancelBtn').addEventListener('click', closeModal);
    $('#flightForm').addEventListener('submit', onSaveFlight);
    $('#modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
  }

  // ===== 月份切换 =====
  function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  }

  function goToday() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
    renderCalendar();
  }

  // ===== 渲染日历 =====
  function renderCalendar() {
    const title = `${currentYear}年${currentMonth + 1}月`;
    $('#monthTitle').textContent = title;

    const grid = $('#daysGrid');
    grid.innerHTML = '';

    const firstDay = new Date(currentYear, currentMonth, 1);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    let startWeekday = firstDay.getDay(); // 0=Sunday
    startWeekday = startWeekday === 0 ? 6 : startWeekday - 1; // 转为周一起始

    const today = new Date();
    const todayStr = formatDate(today);

    // 上月补位
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = currentMonth === 0 ? 12 : currentMonth;
      const y = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = formatYMD(y, m, d);
      grid.appendChild(createDayCell(d, dateStr, true));
    }

    // 当月
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatYMD(currentYear, currentMonth + 1, d);
      const cell = createDayCell(d, dateStr, false);
      if (dateStr === todayStr) cell.classList.add('today');
      grid.appendChild(cell);
    }

    // 下月补位
    const totalCells = startWeekday + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remaining; d++) {
      const m = currentMonth + 2 > 11 ? 1 : currentMonth + 2;
      const y = currentMonth + 2 > 11 ? currentYear + 1 : currentYear;
      const dateStr = formatYMD(y, m, d);
      grid.appendChild(createDayCell(d, dateStr, true));
    }

    // 搜索高亮
    applySearchHighlight();
  }

  function createDayCell(day, dateStr, isOtherMonth) {
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    cell.dataset.date = dateStr;
    if (isOtherMonth) cell.classList.add('other-month');

    const flights = flightsData[dateStr] || [];

    // 颜色状态
    if (flights.length === 0) {
      cell.classList.add('no-flight');
    } else {
      cell.classList.add(typeClass('has', flights.some(f => isTraining(f.flightNo)) ? '训练' : flights[0].flightNo));
    }

    // 日期号
    const num = document.createElement('div');
    num.className = 'day-number';
    num.textContent = day;
    cell.appendChild(num);

    // 航班摘要
    if (flights.length > 0) {
      const container = document.createElement('div');
      container.className = 'day-flights';
      const show = flights.slice(0, 3);
      show.forEach(f => {
        const chip = document.createElement('div');
        chip.className = 'flight-chip ' + typeClass('chip', f.flightNo);
        chip.textContent = f.flightNo || '(无航班号)';
        container.appendChild(chip);
      });
      if (flights.length > 3) {
        const more = document.createElement('div');
        more.className = 'flight-chip-more';
        more.textContent = `+${flights.length - 3} 更多`;
        container.appendChild(more);
      }
      cell.appendChild(container);
    }

    cell.addEventListener('click', () => openDetail(dateStr));
    return cell;
  }

  // ===== 判断训练 =====
  function isTraining(flightNo) {
    if (!flightNo) return false;
    return /训练|TRAINING/i.test(flightNo);
  }

  function typeClass(prefix, flightNo) {
    return `${prefix}-${isTraining(flightNo) ? 'training' : 'flight'}`;
  }

  // ===== 详情面板 =====
  function openDetail(dateStr) {
    selectedDate = dateStr;
    $$('.day-cell').forEach(c => c.classList.remove('selected'));
    const cell = $(`.day-cell[data-date="${dateStr}"]`);
    if (cell) cell.classList.add('selected');

    const panel = $('#detailPanel');
    panel.classList.remove('hidden');

    const [y, m, d] = dateStr.split('-');
    $('#detailDate').textContent = `${y}年${parseInt(m)}月${parseInt(d)}日`;

    renderFlightList(dateStr);
  }

  function closeDetail() {
    $('#detailPanel').classList.add('hidden');
    selectedDate = null;
    $$('.day-cell').forEach(c => c.classList.remove('selected'));
  }

  function renderFlightList(dateStr) {
    const container = $('#flightList');
    const flights = flightsData[dateStr] || [];

    if (flights.length === 0) {
      container.innerHTML = '<div class="empty-message">当日暂无航班安排</div>';
      return;
    }

    container.innerHTML = flights.map(f => {
      const cardClass = typeClass('card', f.flightNo);
      const label = f.flightNo || '(无航班号)';
      const route = (f.from || '-') + ' → ' + (f.to || '-');
      return `
        <div class="flight-card ${cardClass}" data-id="${f.id}">
          <div class="flight-card-actions">
            <button class="edit-btn" data-id="${f.id}">编辑</button>
            <button class="delete-btn" data-id="${f.id}">删除</button>
          </div>
          <div class="flight-card-no">${escHtml(label)}</div>
          <div class="flight-card-route">${escHtml(route)}</div>
          <div class="flight-card-crew">
            ${f.captain ? '机长：' + escHtml(f.captain) + '<br>' : ''}
            ${f.chiefAttendant ? '乘务长：' + escHtml(f.chiefAttendant) + '<br>' : ''}
            ${f.aircraftType ? '机型：' + escHtml(f.aircraftType) : ''}
            ${f.regNo ? '  注册号：' + escHtml(f.regNo) : ''}
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(dateStr, btn.dataset.id);
      });
    });

    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFlight(dateStr, btn.dataset.id);
      });
    });
  }

  // ===== 弹窗 CRUD =====
  async function saveAndRefresh(dateStr) {
    await window.api.saveFlights(flightsData);
    renderCalendar();
    if (selectedDate === dateStr) openDetail(dateStr);
    // Electron 模式下同步到 Supabase
    if (!window.__WEB_MODE__) {
      console.log('[Sync] 正在同步到 Supabase...');
      SupabaseService.upsertFlights(flightsData);
    }
  }

  function openModal(dateStr, flightId) {
    if (dateStr) selectedDate = dateStr;
    const modal = $('#modal');
    modal.classList.remove('hidden');
    $('#flightForm').reset();
    $('#flightId').value = '';

    if (flightId) {
      $('#modalTitle').textContent = '编辑航班';
      const flight = (flightsData[dateStr] || []).find(f => f.id === flightId);
      if (flight) {
        $('#flightId').value = flight.id;
        $('#flightNo').value = flight.flightNo || '';
        $('#from').value = flight.from || '';
        $('#to').value = flight.to || '';
        $('#captain').value = flight.captain || '';
        $('#chiefAttendant').value = flight.chiefAttendant || '';
        $('#aircraftType').value = flight.aircraftType || '';
        $('#regNo').value = flight.regNo || '';
      }
    } else {
      $('#modalTitle').textContent = '添加航班';
    }

    $('#flightNo').focus();
  }

  function closeModal() {
    $('#modal').classList.add('hidden');
  }

  async function onSaveFlight(e) {
    e.preventDefault();
    const dateStr = selectedDate;
    const id = $('#flightId').value || generateId();

    const flight = {
      id,
      flightNo: $('#flightNo').value.trim(),
      from: $('#from').value.trim(),
      to: $('#to').value.trim(),
      captain: $('#captain').value.trim(),
      chiefAttendant: $('#chiefAttendant').value.trim(),
      aircraftType: $('#aircraftType').value.trim(),
      regNo: $('#regNo').value.trim(),
    };

    if (!flightsData[dateStr]) flightsData[dateStr] = [];

    const idx = flightsData[dateStr].findIndex(f => f.id === id);
    if (idx >= 0) {
      flightsData[dateStr][idx] = flight;
    } else {
      flightsData[dateStr].push(flight);
    }

    closeModal();
    await saveAndRefresh(dateStr);
  }

  async function deleteFlight(dateStr, flightId) {
    if (!confirm('确定删除该航班？')) return;
    flightsData[dateStr] = (flightsData[dateStr] || []).filter(f => f.id !== flightId);
    if (flightsData[dateStr].length === 0) delete flightsData[dateStr];
    await window.api.saveFlights(flightsData);
    renderCalendar();
    if (selectedDate === dateStr) openDetail(dateStr);
    // Electron 模式下同步删除到 Supabase
    if (!window.__WEB_MODE__) {
      SupabaseService.deleteFlightById(flightId);
      SupabaseService.upsertFlights(flightsData);
    }
  }

  // ===== 搜索 =====
  function onSearchInput() {
    applySearchHighlight();
    performSearch();
  }

  function performSearch() {
    const query = $('#searchBox').value.trim().toLowerCase();
    const panel = $('#searchResults');

    if (!query) {
      hideSearchResults();
      return;
    }

    const results = [];
    for (const dateStr in flightsData) {
      flightsData[dateStr].forEach(f => {
        const fields = [f.flightNo, f.captain, f.chiefAttendant, f.from, f.to, f.aircraftType, f.regNo];
        if (fields.some(v => (v || '').toLowerCase().includes(query))) {
          results.push({ dateStr, flight: f });
        }
      });
    }

    results.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    if (results.length === 0) {
      panel.innerHTML = '<div class="search-empty">未找到匹配结果</div>';
    } else {
      panel.innerHTML = results.map(r => {
        const f = r.flight;
        const [y, m, d] = r.dateStr.split('-');
        const dateLabel = `${y}年${parseInt(m)}月${parseInt(d)}日`;
        const flightNo = escHtml(f.flightNo || '(无航班号)');
        const route = escHtml((f.from || '-') + ' → ' + (f.to || '-'));
        const crew = [f.captain, f.chiefAttendant].filter(Boolean).map(v => escHtml(v)).join(' / ');
        return `<div class="search-result-item" data-date="${r.dateStr}">
          <div class="search-result-date">${dateLabel}</div>
          <div class="search-result-main">
            <span class="search-result-flightno">${flightNo}</span>
            <span class="search-result-route">${route}</span>
          </div>
          ${crew ? `<div class="search-result-crew">${crew}</div>` : ''}
        </div>`;
      }).join('');

      panel.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const dateStr = item.dataset.date;
          hideSearchResults();
          const [y, m] = dateStr.split('-');
          currentYear = parseInt(y);
          currentMonth = parseInt(m) - 1;
          renderCalendar();
          openDetail(dateStr);
        });
      });
    }

    panel.classList.remove('hidden');
  }

  function hideSearchResults() {
    $('#searchResults').classList.add('hidden');
  }

  function applySearchHighlight() {
    const query = $('#searchBox').value.trim().toLowerCase();
    $$('.day-cell').forEach(cell => cell.classList.remove('search-match'));
    if (!query) return;

    $$('.day-cell').forEach(cell => {
      const dateStr = cell.dataset.date;
      const flights = flightsData[dateStr] || [];
      const match = flights.some(f =>
        (f.flightNo || '').toLowerCase().includes(query) ||
        (f.captain || '').toLowerCase().includes(query) ||
        (f.chiefAttendant || '').toLowerCase().includes(query) ||
        (f.from || '').toLowerCase().includes(query) ||
        (f.to || '').toLowerCase().includes(query) ||
        (f.aircraftType || '').toLowerCase().includes(query) ||
        (f.regNo || '').toLowerCase().includes(query)
      );
      if (match) cell.classList.add('search-match');
    });
  }

  // ===== 语音识别 =====
  let voiceRecognition = null;
  let isRecording = false;

  function toggleVoiceRecognition() {
    if (isRecording) {
      stopVoiceRecognition();
      return;
    }
    startVoiceRecognition();
  }

  function startVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('当前浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器。');
      return;
    }

    voiceRecognition = new SpeechRecognition();
    voiceRecognition.lang = 'zh-CN';
    voiceRecognition.interimResults = false;
    voiceRecognition.maxAlternatives = 1;

    voiceRecognition.onstart = () => {
      isRecording = true;
      $('#voiceBtn').classList.add('recording');
    };

    voiceRecognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      const parsed = parseFlightInfo(text);
      showSmartPanel('语音识别结果', text, parsed);
    };

    voiceRecognition.onerror = (event) => {
      console.error('语音识别错误:', event.error);
      if (event.error !== 'aborted') {
        alert('语音识别失败: ' + event.error);
      }
      stopVoiceRecognition();
    };

    voiceRecognition.onend = () => {
      stopVoiceRecognition();
    };

    voiceRecognition.start();
  }

  function stopVoiceRecognition() {
    isRecording = false;
    $('#voiceBtn').classList.remove('recording');
    if (voiceRecognition) {
      try { voiceRecognition.stop(); } catch (e) {}
      voiceRecognition = null;
    }
  }

  // ===== 图片OCR =====
  async function onImageSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    showSmartPanel('图片识别', '', null);
    $('#ocrProgress').classList.remove('hidden');
    $('#ocrProgressText').textContent = '0%';
    $('#ocrProgressFill').style.width = '0%';

    try {
      const { Tesseract } = window;
      if (!Tesseract) {
        alert('OCR组件未加载，请确保网络连接正常。');
        hideSmartPanel();
        return;
      }

      const result = await Tesseract.recognize(file, 'chi_sim+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text' && m.progress != null) {
            const pct = Math.round(m.progress * 100);
            $('#ocrProgressText').textContent = pct + '%';
            $('#ocrProgressFill').style.width = pct + '%';
          }
        }
      });

      const text = result.data.text.trim();
      const parsed = parseFlightInfo(text);
      $('#recognizedText').textContent = text;
      $('#ocrProgress').classList.add('hidden');
      fillSmartFields(parsed);
      $('#smartPanelTitle').textContent = '图片识别结果';
    } catch (err) {
      console.error('OCR错误:', err);
      alert('图片识别失败: ' + err.message);
      hideSmartPanel();
    }
  }

  // ===== 信息解析 =====
  function parseFlightInfo(text) {
    const result = {
      flightNo: '',
      date: '',
      from: '',
      to: '',
      captain: '',
      chiefAttendant: '',
      aircraftType: '',
      regNo: '',
    };

    // 航班号: CA1234, MU5129, CZ3456 等
    const flightMatch = text.match(/([A-Z]{2}\s*\d{3,4})/i);
    if (flightMatch) result.flightNo = flightMatch[1].replace(/\s/g, '').toUpperCase();

    // 训练
    if (/训练/.test(text) && !result.flightNo) result.flightNo = '训练';

    // 日期: 5月29日, 5月29, 2026-05-29, 05/29, 5/29
    const now = new Date();
    let dateMatch;
    if ((dateMatch = text.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/))) {
      result.date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    } else if ((dateMatch = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/))) {
      const year = now.getFullYear();
      result.date = `${year}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`;
    } else if ((dateMatch = text.match(/(\d{1,2})\s*号/))) {
      const month = now.getMonth() + 1;
      result.date = `${now.getFullYear()}-${String(month).padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
    }

    // 航线: XX到XX, XX→XX, XX-XX, XX至XX
    const routeMatch = text.match(/([一-龥]{2,6}(?:[一-龥]{2,4})?)\s*(?:到|至|→|-|—)\s*([一-龥]{2,6}(?:[一-龥]{2,4})?)/);
    if (routeMatch) {
      result.from = routeMatch[1];
      result.to = routeMatch[2];
    }

    // 机长: 机长XXX, CAPT:XXX, captain:XXX
    const captainMatch = text.match(/(?:机长|CAPT(?:AIN)?[:\s]*)\s*([一-龥]{2,4})/i);
    if (captainMatch) result.captain = captainMatch[1];

    // 乘务长: 乘务长XXX, chief:XXX
    const chiefMatch = text.match(/(?:乘务长|乘务组?长|CHIEF[:\s]*)\s*([一-龥]{2,4})/i);
    if (chiefMatch) result.chiefAttendant = chiefMatch[1];

    // 机型: A320, B737-800, A321neo, B787 等
    const aircraftMatch = text.match(/(A\d{3}[A-Za-z]*[-\s]?\d{0,3}|B\d{3}[-\s]?\d{0,3}[A-Za-z]*)/i);
    if (aircraftMatch) result.aircraftType = aircraftMatch[1].toUpperCase();

    // 注册号: B-XXXX (4位字母数字) 或 B-XXXX (5位)
    const regMatch = text.match(/(B-?[A-Z0-9]{4})/i);
    if (regMatch) result.regNo = regMatch[1].toUpperCase();

    return result;
  }

  // ===== 智能录入面板 =====
  function showSmartPanel(title, rawText, parsed) {
    $('#smartPanelTitle').textContent = title;
    $('#recognizedText').textContent = rawText;
    $('#ocrProgress').classList.add('hidden');
    if (parsed) fillSmartFields(parsed);
    $('#smartPanel').classList.remove('hidden');
  }

  function fillSmartFields(parsed) {
    $('#smartDate').value = parsed.date || '';
    $('#smartFlightNo').value = parsed.flightNo || '';
    $('#smartFrom').value = parsed.from || '';
    $('#smartTo').value = parsed.to || '';
    $('#smartCaptain').value = parsed.captain || '';
    $('#smartChiefAttendant').value = parsed.chiefAttendant || '';
    $('#smartAircraftType').value = parsed.aircraftType || '';
    $('#smartRegNo').value = parsed.regNo || '';
  }

  function hideSmartPanel() {
    $('#smartPanel').classList.add('hidden');
  }

  function onSmartAdd() {
    const dateStr = $('#smartDate').value;
    const flightNo = $('#smartFlightNo').value.trim();

    if (!dateStr) {
      alert('请选择日期');
      return;
    }

    if (!flightNo) {
      alert('请输入航班号');
      return;
    }

    // 关闭智能面板
    hideSmartPanel();

    // 切换到对应月份
    const [y, m] = dateStr.split('-');
    currentYear = parseInt(y);
    currentMonth = parseInt(m) - 1;
    renderCalendar();

    // 打开添加弹窗并预填
    selectedDate = dateStr;
    openModal(dateStr);
    $('#flightNo').value = flightNo;
    $('#from').value = $('#smartFrom').value;
    $('#to').value = $('#smartTo').value;
    $('#captain').value = $('#smartCaptain').value;
    $('#chiefAttendant').value = $('#smartChiefAttendant').value;
    $('#aircraftType').value = $('#smartAircraftType').value;
    $('#regNo').value = $('#smartRegNo').value;
  }

  // ===== 工具函数 =====
  function formatYMD(y, m, d) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function formatDate(date) {
    return formatYMD(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  init();
})();
