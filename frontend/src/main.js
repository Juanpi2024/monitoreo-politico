/**
 * ============================================
 * CIVIC WATCHDOG - Main Application
 * Modern Political Monitoring Dashboard
 * ============================================
 */

import './styles/index.css';
import { getDiputados, getEstadisticas, getEstadisticasPorPartido, getAlertas, getProximasVotaciones } from './services/api.js';

// ============================================
// STATE & DOM ELEMENTS
// ============================================

const state = {
  diputados: [],
  filteredDiputados: [],
  estadisticas: {},
  partidos: [],
  alertas: [],
  proyectos: [],
  filters: {
    search: '',
    partido: '',
    alerta: '',
    sortBy: 'alert'
  },
  theme: localStorage.getItem('theme') || 'dark'
};

const elements = {
  statsGrid: document.getElementById('statsGrid'),
  deputiesGrid: document.getElementById('deputiesGrid'),
  deputiesCount: document.getElementById('deputiesCount'),
  alertsList: document.getElementById('alertsList'),
  projectsList: document.getElementById('projectsList'),
  partyList: document.getElementById('partyList'),
  filterPartido: document.getElementById('filterPartido'),
  filterAlerta: document.getElementById('filterAlerta'),
  sortBy: document.getElementById('sortBy'),
  searchInput: document.getElementById('searchInput'),
  themeToggle: document.getElementById('themeToggle'),
  refreshData: document.getElementById('refreshData'),
  deputyModal: document.getElementById('deputyModal'),
  modalClose: document.getElementById('modalClose'),
  modalBody: document.getElementById('modalBody'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  toastContainer: document.getElementById('toastContainer')
};

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  // Apply saved theme
  applyTheme(state.theme);

  // Setup event listeners
  setupEventListeners();

  // Load data
  await loadData();
}

async function loadData() {
  showLoading(true);

  try {
    // Load all data in parallel
    const [diputados, estadisticas, partidos, alertas, proyectos] = await Promise.all([
      getDiputados(),
      getEstadisticas(),
      getEstadisticasPorPartido(),
      getAlertas(),
      getProximasVotaciones()
    ]);

    state.diputados = diputados;
    state.filteredDiputados = [...diputados];
    state.estadisticas = estadisticas;
    state.partidos = partidos;
    state.alertas = alertas;
    state.proyectos = proyectos || [];

    // Render all sections
    renderStats();
    renderDeputies();
    renderAlerts();
    renderProjects();
    renderPartyList();
    populateFilters();

    showToast('Datos cargados correctamente', 'success');
  } catch (error) {
    console.error('Error loading data:', error);
    showToast('Error al cargar los datos', 'error');
  } finally {
    showLoading(false);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Theme toggle
  elements.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(state.theme);
    localStorage.setItem('theme', state.theme);
  });

  // Refresh data
  elements.refreshData.addEventListener('click', async () => {
    elements.refreshData.querySelector('i').classList.add('fa-spin');
    await loadData();
    elements.refreshData.querySelector('i').classList.remove('fa-spin');
  });

  // Search
  elements.searchInput.addEventListener('input', (e) => {
    state.filters.search = e.target.value.toLowerCase();
    applyFilters();
  });

  // Filters
  elements.filterPartido.addEventListener('change', (e) => {
    state.filters.partido = e.target.value;
    applyFilters();
  });

  elements.filterAlerta.addEventListener('change', (e) => {
    state.filters.alerta = e.target.value;
    applyFilters();
  });

  elements.sortBy.addEventListener('change', (e) => {
    state.filters.sortBy = e.target.value;
    applyFilters();
  });

  // Modal
  elements.modalClose.addEventListener('click', closeModal);
  elements.deputyModal.addEventListener('click', (e) => {
    if (e.target === elements.deputyModal) {
      closeModal();
    }
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
}

// ============================================
// RENDERING FUNCTIONS
// ============================================

function renderStats() {
  const stats = [
    {
      icon: 'fa-users',
      iconClass: 'purple',
      value: state.estadisticas.totalDiputados || 0,
      label: 'Diputados Monitoreados',
      trend: null
    },
    {
      icon: 'fa-exclamation-triangle',
      iconClass: 'red',
      value: state.estadisticas.alertasAltas || 0,
      label: 'Alertas Altas',
      trend: { value: '+3', direction: 'up' }
    },
    {
      icon: 'fa-chart-line',
      iconClass: 'yellow',
      value: state.estadisticas.votacionesAnalizadas || 0,
      label: 'Votaciones Analizadas',
      trend: null
    },
    {
      icon: 'fa-check-circle',
      iconClass: 'green',
      value: `${state.estadisticas.asistenciaPromedio || 0}%`,
      label: 'Asistencia Promedio',
      trend: { value: '+2%', direction: 'up' }
    }
  ];

  elements.statsGrid.innerHTML = stats.map(stat => `
    <div class="stat-card">
      <div class="stat-header">
        <div class="stat-icon ${stat.iconClass}">
          <i class="fas ${stat.icon}"></i>
        </div>
        ${stat.trend ? `
          <div class="stat-trend ${stat.trend.direction}">
            <i class="fas fa-arrow-${stat.trend.direction}"></i>
            ${stat.trend.value}
          </div>
        ` : ''}
      </div>
      <div class="stat-value">${stat.value}</div>
      <div class="stat-label">${stat.label}</div>
    </div>
  `).join('');
}

function renderDeputies() {
  elements.deputiesCount.textContent = state.filteredDiputados.length;

  if (state.filteredDiputados.length === 0) {
    elements.deputiesGrid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-search"></i>
        <p>No se encontraron diputados con los filtros seleccionados</p>
      </div>
    `;
    return;
  }

  elements.deputiesGrid.innerHTML = state.filteredDiputados.map(dip => {
    const alertClass = getAlertClass(dip.nivelAlerta);
    const initials = dip.nombre.split(' ').map(n => n[0]).slice(0, 2).join('');

    return `
      <div class="deputy-card" data-id="${dip.id}">
        <div class="alert-indicator ${alertClass}"></div>
        <div class="deputy-header">
          <div class="deputy-avatar" style="background: ${dip.partidoColor || 'var(--accent-gradient)'}">
            ${initials}
          </div>
          <div class="deputy-info">
            <div class="deputy-name">${dip.nombre}</div>
            <div class="deputy-party">${dip.partido} - ${dip.region || 'Sin región'}</div>
          </div>
        </div>
        <div class="deputy-stats">
          <div class="deputy-stat">
            <div class="deputy-stat-value">${dip.nivelAlerta}</div>
            <div class="deputy-stat-label">Alerta</div>
          </div>
          <div class="deputy-stat">
            <div class="deputy-stat-value">${dip.asistencia}%</div>
            <div class="deputy-stat-label">Asistencia</div>
          </div>
          <div class="deputy-stat">
            <div class="deputy-stat-value">${dip.votacionesTotal || 0}</div>
            <div class="deputy-stat-label">Votaciones</div>
          </div>
        </div>
        <div class="deputy-tags">
          <span class="tag alert-${alertClass}">${getAlertLabel(dip.nivelAlerta)}</span>
          ${dip.inconsistencias?.length > 0 ? '<span class="tag alert-high">⚠️ Inconsistencias</span>' : ''}
        </div>
      </div>
    `;
  }).join('');

  // Add click listeners
  document.querySelectorAll('.deputy-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.id);
      openDeputyModal(id);
    });
  });
}

function renderAlerts() {
  if (state.alertas.length === 0) {
    elements.alertsList.innerHTML = '<p class="empty-text">No hay alertas activas</p>';
    return;
  }

  elements.alertsList.innerHTML = state.alertas.map(dip => {
    const alertClass = getAlertClass(dip.nivelAlerta);
    return `
      <div class="alert-item" data-id="${dip.id}">
        <div class="alert-badge ${alertClass}"></div>
        <span class="alert-name">${dip.nombre}</span>
        <span class="alert-score">${dip.nivelAlerta}/10</span>
      </div>
    `;
  }).join('');

  // Add click listeners
  document.querySelectorAll('.alert-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = parseInt(item.dataset.id);
      openDeputyModal(id);
    });
  });
}

function renderProjects() {
  if (!state.proyectos || state.proyectos.length === 0) {
    elements.projectsList.innerHTML = '<p class="empty-text">No hay proyectos próximos</p>';
    return;
  }

  const prioridadIcons = {
    alto: '🔴',
    medio: '🟡',
    bajo: '🟢'
  };

  const temaIcons = {
    Transparencia: '🔍',
    Participación: '🗳️',
    Derechos: '⚖️',
    Electoral: '📋',
    General: '📄'
  };

  elements.projectsList.innerHTML = state.proyectos.slice(0, 5).map(p => `
    <div class="project-item">
      <div class="project-header">
        <span class="project-priority">${prioridadIcons[p.prioridad] || '⚪'}</span>
        <span class="project-boletin">${p.boletin}</span>
        <span class="project-tema">${temaIcons[p.tema] || '📄'} ${p.tema}</span>
      </div>
      <div class="project-title">${p.titulo.substring(0, 80)}${p.titulo.length > 80 ? '...' : ''}</div>
      <div class="project-footer">
        <span class="project-impact">Impacto: ${p.impactoCiudadania}</span>
        ${p.url ? `<a href="${p.url}" target="_blank" class="project-link" title="Ver en Cámara">🔗</a>` : ''}
      </div>
    </div>
  `).join('');
}

function renderPartyList() {
  elements.partyList.innerHTML = state.partidos.slice(0, 8).map(party => `
    <div class="party-item" data-partido="${party.sigla}">
      <div class="party-badge" style="background: ${party.color}">${party.sigla}</div>
      <div class="party-info">
        <div class="party-name">${party.nombre}</div>
        <div class="party-count">${party.count} diputados</div>
      </div>
    </div>
  `).join('');

  // Add click listeners
  document.querySelectorAll('.party-item').forEach(item => {
    item.addEventListener('click', () => {
      const partido = item.dataset.partido;
      elements.filterPartido.value = partido;
      state.filters.partido = partido;
      applyFilters();
    });
  });
}

function populateFilters() {
  // Populate party filter
  const partidosOptions = state.partidos.map(p =>
    `<option value="${p.sigla}">${p.sigla} - ${p.nombre}</option>`
  ).join('');

  elements.filterPartido.innerHTML = `
    <option value="">Todos los partidos</option>
    ${partidosOptions}
  `;
}

// ============================================
// MODAL
// ============================================

function openDeputyModal(id) {
  const dip = state.diputados.find(d => d.id === id);
  if (!dip) return;

  const alertClass = getAlertClass(dip.nivelAlerta);
  const initials = dip.nombre.split(' ').map(n => n[0]).slice(0, 2).join('');

  elements.modalBody.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar" style="background: ${dip.partidoColor || 'var(--accent-gradient)'}">
        ${initials}
      </div>
      <div class="profile-info">
        <h3>${dip.nombre}</h3>
        <p>${dip.partidoNombre} (${dip.partido})</p>
        <p>${dip.region || 'Sin información de región'}</p>
        <div class="profile-social">
          ${dip.twitter ? `<a href="https://twitter.com/${dip.twitter.replace('@', '')}" target="_blank" class="social-link" title="Twitter"><i class="fab fa-twitter"></i></a>` : ''}
          ${dip.instagram ? `<a href="https://instagram.com/${dip.instagram}" target="_blank" class="social-link" title="Instagram"><i class="fab fa-instagram"></i></a>` : ''}
          ${dip.email ? `<a href="mailto:${dip.email}" class="social-link" title="Email"><i class="fas fa-envelope"></i></a>` : ''}
        </div>
      </div>
    </div>
    
    <div class="deputy-stats" style="margin-bottom: 1.5rem">
      <div class="deputy-stat">
        <div class="deputy-stat-value" style="color: var(--${alertClass === 'high' ? 'danger' : alertClass === 'medium' ? 'warning' : 'success'})">${dip.nivelAlerta}/10</div>
        <div class="deputy-stat-label">Nivel Alerta</div>
      </div>
      <div class="deputy-stat">
        <div class="deputy-stat-value">${dip.asistencia}%</div>
        <div class="deputy-stat-label">Asistencia</div>
      </div>
      <div class="deputy-stat">
        <div class="deputy-stat-value">${dip.aFavor || 0}</div>
        <div class="deputy-stat-label">A Favor</div>
      </div>
      <div class="deputy-stat">
        <div class="deputy-stat-value">${dip.enContra || 0}</div>
        <div class="deputy-stat-label">En Contra</div>
      </div>
    </div>

    ${dip.perfilElectoral ? `
      <div class="section-title"><i class="fas fa-chart-bar"></i> Perfil Electoral</div>
      <div class="electoral-profile">
        <div class="electoral-stat"><span class="electoral-value">${dip.perfilElectoral.elecciones}</span><span class="electoral-label">Elecciones</span></div>
        <div class="electoral-stat"><span class="electoral-value">${dip.perfilElectoral.reelecciones}</span><span class="electoral-label">Reelecciones</span></div>
        <div class="electoral-stat"><span class="electoral-value">${dip.perfilElectoral.votosUltimaEleccion.toLocaleString()}</span><span class="electoral-label">Votos (última)</span></div>
        <div class="electoral-stat"><span class="electoral-value">${dip.perfilElectoral.porcentaje}</span><span class="electoral-label">Porcentaje</span></div>
      </div>
    ` : ''}

    ${dip.polemicas?.length > 0 ? `
      <div class="section-title danger-title"><i class="fas fa-fire"></i> Polémicas Recientes</div>
      <div class="polemicas-list">
        ${dip.polemicas.map(p => `
          <div class="polemica-item severidad-${p.severidad}">
            <span class="polemica-icon">${getPolemicaIcon(p.tipo)}</span>
            <div class="polemica-content">
              <span class="polemica-texto">${p.texto}</span>
              <span class="polemica-fecha">${p.fecha}</span>
            </div>
            <span class="polemica-tag ${p.severidad}">${p.severidad.toUpperCase()}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${dip.debilidades?.length > 0 ? `
      <div class="section-title warning-title"><i class="fas fa-exclamation-triangle"></i> Debilidades Políticas</div>
      <div class="analisis-grid">
        ${dip.debilidades.map(d => `
          <div class="analisis-item debilidad impacto-${d.impacto}">
            <span class="analisis-area">${d.area}</span>
            <span class="analisis-desc">${d.desc}</span>
            <span class="analisis-impacto">⚠️ ${d.impacto}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${dip.fortalezas?.length > 0 ? `
      <div class="section-title success-title"><i class="fas fa-star"></i> Fortalezas</div>
      <div class="analisis-grid">
        ${dip.fortalezas.map(f => `
          <div class="analisis-item fortaleza">
            <span class="analisis-area">${f.area}</span>
            <span class="analisis-desc">${f.desc}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
    
    ${dip.inconsistencias?.length > 0 ? `
      <div class="section-title"><i class="fas fa-exclamation-circle"></i> Inconsistencias Detectadas</div>
      <div class="inconsistencias-list">
        ${dip.inconsistencias.map(inc => `
          <div class="inconsistencia-item">${inc}</div>
        `).join('')}
      </div>
    ` : ''}
    
    <div class="section-title"><i class="fas fa-vote-yea"></i> Historial de Votaciones</div>
    <div class="votaciones-list">
      ${(dip.votaciones || []).map(v => `
        <div class="votacion-item">
          <span class="votacion-titulo">${v.titulo}</span>
          <span class="votacion-voto ${v.voto}">${formatVoto(v.voto)}</span>
        </div>
      `).join('')}
    </div>
  `;

  elements.deputyModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  elements.deputyModal.classList.remove('active');
  document.body.style.overflow = '';
}

// ============================================
// FILTERS
// ============================================

function applyFilters() {
  let filtered = [...state.diputados];

  // Search filter
  if (state.filters.search) {
    filtered = filtered.filter(d =>
      d.nombre.toLowerCase().includes(state.filters.search) ||
      d.partido.toLowerCase().includes(state.filters.search) ||
      (d.partidoNombre && d.partidoNombre.toLowerCase().includes(state.filters.search))
    );
  }

  // Party filter
  if (state.filters.partido) {
    filtered = filtered.filter(d => d.partido === state.filters.partido);
  }

  // Alert filter
  if (state.filters.alerta) {
    switch (state.filters.alerta) {
      case 'high':
        filtered = filtered.filter(d => d.nivelAlerta >= 7);
        break;
      case 'medium':
        filtered = filtered.filter(d => d.nivelAlerta >= 4 && d.nivelAlerta < 7);
        break;
      case 'low':
        filtered = filtered.filter(d => d.nivelAlerta < 4);
        break;
    }
  }

  // Sort
  switch (state.filters.sortBy) {
    case 'alert':
      filtered.sort((a, b) => b.nivelAlerta - a.nivelAlerta);
      break;
    case 'name':
      filtered.sort((a, b) => a.nombre.localeCompare(b.nombre));
      break;
    case 'party':
      filtered.sort((a, b) => a.partido.localeCompare(b.partido));
      break;
    case 'attendance':
      filtered.sort((a, b) => b.asistencia - a.asistencia);
      break;
  }

  state.filteredDiputados = filtered;
  renderDeputies();
}

// ============================================
// UTILITIES
// ============================================

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = elements.themeToggle.querySelector('i');
  icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

function getAlertClass(level) {
  if (level >= 7) return 'high';
  if (level >= 4) return 'medium';
  return 'low';
}

function getAlertLabel(level) {
  if (level >= 7) return '🔴 Alerta Alta';
  if (level >= 4) return '🟡 Alerta Media';
  return '🟢 Alerta Baja';
}

function getPolemicaIcon(tipo) {
  const icons = {
    declaracion: '🎤',
    votacion: '🗳️',
    conflicto: '⚔️',
    asistencia: '🚫',
    cambio: '🔄',
    redes: '📱',
    financiamiento: '💰',
    promesa: '📝'
  };
  return icons[tipo] || '⚠️';
}

function formatVoto(voto) {
  switch (voto) {
    case 'favor': return '✓ A Favor';
    case 'contra': return '✗ En Contra';
    case 'abstencion': return '○ Abstención';
    default: return voto;
  }
}

function showLoading(show) {
  if (show) {
    elements.loadingOverlay.classList.add('active');
  } else {
    elements.loadingOverlay.classList.remove('active');
  }
}

function showToast(message, type = 'info') {
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${icons[type]}"></i>
    <p>${message}</p>
  `;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastSlide 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// START APP
// ============================================

init();
