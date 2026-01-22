/**
 * ============================================
 * CIVIC WATCHDOG - ARCHIVO 1: PRINCIPAL
 * Dashboard + API + Menú + Estructura
 * MOTOR: Gemini 2.5 Flash | v4.0
 * ============================================
 */

const MODELO = "gemini-2.5-flash";
const CAMARA_API_BASE = "https://opendata.camara.cl/wscamaradiputados.asmx";

const BOLETINES = {
  pensiones: [
    { id: "13648", titulo: "Retiro 10% AFP - Primer retiro" },
    { id: "14054", titulo: "Retiro 10% AFP - Segundo retiro" },
    { id: "14463", titulo: "Retiro 10% AFP - Tercer retiro" },
    { id: "15869", titulo: "Reforma de Pensiones 2024" }
  ],
  presupuesto: [
    { id: "15534", titulo: "Modernizacion Tributaria" },
    { id: "14570", titulo: "Proyecto de Ley Miscelanea" },
    { id: "15170", titulo: "Royalty Minero" }
  ],
  salud: [
    { id: "16621", titulo: "Reforma Isapres" },
    { id: "15135", titulo: "Ley Ricarte Soto" }
  ],
  seguridad: [
    { id: "16617", titulo: "Ley Nain-Retamal" },
    { id: "14614", titulo: "Reforma Carabineros" }
  ],
  educacion: [
    { id: "9885", titulo: "Fin al CAE" },
    { id: "12728", titulo: "Gratuidad universitaria" }
  ],
  trabajo: [
    { id: "11179", titulo: "40 horas laborales" },
    { id: "15198", titulo: "Reajuste salario minimo 2024" }
  ]
};

function getConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    GEMINI_API_KEY: props.getProperty('GEMINI_API_KEY') || '',
    JSON_SEARCH_API_KEY: props.getProperty('GOOGLE_SEARCH_API_KEY') || '',
    CX: props.getProperty('GOOGLE_SEARCH_CX') || ''
  };
}

function doGet(e) {
  var page = e.parameter.page || 'dashboard';
  if (page === 'api') return handleAPI(e);
  return HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('Civic Watchdog')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function handleAPI(e) {
  var action = e.parameter.action || '';
  var result = {};
  
  switch(action) {
    case 'stats':
    case 'estadisticas':
      result = getEstadisticasGenerales();
      break;
    case 'diputados':
      result = getDiputadosCompletos();
      break;
    case 'alertas':
      var diputados = getDiputadosCompletos();
      result = diputados.filter(function(d) { return d.alerta >= 5; }).slice(0, 10);
      break;
    case 'partidos':
    case 'estadisticasPartido':
      result = getEstadisticasPorPartidoCompleto();
      break;
    case 'diputadoDetalle':
      var id = e.parameter.id;
      var todos = getDiputadosCompletos();
      result = todos.find(function(d) { return d.dipId === id; }) || null;
      break;
    case 'proyectos':
    case 'proyectosLey':
      result = getProyectosLey(false);
      break;
    case 'proximasVotaciones':
      result = getProximasVotaciones();
      break;
    case 'datosElectorales':
      result = getEstadisticasElectorales();
      break;
    default:
      result = { error: 'Accion no valida', acciones: ['estadisticas', 'diputados', 'alertas', 'partidos', 'diputadoDetalle', 'proyectosLey', 'proximasVotaciones', 'datosElectorales'] };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Civic Watchdog')
    .addItem('Crear Estructura', 'setupCivicWatchdog')
    .addItem('Importar Diputados API', 'importarDiputadosAPI')
    .addSeparator()
    .addSubMenu(ui.createMenu('📋 Seguimiento Legislativo')
      .addItem('Actualizar Proyectos', 'actualizarProyectosLey')
      .addItem('Ver Próximas Votaciones', 'verProximasVotaciones'))
    .addSubMenu(ui.createMenu('Importar Votaciones')
      .addItem('Pensiones', 'importarVotacionesPensiones')
      .addItem('Presupuesto', 'importarVotacionesPresupuesto')
      .addItem('Salud', 'importarVotacionesSalud')
      .addItem('Seguridad', 'importarVotacionesSeguridad')
      .addItem('Educacion', 'importarVotacionesEducacion')
      .addItem('Trabajo', 'importarVotacionesTrabajo')
      .addSeparator()
      .addItem('TODAS', 'importarTodasVotacionesMenu'))
    .addItem('Calcular Asistencia', 'calcularAsistencia')
    .addSubMenu(ui.createMenu('Redes Sociales')
      .addItem('Extraer de un Diputado', 'extraerRedesDiputado')
      .addItem('Extraer de TODOS', 'extraerRedesTodos')
      .addItem('Test Nitter', 'testNitter'))
    .addSeparator()
    .addItem('Analisis Completo', 'runCivicWatchdog')
    .addItem('Analizar Diputado', 'analizarDiputadoEspecifico')
    .addItem('Ver Dashboard Web', 'abrirDashboard')
    .addSeparator()
    .addItem('Test APIs', 'testAPIs')
    .addItem('Activador Diario', 'crearActivadorDiario')
    .addToUi();
}

function importarVotacionesPensiones() { menuImportarCategoria('pensiones'); }
function importarVotacionesPresupuesto() { menuImportarCategoria('presupuesto'); }
function importarVotacionesSalud() { menuImportarCategoria('salud'); }
function importarVotacionesSeguridad() { menuImportarCategoria('seguridad'); }
function importarVotacionesEducacion() { menuImportarCategoria('educacion'); }
function importarVotacionesTrabajo() { menuImportarCategoria('trabajo'); }

function menuImportarCategoria(categoria) {
  var ui = SpreadsheetApp.getUi();
  ui.alert('Importando votaciones de ' + categoria + '...');
  var result = importarVotacionesCategoria(categoria);
  ui.alert('Listo: ' + (result.importados || 0) + ' votaciones importadas');
}

function importarTodasVotacionesMenu() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Confirmar', 'Importar votaciones de TODAS las categorias?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  ui.alert('Iniciando importacion...');
  var result = importarTodasLasVotaciones();
  ui.alert('Total: ' + result.total + ' votaciones importadas');
}

function abrirDashboard() {
  var url = ScriptApp.getService().getUrl();
  var html = '<script>window.open("' + url + '");google.script.host.close();</script>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setHeight(50), 'Abriendo...');
}

function getEstadisticasGenerales() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Analisis_IA');
    if (!sheet || sheet.getLastRow() <= 1) {
      return { totalDiputados: 155, alertasAltas: 0, contradicciones: 0, promedioAlerta: 0 };
    }
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
    var alertas = data.map(function(r) { return Number(r[4]) || 0; });
    var contradicciones = data.filter(function(r) { return r[6] && String(r[6]).length > 5; }).length;
    var alertasAltas = alertas.filter(function(a) { return a >= 7; }).length;
    var promedio = alertas.length > 0 ? alertas.reduce(function(a, b) { return a + b; }, 0) / alertas.length : 0;
    var configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
    var totalDiputados = configSheet ? Math.max(0, configSheet.getLastRow() - 1) : 155;
    return { totalDiputados: totalDiputados, alertasAltas: alertasAltas, contradicciones: contradicciones, promedioAlerta: Math.round(promedio * 10) / 10 };
  } catch (e) { return { error: e.toString() }; }
}

function getDiputadosConAlertas() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Analisis_IA');
    if (!sheet || sheet.getLastRow() <= 1) return [];
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
    var ultimosPorDip = {};
    data.forEach(function(row) {
      var nombre = row[1];
      if (!ultimosPorDip[nombre] || new Date(row[0]) > new Date(ultimosPorDip[nombre].fecha)) {
        ultimosPorDip[nombre] = { fecha: row[0], nombre: row[1], partido: row[2], sentimiento: row[3], alerta: Number(row[4]) || 0, resumen: row[5], contradicciones: row[6] ? String(row[6]).split(' | ') : [] };
      }
    });
    return Object.values(ultimosPorDip).sort(function(a, b) { return b.alerta - a.alerta; }).slice(0, 20);
  } catch (e) { return []; }
}

function getEstadisticasPorPartido() {
  try {
    var diputados = getDiputadosConAlertas();
    var porPartido = {};
    diputados.forEach(function(d) {
      if (!porPartido[d.partido]) porPartido[d.partido] = { alertas: [], count: 0 };
      porPartido[d.partido].alertas.push(d.alerta);
      porPartido[d.partido].count++;
    });
    return Object.entries(porPartido).map(function(entry) {
      var partido = entry[0], data = entry[1];
      return { partido: partido, promedio: Math.round((data.alertas.reduce(function(a, b) { return a + b; }, 0) / data.alertas.length) * 10) / 10, cantidad: data.count };
    }).sort(function(a, b) { return b.promedio - a.promedio; });
  } catch (e) { return []; }
}

function getBoletines() { return BOLETINES; }

function setupCivicWatchdog() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  createConfigSheet(ss);
  createAnalysisSheet(ss);
  createVotacionesSheet(ss);
  createVotacionesHistoricoSheet(ss);
  createRawLogSheet(ss);
  SpreadsheetApp.getUi().alert('Estructura creada (5 hojas)');
}

function createConfigSheet(ss) {
  var s = ss.getSheetByName('Config') || ss.insertSheet('Config');
  if (s.getLastRow() === 0) {
    var headers = ['Nombre', 'ID Diputado', 'Partido', 'Distrito', 'Correo', 'Twitter', 'Instagram', 'Facebook', 'TikTok', 'YouTube', 'Enfoque Digital', 'Palabra Clave'];
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.getRange(1, 1, 1, headers.length).setBackground('#1a73e8').setFontColor('#fff').setFontWeight('bold');
    s.setFrozenRows(1);
  }
}

function createAnalysisSheet(ss) {
  var s = ss.getSheetByName('Analisis_IA') || ss.insertSheet('Analisis_IA');
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, 8).setValues([['Fecha', 'Nombre', 'Partido', 'Sentimiento', 'Alerta', 'Resumen', 'Contradicciones', 'Votaciones']]);
    s.getRange(1, 1, 1, 8).setBackground('#34a853').setFontColor('#fff').setFontWeight('bold');
    s.setFrozenRows(1);
  }
}

function createVotacionesSheet(ss) {
  var s = ss.getSheetByName('Votaciones') || ss.insertSheet('Votaciones');
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, 7).setValues([['Fecha', 'Boletin', 'Titulo', 'ID Votacion', 'Tipo', 'Quorum', 'Resultado']]);
    s.getRange(1, 1, 1, 7).setBackground('#673ab7').setFontColor('#fff').setFontWeight('bold');
    s.setFrozenRows(1);
  }
}

function createVotacionesHistoricoSheet(ss) {
  var s = ss.getSheetByName('Votaciones_Historico') || ss.insertSheet('Votaciones_Historico');
  if (s.getLastRow() === 0) {
    var headers = ['Fecha Descarga', 'Boletin', 'Titulo Proyecto', 'Categoria', 'ID Diputado', 'Nombre Diputado', 'Partido', 'Voto', 'ID Votacion'];
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.getRange(1, 1, 1, headers.length).setBackground('#e65100').setFontColor('#fff').setFontWeight('bold');
    s.setFrozenRows(1);
  }
}

function createRawLogSheet(ss) {
  var s = ss.getSheetByName('Raw_Log') || ss.insertSheet('Raw_Log');
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, 4).setValues([['Timestamp', 'Fuente', 'Nombre', 'Datos']]);
    s.getRange(1, 1, 1, 4).setBackground('#9e9e9e').setFontColor('#fff').setFontWeight('bold');
    s.setFrozenRows(1);
  }
}

function getDiputadosCompletos() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var configSheet = ss.getSheetByName('Config');
    if (!configSheet || configSheet.getLastRow() <= 1) return [];
    var configData = configSheet.getDataRange().getValues();
    configData.shift();
    
    var analysisSheet = ss.getSheetByName('Analisis_IA');
    var analysisData = analysisSheet && analysisSheet.getLastRow() > 1 ? analysisSheet.getDataRange().getValues().slice(1) : [];
    
    var votSheet = ss.getSheetByName('Votaciones_Historico');
    var votData = votSheet && votSheet.getLastRow() > 1 ? votSheet.getDataRange().getValues().slice(1) : [];
    
    var analysisByName = {};
    analysisData.forEach(function(row) {
      var nombre = row[1];
      if (!analysisByName[nombre] || new Date(row[0]) > new Date(analysisByName[nombre].fecha)) {
        analysisByName[nombre] = { fecha: row[0], sentimiento: row[3], alerta: Number(row[4]) || 0, resumen: row[5], contradicciones: row[6] ? String(row[6]).split(' | ').filter(function(c) { return c.length > 3; }) : [] };
      }
    });
    
    var votosByDipId = {};
    votData.forEach(function(row) {
      var dipId = String(row[4]);
      if (!votosByDipId[dipId]) votosByDipId[dipId] = [];
      votosByDipId[dipId].push({ boletin: row[1], titulo: row[2], categoria: row[3], voto: row[7] || '' });
    });
    
    var diputados = configData.filter(function(r) { return r[0]; }).map(function(row) {
      var nombre = String(row[0]).trim();
      var dipId = String(row[1] || '');
      var partido = String(row[2] || 'N/A');
      var distrito = String(row[3] || '');
      var correo = String(row[4] || '');
      var twitter = String(row[5] || '');
      var instagram = String(row[6] || '');
      var facebook = String(row[7] || '');
      var tiktok = String(row[8] || '');
      var youtube = String(row[9] || '');
      var enfoqueDigital = String(row[10] || '');
      var palabraClave = String(row[11] || nombre);
      
      var analysis = analysisByName[nombre] || {};
      var votaciones = votosByDipId[dipId] || [];
      
      var asistencia = 0;
      if (votaciones.length > 0) {
        var presentes = votaciones.filter(function(v) {
          var voto = String(v.voto).toLowerCase();
          return voto.indexOf('afirmativo') >= 0 || voto.indexOf('negativo') >= 0 || voto.indexOf('absten') >= 0;
        }).length;
        asistencia = Math.round((presentes / votaciones.length) * 100);
      }
      
      return {
        nombre: nombre, dipId: dipId, partido: partido, distrito: distrito, correo: correo,
        redes: {
          twitter: twitter ? 'https://twitter.com/' + twitter.replace('@', '') : '',
          instagram: instagram ? 'https://instagram.com/' + instagram : '',
          facebook: facebook ? 'https://facebook.com/' + facebook : '',
          tiktok: tiktok ? 'https://tiktok.com/@' + tiktok : '',
          youtube: youtube || ''
        },
        enfoqueDigital: enfoqueDigital, palabraClave: palabraClave,
        sentimiento: analysis.sentimiento || 'neutral', alerta: analysis.alerta || 0, resumen: analysis.resumen || '',
        contradicciones: (analysis.contradicciones || []).length, contradiccionesDetalle: analysis.contradicciones || [],
        votaciones: votaciones.length, votacionesDetalle: votaciones.slice(0, 10), asistencia: asistencia
      };
    });
    
    return diputados.sort(function(a, b) { return b.alerta - a.alerta; });
  } catch (e) {
    Logger.log('Error getDiputadosCompletos: ' + e);
    return [];
  }
}

// Colores por partido para el frontend
var PARTY_COLORS = {
  'RN': '#1e40af', 'UDI': '#1e3a5f', 'PS': '#dc2626', 'PPD': '#f59e0b', 
  'PC': '#b91c1c', 'DC': '#16a34a', 'REP': '#0d47a1', 'EVOP': '#0891b2', 
  'FA': '#7c3aed', 'IND': '#6b7280', 'RD': '#ec4899', 'CS': '#0ea5e9',
  'PL': '#fbbf24', 'FRVS': '#84cc16', 'PDG': '#f97316', 'PRSD': '#ef4444'
};

function getEstadisticasPorPartidoCompleto() {
  try {
    var diputados = getDiputadosCompletos();
    var porPartido = {};
    
    diputados.forEach(function(d) {
      var p = d.partido || 'IND';
      if (!porPartido[p]) {
        porPartido[p] = { sigla: p, nombre: getNombrePartido(p), color: PARTY_COLORS[p] || '#6b7280', count: 0, alertas: [], asistencias: [] };
      }
      porPartido[p].count++;
      porPartido[p].alertas.push(d.alerta || 0);
      porPartido[p].asistencias.push(d.asistencia || 0);
    });
    
    return Object.values(porPartido).map(function(p) {
      var avgAlerta = p.alertas.length > 0 ? p.alertas.reduce(function(a, b) { return a + b; }, 0) / p.alertas.length : 0;
      var avgAsistencia = p.asistencias.length > 0 ? p.asistencias.reduce(function(a, b) { return a + b; }, 0) / p.asistencias.length : 0;
      return { sigla: p.sigla, nombre: p.nombre, color: p.color, count: p.count, alertaPromedio: Math.round(avgAlerta * 10) / 10, asistenciaPromedio: Math.round(avgAsistencia) };
    }).sort(function(a, b) { return b.count - a.count; });
  } catch (e) {
    Logger.log('Error getEstadisticasPorPartidoCompleto: ' + e);
    return [];
  }
}

function getNombrePartido(sigla) {
  var nombres = {
    'RN': 'Renovación Nacional', 'UDI': 'Unión Demócrata Independiente', 'PS': 'Partido Socialista',
    'PPD': 'Partido Por la Democracia', 'PC': 'Partido Comunista', 'DC': 'Democracia Cristiana',
    'REP': 'Republicanos', 'EVOP': 'Evópoli', 'FA': 'Frente Amplio', 'IND': 'Independiente',
    'RD': 'Revolución Democrática', 'CS': 'Convergencia Social', 'PL': 'Partido Liberal',
    'FRVS': 'Fed. Regionalista Verde Social', 'PDG': 'Partido de la Gente', 'PRSD': 'Partido Radical'
  };
  return nombres[sigla] || sigla;
}
