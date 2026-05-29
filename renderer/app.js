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
  }

  // ===== 事件绑定 =====
  function bindEvents() {
    $('#prevMonth').addEventListener('click', () => { changeMonth(-1); });
    $('#nextMonth').addEventListener('click', () => { changeMonth(1); });
    $('#todayBtn').addEventListener('click', goToday);
    $('#searchBox').addEventListener('input', applySearchHighlight);
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
    await saveAndRefresh(dateStr);
  }

  // ===== 搜索 =====
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
