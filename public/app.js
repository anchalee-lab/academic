// Global Application State
const state = {
  activeTab: 'student',
  catalog: {
    students: [],
    teachers: [],
    rooms: []
  },
  stats: {},
  // Authentication for งานจัดตารางเรียน
  authToken: localStorage.getItem('yw_schedule_token') || null,
  authUser: null,
  // Filters
  studentFilter: {
    grade: 'all',
    program: 'all',
    search: ''
  },
  teacherFilter: {
    department: 'all',
    search: ''
  },
  roomFilter: {
    building: 'all',
    search: ''
  },
  adminFilter: {
    status: 'all',
    search: ''
  },
  currentModalItem: null,
  adminIssues: []
};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) {
    lucide.createIcons();
  }

  await Promise.all([
    loadCatalogAndStats(),
    checkAdminAuth()
  ]);

  initFormDatalists();
  renderAllViews();
  setupEventListeners();
  setupEventListeners();

  // Check URL params for direct link (e.g. ?tab=teacher&q=201 or ?track=YW69-1001)
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  const trackParam = urlParams.get('track');

  if (trackParam) {
    switchTab('track');
    document.getElementById('trackSearchInput').value = trackParam;
    searchTrackIssue();
  } else if (tabParam && ['student', 'teacher', 'room', 'report', 'track', 'admin'].includes(tabParam)) {
    switchTab(tabParam);
  }
});

// Setup event listeners
function setupEventListeners() {
  // ESC key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTimetableModal();
      closeAdminManageModal();
    }
  });
}

// Load Catalog & Stats from API
async function loadCatalogAndStats() {
  try {
    const [catalogRes, statsRes] = await Promise.all([
      fetch('/api/catalog').then(r => r.json()),
      fetch('/api/stats').then(r => r.json())
    ]);

    if (catalogRes.success) {
      state.catalog = catalogRes.data;
    }
    if (statsRes.success) {
      state.stats = statsRes.data;
      updateStatsUI(state.stats);
    }
  } catch (err) {
    console.error('Error loading data:', err);
  }
}

// Update Top & Hero Stats UI
function updateStatsUI(stats) {
  const headerQuick = document.getElementById('quickStatsHeader');
  if (headerQuick) {
    headerQuick.innerHTML = `
      <span class="inline-flex items-center gap-1"><i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-400"></i> ${stats.totalStudents || 102} ห้องเรียน</span>
      <span class="inline-flex items-center gap-1"><i data-lucide="users" class="w-3.5 h-3.5 text-amber-300"></i> ${stats.totalTeachers || 210} ครูผู้สอน</span>
      <span class="inline-flex items-center gap-1"><i data-lucide="building" class="w-3.5 h-3.5 text-blue-300"></i> ${stats.totalRooms || 138} ห้องเรียน</span>
    `;
    if (window.lucide) lucide.createIcons();
  }

  const sCount = document.getElementById('statStudentCount');
  const tCount = document.getElementById('statTeacherCount');
  const rCount = document.getElementById('statRoomCount');
  if (sCount) sCount.textContent = stats.totalStudents || 102;
  if (tCount) tCount.textContent = stats.totalTeachers || 210;
  if (rCount) rCount.textContent = stats.totalRooms || 138;
}

// Tab Switching
async function switchTab(tabName) {
  state.activeTab = tabName;

  // Update nav buttons
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.remove('active-tab', 'text-blue-900', 'bg-white', 'shadow-sm');
    if (!btn.id.includes('report')) {
      btn.classList.add('text-slate-600');
    }
  });

  const activeBtn = document.getElementById(`nav-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.add('active-tab');
    activeBtn.classList.remove('text-slate-600');
  }

  // Update Tab Contents
  document.querySelectorAll('.tab-content').forEach(section => {
    section.classList.add('hidden');
  });

  const targetSection = document.getElementById(`tab-${tabName}`);
  if (targetSection) {
    targetSection.classList.remove('hidden');
    targetSection.classList.add('animate-fade-in');
  }

  // Action based on tab
  if (tabName === 'admin') {
    await checkAdminAuth();
    if (state.authToken && state.authUser) {
      loadAdminIssues();
    }
  } else if (tabName === 'report') {
    updateTargetOptions();
  }

  // Scroll to top of content
  window.scrollTo({ top: 180, behavior: 'smooth' });

  if (window.lucide) lucide.createIcons();
}

// Authentication Check for งานจัดตารางเรียน
async function checkAdminAuth() {
  const loginView = document.getElementById('adminLoginView');
  const dashboardView = document.getElementById('adminDashboardView');
  const navAdminBtn = document.getElementById('nav-admin');

  if (!state.authToken) {
    if (loginView) loginView.classList.remove('hidden');
    if (dashboardView) dashboardView.classList.add('hidden');
    if (navAdminBtn) {
      navAdminBtn.innerHTML = `<i data-lucide="lock" class="w-4 h-4 text-purple-600"></i> <span>งานจัดตารางเรียน</span>`;
    }
    return false;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${state.authToken}` }
    });
    const data = await res.json();
    if (data.success && data.user) {
      state.authUser = data.user;
      if (loginView) loginView.classList.add('hidden');
      if (dashboardView) dashboardView.classList.remove('hidden');

      const nameEl = document.getElementById('adminUserDisplayName');
      const posEl = document.getElementById('adminUserDisplayPos');
      if (nameEl) nameEl.textContent = data.user.fullName;
      if (posEl) posEl.textContent = data.user.position || 'เจ้าหน้าที่งานจัดตารางเรียน';

      if (navAdminBtn) {
        navAdminBtn.innerHTML = `<i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i> <span>งานจัดตารางเรียน</span>`;
      }
      if (window.lucide) lucide.createIcons();
      return true;
    } else {
      // Invalid token
      localStorage.removeItem('yw_schedule_token');
      state.authToken = null;
      state.authUser = null;
      if (loginView) loginView.classList.remove('hidden');
      if (dashboardView) dashboardView.classList.add('hidden');
      if (navAdminBtn) {
        navAdminBtn.innerHTML = `<i data-lucide="lock" class="w-4 h-4 text-purple-600"></i> <span>งานจัดตารางเรียน</span>`;
      }
      return false;
    }
  } catch (err) {
    console.error('Auth verify error:', err);
    return false;
  }
}

// Handle Admin Login Submission
async function handleAdminLogin(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('adminLoginUsername');
  const passwordInput = document.getElementById('adminLoginPassword');
  const submitBtn = document.getElementById('adminLoginSubmitBtn');
  const errorAlert = document.getElementById('adminLoginError');
  const errorMsg = document.getElementById('adminLoginErrorMsg');

  errorAlert.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> กำลังตรวจสอบสิทธิ์...`;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameInput.value.trim(),
        password: passwordInput.value.trim()
      })
    });
    const data = await res.json();

    if (data.success && data.token) {
      state.authToken = data.token;
      state.authUser = data.user;
      localStorage.setItem('yw_schedule_token', data.token);

      // Reset form
      usernameInput.value = '';
      passwordInput.value = '';

      // Switch views
      await checkAdminAuth();
      await loadAdminIssues();
    } else {
      errorAlert.classList.remove('hidden');
      errorMsg.textContent = data.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
    }
  } catch (err) {
    errorAlert.classList.remove('hidden');
    errorMsg.textContent = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้: ' + err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i data-lucide="log-in" class="w-4 h-4"></i> เข้าสู่ระบบงานจัดตารางเรียน`;
    if (window.lucide) lucide.createIcons();
  }
}

// Handle Admin Logout
async function adminLogout() {
  if (confirm('คุณต้องการออกจากระบบงานจัดตารางเรียนใช่หรือไม่?')) {
    try {
      if (state.authToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${state.authToken}` }
        });
      }
    } catch (e) {
      console.error('Logout error:', e);
    }

    localStorage.removeItem('yw_schedule_token');
    state.authToken = null;
    state.authUser = null;

    checkAdminAuth();
    switchTab('student');
    alert('ออกจากระบบงานจัดตารางเรียนเรียบร้อยแล้ว');
  }
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}

// Render All Tab Views
function renderAllViews() {
  initTeacherDeptFilters();
  initRoomBuildingFilters();
  renderStudents();
  renderTeachers();
  renderRooms();
}

// ==========================================
// 1. STUDENTS MODULE
// ==========================================
function filterStudentGrade(grade) {
  state.studentFilter.grade = grade;
  document.querySelectorAll('#studentGradePills button').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.includes(grade === 'all' ? 'ทุกระดับชั้น' : grade));
  });
  renderStudents();
}

function filterStudentProgram(prog) {
  state.studentFilter.program = prog;
  document.querySelectorAll('.stu-prog-pill').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.includes(prog === 'all' ? 'ทั้งหมด' : prog));
  });
  renderStudents();
}

function renderStudents() {
  const grid = document.getElementById('studentClassesGrid');
  const empty = document.getElementById('studentEmptyState');
  const searchInput = document.getElementById('studentSearchInput');
  const query = (searchInput ? searchInput.value : '').trim().toLowerCase();

  let list = state.catalog.students || [];

  // Filter grade
  if (state.studentFilter.grade !== 'all') {
    list = list.filter(s => s.grade === state.studentFilter.grade);
  }

  // Filter program
  if (state.studentFilter.program !== 'all') {
    const p = state.studentFilter.program;
    list = list.filter(s => {
      if (p === 'EP') return s.program.includes('EP') || s.room.includes('EP');
      if (p === 'SMA') return s.program.includes('SMA') || s.room.includes('SMA');
      if (p === 'SMT') return s.program.includes('SMT') || s.room.includes('SMT');
      if (p === 'EIS') return s.program.includes('EIS') || s.room.includes('EIS');
      if (p === 'ทั่วไป') return s.program.includes('ทั่วไป');
      return true;
    });
  }

  // Filter search
  if (query) {
    list = list.filter(s => 
      s.className.toLowerCase().includes(query) ||
      (s.room && s.room.toLowerCase().includes(query)) ||
      (s.program && s.program.toLowerCase().includes(query))
    );
  }

  if (list.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = list.map(item => {
    // Program tag styling
    let progBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
    if (item.program.includes('EP')) progBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
    else if (item.program.includes('SMA')) progBadgeClass = 'bg-purple-50 text-purple-800 border-purple-200 font-semibold';
    else if (item.program.includes('SMT')) progBadgeClass = 'bg-blue-50 text-blue-800 border-blue-200 font-semibold';
    else if (item.program.includes('EIS')) progBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold';

    return `
      <div class="bg-white rounded-2xl p-4 border border-slate-200 card-hover-lift flex flex-col justify-between shadow-sm">
        <div>
          <!-- Header with Class Name & Grade Badge -->
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="text-base font-bold text-slate-900 flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              ชั้น ${item.className}
            </span>
            <span class="text-[11px] font-semibold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
              ${item.grade}
            </span>
          </div>

          <!-- Program Tag -->
          <div class="mb-3">
            <span class="inline-block text-[11px] px-2 py-0.5 rounded-md border ${progBadgeClass}">
              ${item.program}
            </span>
          </div>

          <!-- Room and Periods info -->
          <div class="space-y-1.5 text-xs text-slate-600 font-sarabun bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3">
            <div class="flex items-center justify-between">
              <span class="text-slate-400">ห้องเรียนประจำ:</span>
              <span class="font-medium text-slate-800">${item.room || 'ไม่ระบุห้องประจำ'}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400">จำนวนคาบเรียน:</span>
              <span class="font-medium text-slate-800">${item.periods ? item.periods + ' คาบ/สัปดาห์' : 'ตามแผนการเรียน'}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400">การแสดงตาราง:</span>
              <span class="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200 inline-flex items-center gap-1">
                <i data-lucide="check" class="w-3 h-3 text-emerald-600"></i> เฉพาะห้อง ${item.className}
              </span>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="pt-2 border-t border-slate-100 flex items-center gap-2">
          <button 
            onclick="openTimetableModal('student', '${encodeURIComponent(JSON.stringify(item))}')" 
            class="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5"
          >
            <i data-lucide="calendar-check" class="w-3.5 h-3.5"></i> ตารางเฉพาะห้อง ${item.className}
          </button>
          <button 
            onclick="quickReportTarget('student', 'ชั้น ${item.className}')" 
            title="แจ้งปัญหาเกี่ยวกับตารางห้องนี้" 
            class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
          >
            <i data-lucide="alert-circle" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ==========================================
// 2. TEACHERS MODULE
// ==========================================
function initTeacherDeptFilters() {
  const select = document.getElementById('teacherDeptSelect');
  const pillsContainer = document.getElementById('teacherDeptPills');
  if (!select || !pillsContainer) return;

  const depts = [...new Set(state.catalog.teachers.map(t => t.department))];
  
  // Populate Select
  select.innerHTML = '<option value="all">ทุกกลุ่มสาระการเรียนรู้ (ทั้งหมด 210 ท่าน)</option>' +
    depts.map(d => {
      const count = state.catalog.teachers.filter(t => t.department === d).length;
      return `<option value="${d}">${d} (${count} ท่าน)</option>`;
    }).join('');

  // Populate Shortcut Pills
  pillsContainer.innerHTML = `
    <span class="text-slate-400 text-[11px] font-medium mr-1">กลุ่มสาระฯ:</span>
    <button onclick="setTeacherDept('all')" class="dept-pill active">ทั้งหมด</button>
    ${depts.slice(0, 8).map(d => `<button onclick="setTeacherDept('${d}')" class="dept-pill">${d}</button>`).join('')}
  `;
}

function setTeacherDept(dept) {
  state.teacherFilter.department = dept;
  const select = document.getElementById('teacherDeptSelect');
  if (select) select.value = dept;

  document.querySelectorAll('.dept-pill').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === (dept === 'all' ? 'ทั้งหมด' : dept));
  });

  renderTeachers();
}

function renderTeachers() {
  const select = document.getElementById('teacherDeptSelect');
  const searchInput = document.getElementById('teacherSearchInput');
  const grid = document.getElementById('teachersGrid');
  const empty = document.getElementById('teacherEmptyState');

  const dept = select ? select.value : 'all';
  const query = (searchInput ? searchInput.value : '').trim().toLowerCase();

  let list = state.catalog.teachers || [];

  if (dept !== 'all') {
    list = list.filter(t => t.department === dept);
  }

  if (query) {
    list = list.filter(t => 
      (t.name && t.name.toLowerCase().includes(query)) ||
      (t.code && t.code.toLowerCase().includes(query)) ||
      (t.department && t.department.toLowerCase().includes(query))
    );
  }

  if (list.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = list.map(item => {
    return `
      <div class="bg-white rounded-2xl p-4 border border-slate-200 card-hover-lift flex flex-col justify-between shadow-sm">
        <div>
          <!-- Header with Teacher Code & Dept -->
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="text-xs font-mono font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-lg border border-amber-200">
              #${item.code || '-'}
            </span>
            <span class="text-[11px] font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
              ${item.department}
            </span>
          </div>

          <!-- Teacher Full Name -->
          <h4 class="text-sm font-bold text-slate-900 mb-2 leading-snug line-clamp-2">
            ${item.name}
          </h4>

          <!-- Teaching Load -->
          <div class="space-y-1.5 text-xs text-slate-600 font-sarabun bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3">
            <div class="flex items-center justify-between">
              <span class="text-slate-400">ภาระการสอน:</span>
              <span class="font-semibold text-slate-800">${item.periods ? item.periods + ' คาบ/สัปดาห์' : 'ไม่ระบุคาบ'}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400">การแสดงตาราง:</span>
              <span class="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px] border border-indigo-200 inline-flex items-center gap-1">
                <i data-lucide="user" class="w-3 h-3 text-indigo-600"></i> เฉพาะครูท่านนี้
              </span>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="pt-2 border-t border-slate-100 flex items-center gap-2">
          <button 
            onclick="openTimetableModal('teacher', '${encodeURIComponent(JSON.stringify(item))}')" 
            class="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5"
          >
            <i data-lucide="calendar-check" class="w-3.5 h-3.5"></i> ตารางเฉพาะครู ${item.name.split(' ')[0]}
          </button>
          <button 
            onclick="quickReportTarget('teacher', '${item.code ? item.code + ' ' : ''}${item.name}')" 
            title="แจ้งปัญหาตารางสอนของคุณครูท่านนี้" 
            class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
          >
            <i data-lucide="alert-circle" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ==========================================
// 3. ROOMS MODULE
// ==========================================
function initRoomBuildingFilters() {
  const select = document.getElementById('roomBuildingSelect');
  const pillsContainer = document.getElementById('roomBuildingPills');
  if (!select || !pillsContainer) return;

  const buildings = [...new Set(state.catalog.rooms.map(r => r.building))];

  // Populate Select
  select.innerHTML = '<option value="all">ทุกอาคารและสถานที่ (ทั้งหมด 138 ห้อง)</option>' +
    buildings.map(b => {
      const count = state.catalog.rooms.filter(r => r.building === b).length;
      return `<option value="${b}">${b} (${count} ห้อง)</option>`;
    }).join('');

  // Populate Shortcut Pills
  pillsContainer.innerHTML = `
    <span class="text-slate-400 text-[11px] font-medium mr-1">อาคาร:</span>
    <button onclick="setRoomBuilding('all')" class="bld-pill active">ทั้งหมด</button>
    ${buildings.slice(0, 7).map(b => `<button onclick="setRoomBuilding('${b}')" class="bld-pill">${b}</button>`).join('')}
  `;
}

function setRoomBuilding(building) {
  state.roomFilter.building = building;
  const select = document.getElementById('roomBuildingSelect');
  if (select) select.value = building;

  document.querySelectorAll('.bld-pill').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === (building === 'all' ? 'ทั้งหมด' : building));
  });

  renderRooms();
}

function renderRooms() {
  const select = document.getElementById('roomBuildingSelect');
  const searchInput = document.getElementById('roomSearchInput');
  const grid = document.getElementById('roomsGrid');
  const empty = document.getElementById('roomEmptyState');

  const building = select ? select.value : 'all';
  const query = (searchInput ? searchInput.value : '').trim().toLowerCase();

  let list = state.catalog.rooms || [];

  if (building !== 'all') {
    list = list.filter(r => r.building === building);
  }

  if (query) {
    list = list.filter(r => 
      (r.roomName && r.roomName.toLowerCase().includes(query)) ||
      (r.purpose && r.purpose.toLowerCase().includes(query)) ||
      (r.building && r.building.toLowerCase().includes(query))
    );
  }

  if (list.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = list.map(item => {
    return `
      <div class="bg-white rounded-2xl p-4 border border-slate-200 card-hover-lift flex flex-col justify-between shadow-sm">
        <div>
          <!-- Header with Building Tag -->
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
              ${item.building}
            </span>
            <span class="text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300">
              เฉพาะห้องนี้ (1 หน้า)
            </span>
          </div>

          <!-- Room Name -->
          <h4 class="text-base font-bold text-slate-900 mb-1 flex items-center gap-1.5">
            <i data-lucide="door-open" class="w-4 h-4 text-emerald-600"></i>
            ${item.roomName}
          </h4>

          <!-- Purpose / Subject Details -->
          <div class="text-xs text-slate-600 font-sarabun bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3 min-h-[46px] flex items-center">
            <span class="text-slate-500">
              ${item.purpose ? 'ห้องของ: <strong class="text-slate-800">' + item.purpose + '</strong>' : 'ห้องเรียนประจำอาคาร / สถานที่ทั่วไป'}
            </span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="pt-2 border-t border-slate-100 flex items-center gap-2">
          <button 
            onclick="openTimetableModal('room', '${encodeURIComponent(JSON.stringify(item))}')" 
            class="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5"
          >
            <i data-lucide="calendar-check" class="w-3.5 h-3.5"></i> ตารางเฉพาะห้อง ${item.roomName}
          </button>
          <button 
            onclick="quickReportTarget('room', '${item.roomName} (${item.building})')" 
            title="แจ้งปัญหาการใช้งานห้องนี้" 
            class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
          >
            <i data-lucide="alert-circle" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ==========================================
// 4. TIMETABLE MODAL (PDF VIEWER)
// ==========================================
state.currentModalViewMode = 'single'; // 'single' | 'full'

function openTimetableModal(type, itemJsonEncoded, preferredMode) {
  const item = JSON.parse(decodeURIComponent(itemJsonEncoded));
  state.currentModalItem = { type, item };
  if (preferredMode) {
    state.currentModalViewMode = preferredMode;
  } else {
    state.currentModalViewMode = 'single';
  }

  const modal = document.getElementById('timetableModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalSubtitle = document.getElementById('modalSubtitle');
  const modalMetaInfo = document.getElementById('modalMetaInfo');
  const modalPdfFrame = document.getElementById('modalPdfFrame');
  const modalOpenNewTabBtn = document.getElementById('modalOpenNewTabBtn');
  const modalDownloadBtn = document.getElementById('modalDownloadBtn');
  const toggleBtnContainer = document.getElementById('modalCustomToggleContainer');

  let title = '';
  let subtitle = '';
  let pdfPath = '';
  let metaInfo = '';

  if (type === 'student') {
    const isSingle = state.currentModalViewMode !== 'full';
    const singleFile = item.singlePdf || (item.className.replace('/', '-') + '.pdf');
    const singleUrl = `/pdf/student-single/${encodeURIComponent(singleFile)}`;
    const fullUrl = `/pdf/student/${encodeURIComponent(item.pdf)}#page=${item.page}`;

    if (isSingle) {
      title = `ตารางเรียน ชั้น ${item.className} (เฉพาะห้องนี้เท่านั้น)`;
      subtitle = `โรงเรียนหาดใหญ่วิทยาลัย | ภาคเรียนที่ 2 ปีการศึกษา 2569 | ห้องเรียนประจำ: ${item.room || 'ไม่ระบุ'}`;
      pdfPath = singleUrl;
      metaInfo = `ตารางเรียนแยกรายห้อง: แสดงเฉพาะตารางเรียนของห้อง ${item.className} เท่านั้น (เอกสารเดี่ยว 1 หน้า ไม่รวมห้องอื่น)`;
    } else {
      title = `ตารางเรียนรวมระดับชั้น ${item.grade} (รวมทุกห้อง)`;
      subtitle = `กลุ่มบริหารวิชาการ โรงเรียนหาดใหญ่วิทยาลัย | ไฟล์: ${item.pdf} (หน้า ${item.page})`;
      pdfPath = fullUrl;
      metaInfo = `กำลังแสดงไฟล์รวมระดับชั้น ${item.grade} หน้า ${item.page}`;
    }

    // Toggle button in modal
    if (toggleBtnContainer) {
      toggleBtnContainer.innerHTML = `
        <div class="inline-flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]">
          <button 
            onclick="switchModalViewMode('student', 'single')" 
            class="px-2.5 py-1 rounded-md transition-colors ${isSingle ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}"
          >
            เฉพาะห้อง ${item.className}
          </button>
          <button 
            onclick="switchModalViewMode('student', 'full')" 
            class="px-2.5 py-1 rounded-md transition-colors ${!isSingle ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}"
          >
            ไฟล์รวมทั้ง ${item.grade}
          </button>
        </div>
      `;
    }
  } else if (type === 'teacher') {
    const isSingle = state.currentModalViewMode !== 'full';
    const singleUrl = item.singlePdfUrl || (`/pdf/teacher-single/${encodeURIComponent(item.singlePdf)}`);
    const fullUrl = item.pdfUrl || (`/pdf/teacher/${encodeURIComponent(item.pdf)}#page=${item.page}`);

    if (isSingle && item.singlePdf) {
      title = `ตารางสอนครู ${item.fullName || item.name} (เฉพาะท่านนี้เท่านั้น)`;
      subtitle = `กลุ่มสาระฯ ${item.department} | ภาระการสอน ${item.periods || '-'} คาบ/สัปดาห์ | โรงเรียนหาดใหญ่วิทยาลัย`;
      pdfPath = singleUrl;
      metaInfo = `ตารางสอนเฉพาะครู ${item.fullName || item.name} เท่านั้น (เอกสารเดี่ยว 1 หน้า ไม่รวมครูท่านอื่น)`;
    } else {
      title = `ตารางสอนกลุ่มสาระฯ ${item.department} (ไฟล์รวม)`;
      subtitle = `โรงเรียนหาดใหญ่วิทยาลัย | ไฟล์: ${item.pdf} (หน้า ${item.page})`;
      pdfPath = fullUrl;
      metaInfo = `กำลังแสดงไฟล์รวมกลุ่มสาระฯ ${item.department} หน้า ${item.page}`;
    }

    if (toggleBtnContainer) {
      toggleBtnContainer.innerHTML = `
        <div class="inline-flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]">
          <button 
            onclick="switchModalViewMode('teacher', 'single')" 
            class="px-2.5 py-1 rounded-md transition-colors ${isSingle ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}"
          >
            เฉพาะครูท่านนี้
          </button>
          <button 
            onclick="switchModalViewMode('teacher', 'full')" 
            class="px-2.5 py-1 rounded-md transition-colors ${!isSingle ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}"
          >
            ไฟล์รวมกลุ่มสาระฯ
          </button>
        </div>
      `;
    }
  } else if (type === 'room') {
    const isSingle = state.currentModalViewMode !== 'full';
    const singleUrl = item.singlePdfUrl || (`/pdf/classroom-single/${encodeURIComponent(item.singlePdf)}`);
    const fullUrl = item.pdfUrl || (`/pdf/classroom/${encodeURIComponent(item.pdf)}#page=${item.page}`);

    if (isSingle && item.singlePdf) {
      title = `ตารางการใช้ห้อง ${item.roomName} (${item.building}) (เฉพาะห้องนี้เท่านั้น)`;
      subtitle = `${item.purpose ? 'ห้องของ: ' + item.purpose : 'โรงเรียนหาดใหญ่วิทยาลัย'} | เอกสารเดี่ยวเฉพาะห้อง 1 หน้า`;
      pdfPath = singleUrl;
      metaInfo = `ตารางการใช้ห้องเดี่ยว: แสดงเฉพาะห้อง ${item.roomName} เท่านั้น (1 หน้า ไม่รวมห้องอื่นในอาคาร)`;
    } else {
      title = `ตารางการใช้ห้องรวม ${item.building} (ไฟล์รวม)`;
      subtitle = `โรงเรียนหาดใหญ่วิทยาลัย | ไฟล์: ${item.pdf} (หน้า ${item.page})`;
      pdfPath = fullUrl;
      metaInfo = `กำลังแสดงไฟล์รวม ${item.building} หน้า ${item.page}`;
    }

    if (toggleBtnContainer) {
      toggleBtnContainer.innerHTML = `
        <div class="inline-flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]">
          <button 
            onclick="switchModalViewMode('room', 'single')" 
            class="px-2.5 py-1 rounded-md transition-colors ${isSingle ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}"
          >
            เฉพาะห้อง ${item.roomName}
          </button>
          <button 
            onclick="switchModalViewMode('room', 'full')" 
            class="px-2.5 py-1 rounded-md transition-colors ${!isSingle ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}"
          >
            ไฟล์รวมทั้งอาคาร
          </button>
        </div>
      `;
    }
  }

  modalTitle.textContent = title;
  modalSubtitle.textContent = subtitle;
  modalMetaInfo.textContent = metaInfo;

  // Direct download & open tab links
  const rawFileUrl = pdfPath.split('#')[0];
  modalOpenNewTabBtn.href = pdfPath;
  modalDownloadBtn.href = rawFileUrl;

  // Load iframe
  modalPdfFrame.src = pdfPath;

  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');

  if (window.lucide) lucide.createIcons();
}

function switchModalViewMode(type, mode) {
  if (!state.currentModalItem) return;
  openTimetableModal(type, encodeURIComponent(JSON.stringify(state.currentModalItem.item)), mode);
}

function closeTimetableModal() {
  const modal = document.getElementById('timetableModal');
  if (modal) {
    modal.classList.add('hidden');
    document.getElementById('modalPdfFrame').src = 'about:blank';
    document.body.classList.remove('overflow-hidden');
  }
}

function quickReportFromModal() {
  if (!state.currentModalItem) return;
  const { type, item } = state.currentModalItem;
  let target = '';
  if (type === 'student') target = `ชั้น ${item.className}`;
  else if (type === 'teacher') target = `${item.code ? item.code + ' ' : ''}${item.name}`;
  else if (type === 'room') target = `${item.roomName} (${item.building})`;

  closeTimetableModal();
  quickReportTarget(type, target);
}

// Quick pre-fill into report form
function quickReportTarget(category, targetName) {
  switchTab('report');
  const catSelect = document.getElementById('formCategorySelect');
  const targetInput = document.getElementById('formTargetInput');
  if (catSelect) {
    catSelect.value = category;
    updateTargetOptions();
  }
  if (targetInput) {
    targetInput.value = targetName;
    targetInput.focus();
  }
}

// ==========================================
// 5. REPORT SUBMISSION MODULE
// ==========================================
function initFormDatalists() {
  updateTargetOptions();
}

function updateTargetOptions() {
  const catSelect = document.getElementById('formCategorySelect');
  const datalist = document.getElementById('targetDatalist');
  if (!catSelect || !datalist) return;

  const cat = catSelect.value;
  let options = [];

  if (cat === 'student') {
    options = state.catalog.students.map(s => `ชั้น ${s.className}`);
  } else if (cat === 'teacher') {
    options = state.catalog.teachers.map(t => `${t.code ? t.code + ' ' : ''}${t.name}`);
  } else if (cat === 'room') {
    options = state.catalog.rooms.map(r => `${r.roomName} (${r.building})`);
  }

  datalist.innerHTML = options.map(opt => `<option value="${opt}">`).join('');
}

async function submitIssueReport(e) {
  e.preventDefault();
  const form = document.getElementById('issueReportForm');
  const btn = document.getElementById('submitReportBtn');
  const successAlert = document.getElementById('reportSuccessAlert');
  const ticketIdText = document.getElementById('newTicketIdText');

  const formData = new FormData(form);
  const payload = {
    reporterName: (formData.get('reporterName') || '').trim(),
    reporterRole: formData.get('reporterRole') || 'นักเรียน',
    reporterPhone: (formData.get('reporterPhone') || '').trim(),
    reporterEmail: (formData.get('reporterEmail') || '').trim(),
    category: formData.get('category') || 'student',
    targetName: (formData.get('targetName') || '').trim(),
    issueType: formData.get('issueType') || 'คาบเรียนซ้ำซ้อน / คาบชนกัน',
    urgency: formData.get('urgency') || 'normal',
    dayPeriod: (formData.get('dayPeriod') || '').trim(),
    description: (formData.get('description') || '').trim(),
  };

  if (!payload.reporterName) {
    alert('กรุณากรอกชื่อ-นามสกุลของผู้แจ้ง');
    const nameInput = form.querySelector('[name="reporterName"]');
    if (nameInput) nameInput.focus();
    return;
  }

  if (!payload.reporterPhone) {
    alert('กรุณากรอกเบอร์โทรศัพท์ติดต่อสำหรับติดตามสถานะ');
    const phoneInput = form.querySelector('[name="reporterPhone"]');
    if (phoneInput) phoneInput.focus();
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> กำลังบันทึกลงฐานข้อมูล...`;

  try {
    const res = await fetch('/api/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success && data.data) {
      const ticketId = data.data.id;
      ticketIdText.textContent = ticketId;
      successAlert.classList.remove('hidden');
      form.reset();

      // Set tracking search value ready
      const trackInput = document.getElementById('trackSearchInput');
      if (trackInput) trackInput.value = ticketId;

      // Scroll to alert
      successAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Refresh admin list & stats
      loadAdminIssues();
      loadCatalogAndStats();

      // Show instant confirmation
      setTimeout(() => {
        alert(`บันทึกเรื่องแจ้งปัญหาลงฐานข้อมูลเรียบร้อยแล้ว!\n\nหมายเลขคำร้อง (Ticket ID): ${ticketId}\nผู้แจ้ง: ${data.data.reporterName}\nเบอร์โทร: ${data.data.reporterPhone}\n\nท่านสามารถนำหมายเลขนี้หรือเบอร์โทรศัพท์ไปค้นหาติดตามผลได้ทันทีครับ`);
      }, 200);
    } else {
      alert(data.message || 'เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่อีกครั้ง');
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="send" class="w-4 h-4"></i> ส่งเรื่องแจ้งปัญหา`;
    if (window.lucide) lucide.createIcons();
  }
}

function copyTicketId() {
  const id = document.getElementById('newTicketIdText').textContent.trim();
  if (navigator.clipboard && id) {
    navigator.clipboard.writeText(id).then(() => {
      alert('คัดลอกหมายเลขคำร้อง ' + id + ' แล้ว');
    });
  }
}

function viewTrackTicket() {
  const id = document.getElementById('newTicketIdText').textContent.trim();
  switchTab('track');
  const input = document.getElementById('trackSearchInput');
  if (input && id) {
    input.value = id;
    searchTrackIssue();
  }
}

// ==========================================
// 6. ISSUE TRACKING MODULE
// ==========================================
async function searchTrackIssue() {
  const input = document.getElementById('trackSearchInput');
  const container = document.getElementById('trackResultContainer');
  const placeholder = document.getElementById('trackPlaceholder');

  const query = (input ? input.value : '').trim();
  if (!query) {
    alert('กรุณากรอกหมายเลขคำร้อง (Ticket ID) หรือเบอร์โทรศัพท์');
    return;
  }

  container.innerHTML = `
    <div class="bg-white p-8 rounded-2xl border border-slate-200 text-center">
      <i data-lucide="loader" class="w-6 h-6 animate-spin text-teal-600 mx-auto mb-2"></i>
      <p class="text-xs text-slate-500 font-sarabun">กำลังค้นหาข้อมูล...</p>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  placeholder.classList.add('hidden');

  try {
    // If format is like YW69-XXXX
    let url = `/api/issues?search=${encodeURIComponent(query)}`;
    if (/^\d{9,10}$/.test(query.replace(/\D/g, ''))) {
      url = `/api/issues?phone=${encodeURIComponent(query)}`;
    }

    const res = await fetch(url);
    const data = await res.json();

    if (data.success && data.data.length > 0) {
      container.innerHTML = data.data.map(issue => renderTrackIssueCard(issue)).join('');
    } else {
      container.innerHTML = `
        <div class="bg-white p-8 rounded-2xl border border-slate-200 text-center">
          <div class="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
            <i data-lucide="alert-circle" class="w-6 h-6"></i>
          </div>
          <h4 class="text-sm font-bold text-slate-800">ไม่พบข้อมูลคำร้องที่ค้นหา</h4>
          <p class="text-xs text-slate-500 font-sarabun mt-1">กรุณาตรวจสอบหมายเลขคำร้อง หรือเบอร์โทรศัพท์ที่ถูกต้อง</p>
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = `
      <div class="bg-white p-6 rounded-2xl border border-red-200 text-red-600 text-xs">
        เกิดข้อผิดพลาดในการค้นหา: ${err.message}
      </div>
    `;
  }

  if (window.lucide) lucide.createIcons();
}

function renderTrackIssueCard(issue) {
  let statusBadge = '';
  let statusStepIndex = 1; // 1: pending, 2: in_progress, 3: resolved

  if (issue.status === 'pending') {
    statusBadge = '<span class="bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-semibold text-xs border border-amber-200">รอดำเนินการ</span>';
    statusStepIndex = 1;
  } else if (issue.status === 'in_progress') {
    statusBadge = '<span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold text-xs border border-blue-200">กำลังตรวจสอบ/แก้ไข</span>';
    statusStepIndex = 2;
  } else if (issue.status === 'resolved') {
    statusBadge = '<span class="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-semibold text-xs border border-emerald-200">แก้ไขเสร็จสิ้นแล้ว</span>';
    statusStepIndex = 3;
  } else if (issue.status === 'rejected') {
    statusBadge = '<span class="bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-semibold text-xs border border-slate-200">ไม่อนุมัติ / ไม่พบปัญหา</span>';
    statusStepIndex = 1;
  }

  const createdDate = new Date(issue.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

  return `
    <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-base font-bold font-mono text-slate-900">${issue.id}</span>
            ${statusBadge}
          </div>
          <span class="text-[11px] text-slate-400 font-sarabun">วันที่แจ้ง: ${createdDate}</span>
        </div>
        <div class="text-xs text-slate-500 font-sarabun">
          ผู้แจ้ง: <strong class="text-slate-800">${issue.reporterName}</strong> (${issue.reporterRole})
        </div>
      </div>

      <!-- Timeline Progress Steps -->
      <div class="py-2">
        <div class="grid grid-cols-3 gap-2 text-center text-[11px] font-medium font-sarabun">
          <div class="p-2 rounded-xl ${statusStepIndex >= 1 ? 'bg-amber-50 text-amber-900 border border-amber-200 font-bold' : 'bg-slate-50 text-slate-400'}">
            1. รับเรื่องในระบบ
          </div>
          <div class="p-2 rounded-xl ${statusStepIndex >= 2 ? 'bg-blue-50 text-blue-900 border border-blue-200 font-bold' : 'bg-slate-50 text-slate-400'}">
            2. ตรวจสอบ/ประสานงาน
          </div>
          <div class="p-2 rounded-xl ${statusStepIndex >= 3 ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold' : 'bg-slate-50 text-slate-400'}">
            3. ดำเนินการเสร็จสิ้น
          </div>
        </div>
      </div>

      <!-- Problem Details -->
      <div class="bg-slate-50 p-4 rounded-xl text-xs space-y-2 font-sarabun border border-slate-100">
        <div class="flex flex-wrap items-center justify-between gap-1">
          <span class="text-slate-500">เป้าหมาย: <strong class="text-blue-700">${issue.targetName}</strong></span>
          <span class="text-slate-500">ประเภท: <strong class="text-slate-800">${issue.issueType}</strong></span>
        </div>
        <div class="text-slate-500">วัน/คาบเวลา: <strong class="text-slate-800">${issue.dayPeriod || '-'}</strong></div>
        <div class="pt-2 border-t border-slate-200/60">
          <div class="text-slate-500 font-medium mb-0.5">รายละเอียด:</div>
          <p class="text-slate-700 whitespace-pre-wrap leading-relaxed">${issue.description}</p>
        </div>
      </div>

      <!-- Admin Resolution Response (if any) -->
      ${issue.adminResponse ? `
        <div class="bg-emerald-50/80 border border-emerald-200 p-4 rounded-xl text-xs font-sarabun space-y-1.5">
          <div class="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
            <i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i>
            คำชี้แจง / ผลการแก้ไขจากงานจัดตารางเรียน:
          </div>
          <p class="text-emerald-950 leading-relaxed font-normal">${issue.adminResponse}</p>
          ${issue.resolvedBy ? `<div class="text-[11px] text-emerald-700 pt-1 font-medium">ผู้รับผิดชอบ: ${issue.resolvedBy}</div>` : ''}
        </div>
      ` : `
        <div class="bg-blue-50 border border-blue-200 p-3 rounded-xl text-xs text-blue-800 font-sarabun flex items-center gap-2">
          <i data-lucide="clock" class="w-4 h-4 text-blue-600 shrink-0"></i>
          <span>งานจัดตารางเรียนกำลังอยู่ระหว่างกระบวนการตรวจสอบคำร้องนี้ หากมีความคืบหน้าจะแจ้งผลในหน้านี้ทันที</span>
        </div>
      `}
    </div>
  `;
}

// ==========================================
// 7. ACADEMIC ADMIN DASHBOARD MODULE
// ==========================================
async function loadAdminIssues() {
  try {
    const res = await fetch('/api/issues');
    const data = await res.json();
    if (data.success) {
      state.adminIssues = data.data;
      updateAdminStats(state.adminIssues);
      renderAdminTable();
    }
  } catch (err) {
    console.error('Error loading admin issues:', err);
  }
}

function updateAdminStats(issues) {
  const total = issues.length;
  const pending = issues.filter(i => i.status === 'pending').length;
  const inProg = issues.filter(i => i.status === 'in_progress').length;
  const resolved = issues.filter(i => i.status === 'resolved').length;

  document.getElementById('adminStatTotal').textContent = total;
  document.getElementById('adminStatPending').textContent = pending;
  document.getElementById('adminStatInProgress').textContent = inProg;
  document.getElementById('adminStatResolved').textContent = resolved;
}

function filterAdminStatus(status) {
  state.adminFilter.status = status;
  document.querySelectorAll('.admin-status-pill').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === (status === 'all' ? 'ทั้งหมด' : (status === 'pending' ? 'รอดำเนินการ' : (status === 'in_progress' ? 'กำลังตรวจสอบ' : 'แก้ไขเสร็จสิ้น'))));
  });
  renderAdminTable();
}

function renderAdminTable() {
  const tbody = document.getElementById('adminIssuesTableBody');
  const empty = document.getElementById('adminTableEmpty');
  const searchInput = document.getElementById('adminSearchInput');
  const query = (searchInput ? searchInput.value : '').trim().toLowerCase();

  let list = state.adminIssues || [];

  if (state.adminFilter.status !== 'all') {
    list = list.filter(i => i.status === state.adminFilter.status);
  }

  if (query) {
    list = list.filter(i => 
      (i.id && i.id.toLowerCase().includes(query)) ||
      (i.reporterName && i.reporterName.toLowerCase().includes(query)) ||
      (i.targetName && i.targetName.toLowerCase().includes(query)) ||
      (i.issueType && i.issueType.toLowerCase().includes(query)) ||
      (i.description && i.description.toLowerCase().includes(query))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  tbody.innerHTML = list.map(item => {
    // Status Badge
    let statusClass = 'bg-amber-100 text-amber-800 border-amber-200';
    let statusText = 'รอดำเนินการ';
    if (item.status === 'in_progress') {
      statusClass = 'bg-blue-100 text-blue-800 border-blue-200';
      statusText = 'กำลังตรวจสอบ';
    } else if (item.status === 'resolved') {
      statusClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      statusText = 'แก้ไขแล้ว';
    } else if (item.status === 'rejected') {
      statusClass = 'bg-slate-100 text-slate-700 border-slate-200';
      statusText = 'ไม่พบปัญหา';
    }

    // Urgency Badge
    let urgencyClass = 'bg-slate-100 text-slate-600';
    let urgencyText = 'ปกติ';
    if (item.urgency === 'urgent') {
      urgencyClass = 'bg-orange-100 text-orange-800 font-semibold';
      urgencyText = 'เร่งด่วน';
    } else if (item.urgency === 'critical') {
      urgencyClass = 'bg-red-100 text-red-800 font-bold';
      urgencyText = 'ด่วนที่สุด';
    }

    const dateStr = new Date(item.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

    return `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-3 px-4 font-mono font-bold text-slate-900">${item.id}</td>
        <td class="py-3 px-4 text-slate-500 whitespace-nowrap">${dateStr}</td>
        <td class="py-3 px-4">
          <div class="font-medium text-slate-800">${item.reporterName}</div>
          <div class="text-[11px] text-slate-400 font-mono">${item.reporterPhone}</div>
        </td>
        <td class="py-3 px-4">
          <div class="font-semibold text-blue-700">${item.targetName}</div>
          <div class="text-[11px] text-slate-400">${item.category === 'student' ? 'ตารางเรียน' : (item.category === 'teacher' ? 'ตารางสอน' : 'ตารางใช้ห้อง')}</div>
        </td>
        <td class="py-3 px-4 max-w-[200px] truncate" title="${item.issueType}: ${item.description}">
          <div class="font-medium text-slate-800 truncate">${item.issueType}</div>
          <div class="text-[11px] text-slate-400 truncate">${item.description}</div>
        </td>
        <td class="py-3 px-4">
          <span class="inline-block px-2 py-0.5 rounded-full text-[10px] ${urgencyClass}">
            ${urgencyText}
          </span>
        </td>
        <td class="py-3 px-4">
          <span class="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusClass}">
            ${statusText}
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          <button 
            onclick="openAdminManageModal('${item.id}')" 
            class="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded-lg text-xs transition-colors border border-purple-200 inline-flex items-center gap-1"
          >
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i> จัดการ
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function openAdminManageModal(issueId) {
  const issue = state.adminIssues.find(i => i.id === issueId);
  if (!issue) return;

  document.getElementById('manageIssueId').value = issue.id;
  document.getElementById('manageModalTicketId').textContent = `Ticket: ${issue.id}`;
  document.getElementById('manageReporterName').textContent = issue.reporterName;
  document.getElementById('manageReporterRole').textContent = issue.reporterRole;
  document.getElementById('manageReporterPhone').textContent = issue.reporterPhone;
  document.getElementById('manageTargetName').textContent = issue.targetName;
  document.getElementById('manageDayPeriod').textContent = issue.dayPeriod || 'ไม่ระบุ';
  document.getElementById('manageDescription').textContent = issue.description;

  document.getElementById('manageStatusSelect').value = issue.status || 'pending';
  document.getElementById('manageResolvedBy').value = issue.resolvedBy || (state.authUser ? `${state.authUser.fullName} (${state.authUser.position})` : 'เจ้าหน้าที่งานจัดตารางเรียน');
  document.getElementById('manageAdminResponse').value = issue.adminResponse || '';

  const modal = document.getElementById('adminManageModal');
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');

  if (window.lucide) lucide.createIcons();
}

function closeAdminManageModal() {
  const modal = document.getElementById('adminManageModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
}

async function saveAdminIssueUpdate(e) {
  e.preventDefault();
  const id = document.getElementById('manageIssueId').value;
  const status = document.getElementById('manageStatusSelect').value;
  const resolvedBy = document.getElementById('manageResolvedBy').value.trim();
  const adminResponse = document.getElementById('manageAdminResponse').value.trim();

  if (!state.authToken) {
    alert('กรุณาเข้าสู่ระบบงานจัดตารางเรียนก่อนดำเนินการ');
    closeAdminManageModal();
    switchTab('admin');
    return;
  }

  try {
    const res = await fetch(`/api/issues/${id}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.authToken}`
      },
      body: JSON.stringify({ status, resolvedBy, adminResponse })
    });

    const data = await res.json();
    if (data.success) {
      closeAdminManageModal();
      await loadAdminIssues();
      alert('อัปเดตสถานะและบันทึกข้อความสำเร็จ');
    } else {
      if (res.status === 401) {
        alert('เซสชันการเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบใหม่');
        state.authToken = null;
        localStorage.removeItem('yw_schedule_token');
        closeAdminManageModal();
        switchTab('admin');
      } else {
        alert(data.message || 'ไม่สามารถอัปเดตข้อมูลได้');
      }
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
  }
}

function exportIssuesJSON() {
  const issues = state.adminIssues || [];
  const jsonStr = JSON.stringify(issues, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `yorwor-issues-2569-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
