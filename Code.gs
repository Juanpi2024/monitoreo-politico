/**
 * ============================================
 * CIVIC WATCHDOG - Backend Web App
 * Dashboard + API para Google Sheets
 * MOTOR: Gemini 2.5 Flash | v4.0
 * ============================================
 */

const MODELO = "gemini-2.5-flash";
const CAMARA_API_BASE = "https://opendata.camara.cl/wscamaradiputados.asmx";

// Catálogo de boletines por categoría
const BOLETINES = {
  pensiones: [
    { id: "13648", titulo: "Retiro 10% AFP - Primer retiro" },
    { id: "14054", titulo: "Retiro 10% AFP - Segundo retiro" },
    { id: "14463", titulo: "Retiro 10% AFP - Tercer retiro" },
    { id: "15869", titulo: "Reforma de Pensiones 2024" }
  ],
  presupuesto: [
    { id: "15534", titulo: "Modernización Tributaria" },
    { id: "14570", titulo: "Proyecto de Ley Miscelánea" },
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
    { id: "15198", titulo: "Reajuste salario mínimo 2024" }
  ]
};

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    GEMINI_API_KEY: props.getProperty('GEMINI_API_KEY') || '',
    JSON_SEARCH_API_KEY: props.getProperty('GOOGLE_SEARCH_API_KEY') || '',
    CX: props.getProperty('GOOGLE_SEARCH_CX') || ''
  };
}

// ============================================
// WEB APP - Servir Dashboard
// ============================================
function doGet(e) {
  const page = e.parameter.page || 'dashboard';
  
  if (page === 'api') {
    return handleAPI(e);
  }
  
  return HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('Civic Watchdog')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function handleAPI(e) {
  const action = e.parameter.action;
  let result = {};
  
  switch(action) {
    case 'stats':
      result = getEstadisticasGenerales();
      break;
    case 'diputados':
      result = getDiputadosConAlertas();
      break;
    case 'partidos':
      result = getEstadisticasPorPartido();
      break;
    default:
      result = { error: 'Acción no válida' };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// MENÚ SHEETS
// ============================================
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔍 Civic Watchdog')
    .addItem('📋 Crear Estructura', 'setupCivicWatchdog')
    .addItem('👥 Importar Diputados (API)', 'importarDiputadosAPI')
    .addSeparator()
    .addSubMenu(ui.createMenu('🗳️ Importar Votaciones')
      .addItem('💰 Pensiones/AFP', 'importarVotacionesPensiones')
      .addItem('📊 Presupuesto', 'importarVotacionesPresupuesto')
      .addItem('🏥 Salud', 'importarVotacionesSalud')
      .addItem('👮 Seguridad', 'importarVotacionesSeguridad')
      .addItem('📚 Educación', 'importarVotacionesEducacion')
      .addItem('💼 Trabajo', 'importarVotacionesTrabajo')
      .addSeparator()
      .addItem('📥 TODAS las categorías', 'importarTodasVotacionesMenu'))
    .addItem('📊 Calcular Asistencia', 'calcularAsistencia')
    .addSubMenu(ui.createMenu('📱 Redes Sociales')
      .addItem('🔍 Extraer de un Diputado', 'extraerRedesDiputado')
      .addItem('📥 Extraer de TODOS (10)', 'extraerRedesTodos')
      .addItem('🧪 Test Nitter', 'testNitter'))
    .addSeparator()
    .addItem('▶️ Análisis Completo', 'runCivicWatchdog')
    .addItem('🎯 Analizar Diputado', 'analizarDiputadoEspecifico')
    .addItem('📊 Ver Dashboard Web', 'abrirDashboard')
    .addSeparator()
    .addItem('🧪 Test APIs', 'testAPIs')
    .addItem('⏰ Activador Diario', 'crearActivadorDiario')
    .addToUi();
}

// Funciones de menú para importar votaciones
function importarVotacionesPensiones() { menuImportarCategoria('pensiones'); }
function importarVotacionesPresupuesto() { menuImportarCategoria('presupuesto'); }
function importarVotacionesSalud() { menuImportarCategoria('salud'); }
function importarVotacionesSeguridad() { menuImportarCategoria('seguridad'); }
function importarVotacionesEducacion() { menuImportarCategoria('educacion'); }
function importarVotacionesTrabajo() { menuImportarCategoria('trabajo'); }

function menuImportarCategoria(categoria) {
  const ui = SpreadsheetApp.getUi();
  ui.alert('⏳ Importando votaciones de ' + categoria + '...\n\nEsto puede tomar unos segundos.');
  const result = importarVotacionesCategoria(categoria);
  ui.alert(`✅ ${result.importados || 0} votaciones importadas para ${categoria}`);
}

function importarTodasVotacionesMenu() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Confirmar', '¿Importar votaciones de TODAS las categorías?\nEsto puede tomar varios minutos.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  
  ui.alert('⏳ Iniciando importación...');
  const result = importarTodasLasVotaciones();
  ui.alert(`✅ Total: ${result.total} votaciones importadas`);
}

function abrirDashboard() {
  const url = ScriptApp.getService().getUrl();
  const html = `<script>window.open('${url}');google.script.host.close();</script>`;
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setHeight(50),
    'Abriendo Dashboard...'
  );
}

// ============================================
// API: Estadísticas
// ============================================
function getEstadisticasGenerales() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Analisis_IA');
    if (!sheet || sheet.getLastRow() <= 1) {
      return { totalDiputados: 155, alertasAltas: 0, contradicciones: 0, promedioAlerta: 0 };
    }
    
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
    const alertas = data.map(r => Number(r[4]) || 0);
    const contradicciones = data.filter(r => r[6] && String(r[6]).length > 5).length;
    const alertasAltas = alertas.filter(a => a >= 7).length;
    const promedio = alertas.length > 0 ? alertas.reduce((a, b) => a + b, 0) / alertas.length : 0;
    
    // Contar diputados únicos
    const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
    const totalDiputados = configSheet ? Math.max(0, configSheet.getLastRow() - 1) : 155;
    
    return {
      totalDiputados,
      alertasAltas,
      contradicciones,
      promedioAlerta: Math.round(promedio * 10) / 10
    };
  } catch (e) {
    return { error: e.toString() };
  }
}

function getDiputadosConAlertas() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Analisis_IA');
    if (!sheet || sheet.getLastRow() <= 1) return [];
    
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
    
    // Obtener último análisis de cada diputado
    const ultimosPorDip = {};
    data.forEach(row => {
      const nombre = row[1];
      if (!ultimosPorDip[nombre] || new Date(row[0]) > new Date(ultimosPorDip[nombre].fecha)) {
        ultimosPorDip[nombre] = {
          fecha: row[0],
          nombre: row[1],
          partido: row[2],
          sentimiento: row[3],
          alerta: Number(row[4]) || 0,
          resumen: row[5],
          contradicciones: row[6] ? String(row[6]).split(' | ') : []
        };
      }
    });
    
    // Ordenar por alerta descendente
    return Object.values(ultimosPorDip)
      .sort((a, b) => b.alerta - a.alerta)
      .slice(0, 20);
  } catch (e) {
    return [];
  }
}

function getEstadisticasPorPartido() {
  try {
    const diputados = getDiputadosConAlertas();
    const porPartido = {};
    
    diputados.forEach(d => {
      if (!porPartido[d.partido]) {
        porPartido[d.partido] = { alertas: [], count: 0 };
      }
      porPartido[d.partido].alertas.push(d.alerta);
      porPartido[d.partido].count++;
    });
    
    return Object.entries(porPartido).map(([partido, data]) => ({
      partido,
      promedio: Math.round((data.alertas.reduce((a, b) => a + b, 0) / data.alertas.length) * 10) / 10,
      cantidad: data.count
    })).sort((a, b) => b.promedio - a.promedio);
  } catch (e) {
    return [];
  }
}

function getBoletines() {
  return BOLETINES;
}

// ============================================
// EXTRACCIÓN DE DATOS DE REDES SOCIALES
// ============================================

// Instancias públicas de Nitter (proxy de Twitter)
const NITTER_INSTANCES = [
  'https://nitter.poast.org',
  'https://nitter.privacydev.net',
  'https://nitter.cz'
];

/**
 * Obtiene tweets recientes de un usuario usando Nitter
 */
function getTweetsFromNitter(username) {
  if (!username || username.trim() === '') return [];
  
  // Limpiar username
  username = username.replace('@', '').trim();
  const tweets = [];
  
  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `${instance}/${username}`;
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      if (response.getResponseCode() !== 200) continue;
      
      const html = response.getContentText();
      
      // Extraer tweets con regex
      const tweetPattern = /<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      const datePattern = /<span class="tweet-date"[^>]*>[\s\S]*?title="([^"]+)"/gi;
      
      let match;
      let count = 0;
      
      while ((match = tweetPattern.exec(html)) !== null && count < 10) {
        const tweetHtml = match[1];
        // Limpiar HTML
        const tweetText = tweetHtml
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (tweetText.length > 20) {
          tweets.push({
            text: tweetText.substring(0, 500),
            source: 'twitter',
            username: username,
            fecha: new Date().toISOString().split('T')[0]
          });
          count++;
        }
      }
      
      if (tweets.length > 0) break; // Éxito, salir del loop
      
    } catch (e) {
      Logger.log(`Error Nitter ${instance}: ${e.message}`);
      continue;
    }
  }
  
  return tweets;
}

/**
 * Busca menciones en Google usando Custom Search API
 */
function searchGoogleMentions(query, numResults = 5) {
  const config = getConfig();
  
  if (!config.JSON_SEARCH_API_KEY || !config.CX) {
    Logger.log('Google Search API no configurada');
    return [];
  }
  
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.googleapis.com/customsearch/v1?key=${config.JSON_SEARCH_API_KEY}&cx=${config.CX}&q=${encodedQuery}&num=${numResults}&dateRestrict=m1`;
    
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());
    
    if (data.items) {
      return data.items.map(item => ({
        titulo: item.title,
        snippet: item.snippet,
        url: item.link,
        fuente: new URL(item.link).hostname,
        fecha: data.queries?.request?.[0]?.dateRestrict || 'último mes'
      }));
    }
    
    return [];
  } catch (e) {
    Logger.log('Error Google Search: ' + e.message);
    return [];
  }
}

/**
 * Extrae datos de todas las fuentes para un diputado
 */
function extraerDatosRedes(dipId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  if (!configSheet) return { error: 'No hay hoja Config' };
  
  const data = configSheet.getDataRange().getValues();
  const headers = data[0];
  
  // Buscar diputado por ID
  const dipRow = data.find(row => String(row[1]) === String(dipId));
  if (!dipRow) return { error: 'Diputado no encontrado' };
  
  const nombre = dipRow[0];
  const partido = dipRow[2];
  const twitter = dipRow[5] ? dipRow[5].replace('@', '') : '';
  const palabraClave = dipRow[11] || nombre;
  
  const resultado = {
    nombre,
    partido,
    fuentes: [],
    totalMenciones: 0,
    extractedAt: new Date().toISOString()
  };
  
  // 1. Tweets de Nitter
  if (twitter) {
    const tweets = getTweetsFromNitter(twitter);
    if (tweets.length > 0) {
      resultado.fuentes.push({
        tipo: 'Twitter/Nitter',
        items: tweets,
        count: tweets.length
      });
      resultado.totalMenciones += tweets.length;
    }
  }
  
  // 2. Google Search - Nombre + Partido
  const searchQuery = `"${nombre}" "${partido}" Chile diputado`;
  const googleResults = searchGoogleMentions(searchQuery, 5);
  if (googleResults.length > 0) {
    resultado.fuentes.push({
      tipo: 'Google News',
      items: googleResults,
      count: googleResults.length
    });
    resultado.totalMenciones += googleResults.length;
  }
  
  // 3. Google Search - Palabras clave
  if (palabraClave && palabraClave !== nombre) {
    const keywordQuery = `"${nombre}" ${palabraClave}`;
    const keywordResults = searchGoogleMentions(keywordQuery, 3);
    if (keywordResults.length > 0) {
      resultado.fuentes.push({
        tipo: 'Temas Clave',
        items: keywordResults,
        count: keywordResults.length
      });
      resultado.totalMenciones += keywordResults.length;
    }
  }
  
  return resultado;
}

/**
 * Extrae datos de redes para todos los diputados y guarda en Raw_Log
 */
function extraerRedesTodos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  const rawLogSheet = ss.getSheetByName('Raw_Log');
  
  if (!configSheet || !rawLogSheet) {
    SpreadsheetApp.getUi().alert('❌ Faltan hojas Config o Raw_Log');
    return;
  }
  
  const data = configSheet.getDataRange().getValues();
  data.shift(); // Quitar headers
  
  let procesados = 0;
  const maxPorEjecucion = 10; // Límite para no exceder tiempo
  
  for (const row of data) {
    if (!row[0] || procesados >= maxPorEjecucion) break;
    
    const dipId = row[1];
    const nombre = row[0];
    const twitter = row[5];
    
    // Solo procesar si tiene Twitter configurado
    if (twitter) {
      try {
        const datos = extraerDatosRedes(dipId);
        
        if (datos.totalMenciones > 0) {
          // Guardar en Raw_Log
          rawLogSheet.appendRow([
            new Date(),
            'Redes Sociales',
            nombre,
            JSON.stringify(datos)
          ]);
          procesados++;
        }
        
        // Pausa para no saturar APIs
        Utilities.sleep(1500);
        
      } catch (e) {
        Logger.log(`Error extrayendo ${nombre}: ${e.message}`);
      }
    }
  }
  
  SpreadsheetApp.getUi().alert(`✅ Extracción completada\n\n${procesados} diputados procesados`);
  return procesados;
}

/**
 * Prepara texto de redes para análisis con Gemini
 */
function prepararTextoAnalisis(dipId) {
  const datos = extraerDatosRedes(dipId);
  
  if (!datos || datos.error) return '';
  
  let texto = `DATOS DE REDES SOCIALES DE ${datos.nombre} (${datos.partido}):\n\n`;
  
  datos.fuentes.forEach(fuente => {
    texto += `📌 ${fuente.tipo} (${fuente.count} items):\n`;
    
    fuente.items.forEach((item, i) => {
      if (item.text) {
        texto += `  ${i+1}. Tweet: "${item.text}"\n`;
      } else if (item.snippet) {
        texto += `  ${i+1}. [${item.fuente}] ${item.titulo}\n     "${item.snippet}"\n`;
      }
    });
    texto += '\n';
  });
  
  return texto;
}

/**
 * Menú: Extraer redes de un diputado específico
 */
function extraerRedesDiputado() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('ID del Diputado', 'Ingresa el ID del diputado:', ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() !== ui.Button.OK) return;
  
  const dipId = response.getResponseText().trim();
  const datos = extraerDatosRedes(dipId);
  
  if (datos.error) {
    ui.alert('❌ ' + datos.error);
    return;
  }
  
  let mensaje = `📊 Datos extraídos para ${datos.nombre}\n\n`;
  mensaje += `Total menciones: ${datos.totalMenciones}\n\n`;
  
  datos.fuentes.forEach(f => {
    mensaje += `• ${f.tipo}: ${f.count} items\n`;
  });
  
  ui.alert(mensaje);
}

/**
 * Test de conexión a Nitter
 */
function testNitter() {
  const ui = SpreadsheetApp.getUi();
  const testUser = 'gabrielboric'; // Usuario de prueba conocido
  
  ui.alert('⏳ Probando conexión a Nitter...\n\nEsto puede tomar unos segundos.');
  
  const tweets = getTweetsFromNitter(testUser);
  
  if (tweets.length > 0) {
    let mensaje = `✅ Nitter funcionando!\n\n`;
    mensaje += `Usuario de prueba: @${testUser}\n`;
    mensaje += `Tweets encontrados: ${tweets.length}\n\n`;
    mensaje += `Último tweet:\n"${tweets[0].text.substring(0, 200)}..."`;
    ui.alert(mensaje);
  } else {
    ui.alert('⚠️ No se pudieron obtener tweets.\n\nLas instancias de Nitter pueden estar:\n• Temporalmente caídas\n• Bloqueando solicitudes\n• Requiriendo CAPTCHA\n\nIntenta más tarde o usa solo Google Search.');
  }
}

// Obtener datos completos de diputados para el Dashboard
function getDiputadosCompletos() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Obtener diputados de Config
    const configSheet = ss.getSheetByName('Config');
    if (!configSheet || configSheet.getLastRow() <= 1) return [];
    const configData = configSheet.getDataRange().getValues();
    configData.shift();
    
    // 2. Obtener análisis
    const analysisSheet = ss.getSheetByName('Analisis_IA');
    const analysisData = analysisSheet && analysisSheet.getLastRow() > 1 
      ? analysisSheet.getDataRange().getValues().slice(1) 
      : [];
    
    // 3. Obtener votaciones históricas
    const votSheet = ss.getSheetByName('Votaciones_Historico');
    const votData = votSheet && votSheet.getLastRow() > 1 
      ? votSheet.getDataRange().getValues().slice(1) 
      : [];
    
    // Indexar análisis por nombre
    const analysisByName = {};
    analysisData.forEach(row => {
      const nombre = row[1];
      if (!analysisByName[nombre] || new Date(row[0]) > new Date(analysisByName[nombre].fecha)) {
        analysisByName[nombre] = {
          fecha: row[0],
          sentimiento: row[3],
          alerta: Number(row[4]) || 0,
          resumen: row[5],
          contradicciones: row[6] ? String(row[6]).split(' | ').filter(c => c.length > 3) : []
        };
      }
    });
    
    // Indexar votaciones por ID diputado
    const votosByDipId = {};
    votData.forEach(row => {
      const dipId = String(row[4]);
      if (!votosByDipId[dipId]) votosByDipId[dipId] = [];
      votosByDipId[dipId].push({
        boletin: row[1],
        titulo: row[2],
        categoria: row[3],
        voto: row[7] || ''
      });
    });
    
    // Construir datos completos
    const diputados = configData.filter(r => r[0]).map(row => {
      const nombre = String(row[0]).trim();
      const dipId = String(row[1] || '');
      const partido = String(row[2] || 'N/A');
      const distrito = String(row[3] || '');
      const correo = String(row[4] || '');
      const twitter = String(row[5] || '');
      const instagram = String(row[6] || '');
      const facebook = String(row[7] || '');
      const tiktok = String(row[8] || '');
      const youtube = String(row[9] || '');
      const enfoqueDigital = String(row[10] || '');
      const palabraClave = String(row[11] || nombre);
      
      const analysis = analysisByName[nombre] || {};
      const votaciones = votosByDipId[dipId] || [];
      
      // Calcular asistencia
      let asistencia = 0;
      if (votaciones.length > 0) {
        const presentes = votaciones.filter(v => {
          const voto = String(v.voto).toLowerCase();
          return voto.includes('afirmativo') || voto.includes('negativo') || voto.includes('absten');
        }).length;
        asistencia = Math.round((presentes / votaciones.length) * 100);
      }
      
      return {
        nombre,
        dipId,
        partido,
        distrito,
        correo,
        redes: {
          twitter: twitter ? `https://twitter.com/${twitter.replace('@', '')}` : '',
          instagram: instagram ? `https://instagram.com/${instagram}` : '',
          facebook: facebook ? `https://facebook.com/${facebook}` : '',
          tiktok: tiktok ? `https://tiktok.com/@${tiktok}` : '',
          youtube: youtube || ''
        },
        enfoqueDigital,
        palabraClave,
        sentimiento: analysis.sentimiento || 'neutral',
        alerta: analysis.alerta || 0,
        resumen: analysis.resumen || '',
        contradicciones: (analysis.contradicciones || []).length,
        contradiccionesDetalle: analysis.contradicciones || [],
        votaciones: votaciones.length,
        votacionesDetalle: votaciones.slice(0, 10),
        asistencia
      };
    });
    
    // Ordenar por alerta descendente
    return diputados.sort((a, b) => b.alerta - a.alerta);
  } catch (e) {
    Logger.log('Error getDiputadosCompletos: ' + e);
    return [];
  }
}

// ============================================
// ESTRUCTURA SHEETS
// ============================================
function setupCivicWatchdog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  createConfigSheet(ss);
  createAnalysisSheet(ss);
  createVotacionesSheet(ss);
  createVotacionesHistoricoSheet(ss);
  createRawLogSheet(ss);
  SpreadsheetApp.getUi().alert('✅ Estructura creada (5 hojas)');
}

function createConfigSheet(ss) {
  let s = ss.getSheetByName('Config') || ss.insertSheet('Config');
  if (s.getLastRow() === 0) {
    const headers = [
      'Nombre',           // A
      'ID Diputado',      // B
      'Partido',          // C
      'Distrito',         // D
      'Correo',           // E
      'Twitter',          // F
      'Instagram',        // G
      'Facebook',         // H
      'TikTok',           // I
      'YouTube',          // J
      'Enfoque Digital',  // K
      'Palabra Clave'     // L
    ];
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.getRange(1, 1, 1, headers.length).setBackground('#1a73e8').setFontColor('#fff').setFontWeight('bold');
    s.setFrozenRows(1);
    s.setColumnWidths(1, 1, 200); // Nombre
    s.setColumnWidths(3, 1, 80);  // Partido
    s.setColumnWidths(4, 1, 60);  // Distrito
    s.setColumnWidths(5, 1, 200); // Correo
    s.setColumnWidths(6, 4, 150); // Redes
  }
}

function createAnalysisSheet(ss) {
  let s = ss.getSheetByName('Analisis_IA') || ss.insertSheet('Analisis_IA');
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, 8).setValues([['Fecha', 'Nombre', 'Partido', 'Sentimiento', 'Alerta', 'Resumen', 'Contradicciones', 'Votaciones']]);
    s.getRange(1, 1, 1, 8).setBackground('#34a853').setFontColor('#fff').setFontWeight('bold');
    s.setFrozenRows(1);
  }
}

function createVotacionesSheet(ss) {
  let s = ss.getSheetByName('Votaciones') || ss.insertSheet('Votaciones');
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, 7).setValues([['Fecha', 'Boletín', 'Título', 'ID Votación', 'Tipo', 'Quorum', 'Resultado']]);
    s.getRange(1, 1, 1, 7).setBackground('#673ab7').setFontColor('#fff').setFontWeight('bold');
    s.setFrozenRows(1);
  }
}

function createRawLogSheet(ss) {
  let s = ss.getSheetByName('Raw_Log') || ss.insertSheet('Raw_Log');
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, 4).setValues([['Timestamp', 'Fuente', 'Nombre', 'Datos']]);
    s.getRange(1, 1, 1, 4).setBackground('#9e9e9e').setFontColor('#fff').setFontWeight('bold');
    s.setFrozenRows(1);
  }
}

function createVotacionesHistoricoSheet(ss) {
  let s = ss.getSheetByName('Votaciones_Historico') || ss.insertSheet('Votaciones_Historico');
  if (s.getLastRow() === 0) {
    const headers = [
      'Fecha Descarga',     // A: Cuando se descargó
      'Boletín',            // B: Número de boletín
      'Título Proyecto',    // C: Nombre del proyecto
      'Categoría',          // D: Pensiones, Presupuesto, etc.
      'ID Diputado',        // E: ID del diputado
      'Nombre Diputado',    // F: Nombre completo
      'Partido',            // G: Partido político
      'Voto',               // H: A FAVOR, EN CONTRA, ABSTENCION, AUSENTE
      'ID Votación'         // I: ID de la votación específica
    ];
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.getRange(1, 1, 1, headers.length).setBackground('#e91e63').setFontColor('#fff').setFontWeight('bold');
    s.setFrozenRows(1);
    s.setColumnWidth(1, 120);
    s.setColumnWidth(2, 80);
    s.setColumnWidth(3, 250);
    s.setColumnWidth(4, 100);
    s.setColumnWidth(5, 80);
    s.setColumnWidth(6, 180);
    s.setColumnWidth(7, 80);
    s.setColumnWidth(8, 100);
  }
}

// ============================================
// IMPORTAR VOTACIONES POR CATEGORÍA
// ============================================
function importarVotacionesCategoria(categoria) {
  if (!BOLETINES[categoria]) return { error: 'Categoría no válida' };
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Votaciones_Historico');
  if (!sheet) {
    createVotacionesHistoricoSheet(ss);
    sheet = ss.getSheetByName('Votaciones_Historico');
  }
  
  // Obtener diccionario de diputados
  const diputados = getDiputadosDiccionario();
  
  let totalImportados = 0;
  const boletines = BOLETINES[categoria];
  
  for (const bol of boletines) {
    Logger.log(`Procesando boletín ${bol.id}: ${bol.titulo}`);
    
    // Verificar si ya existe este boletín
    const existentes = sheet.getDataRange().getValues();
    const yaExiste = existentes.some(row => String(row[1]) === bol.id);
    if (yaExiste) {
      Logger.log(`Boletín ${bol.id} ya importado, saltando...`);
      continue;
    }
    
    // Obtener votaciones de este boletín
    const votaciones = getVotacionesBoletin(bol.id);
    if (votaciones.length === 0) continue;
    
    // Procesar primera votación (la más relevante)
    const votacionId = votaciones[0].id;
    const detalles = getVotacionDetalle(votacionId);
    
    const filas = [];
    for (const det of detalles) {
      const dip = diputados[det.dipId] || { nombre: 'Desconocido', partido: 'N/A' };
      filas.push([
        new Date(),
        bol.id,
        bol.titulo,
        categoria,
        det.dipId,
        dip.nombre,
        dip.partido,
        det.voto,
        votacionId
      ]);
    }
    
    if (filas.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, filas.length, 9).setValues(filas);
      totalImportados += filas.length;
    }
    
    Utilities.sleep(500); // Respetar rate limits
  }
  
  return { categoria, importados: totalImportados };
}

function importarTodasLasVotaciones() {
  const categorias = Object.keys(BOLETINES);
  let total = 0;
  
  for (const cat of categorias) {
    const result = importarVotacionesCategoria(cat);
    total += result.importados || 0;
    Logger.log(`${cat}: ${result.importados || 0} votaciones`);
  }
  
  return { total };
}

// Obtener diccionario de diputados para mapear ID -> nombre
function getDiputadosDiccionario() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  if (!sheet) return {};
  
  const data = sheet.getDataRange().getValues();
  data.shift();
  
  const dict = {};
  data.forEach(row => {
    if (row[1]) { // ID Diputado
      dict[String(row[1])] = {
        nombre: String(row[0]).trim(),
        partido: String(row[4] || 'N/A').trim()
      };
    }
  });
  return dict;
}

// ============================================
// CÁLCULO DE ASISTENCIA (basado en votaciones)
// ============================================
function calcularAsistencia() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Votaciones_Historico');
  if (!sheet || sheet.getLastRow() <= 1) {
    SpreadsheetApp.getUi().alert('❌ No hay datos en Votaciones_Historico');
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  data.shift(); // Quitar headers
  
  // Obtener todos los diputados de Config
  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  const configData = configSheet.getDataRange().getValues();
  configData.shift();
  const totalDiputados = configData.filter(r => r[0]).length;
  
  // Agrupar por boletín para contar votaciones totales
  const votacionesPorBoletin = {};
  const asistenciaPorDiputado = {};
  
  data.forEach(row => {
    const boletin = row[1];
    const dipId = String(row[4]);
    const nombre = row[5];
    const partido = row[6];
    const voto = String(row[7] || '').toLowerCase();
    
    // Contar votaciones por boletín
    if (!votacionesPorBoletin[boletin]) {
      votacionesPorBoletin[boletin] = { total: 0, votaron: 0 };
    }
    votacionesPorBoletin[boletin].total++;
    
    // Verificar si votó (no ausente/pareo)
    const votoEfectivo = voto.includes('afirmativo') || voto.includes('negativo') || 
                         voto.includes('absten') || voto.includes('favor') || voto.includes('contra');
    
    // Asistencia por diputado
    if (!asistenciaPorDiputado[dipId]) {
      asistenciaPorDiputado[dipId] = {
        nombre: nombre,
        partido: partido,
        votaciones: 0,
        presente: 0,
        ausente: 0
      };
    }
    
    asistenciaPorDiputado[dipId].votaciones++;
    if (votoEfectivo) {
      asistenciaPorDiputado[dipId].presente++;
    } else {
      asistenciaPorDiputado[dipId].ausente++;
    }
  });
  
  // Calcular porcentajes y crear hoja de resultados
  const totalVotaciones = Object.keys(votacionesPorBoletin).length;
  
  // Crear o limpiar hoja Asistencia
  let asistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Asistencia');
  if (!asistSheet) {
    asistSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Asistencia');
  } else {
    asistSheet.clear();
  }
  
  // Headers
  asistSheet.getRange(1, 1, 1, 7).setValues([[
    'Nombre', 'Partido', 'Votaciones Posibles', 'Votó', 'Ausente/Pareo', '% Asistencia', 'Ranking'
  ]]);
  asistSheet.getRange(1, 1, 1, 7).setBackground('#4CAF50').setFontColor('#fff').setFontWeight('bold');
  
  // Datos ordenados por asistencia
  const resultados = Object.values(asistenciaPorDiputado)
    .map(d => {
      const pctAsistencia = d.votaciones > 0 ? Math.round((d.presente / d.votaciones) * 100) : 0;
      return {
        nombre: d.nombre,
        partido: d.partido,
        votaciones: d.votaciones,
        presente: d.presente,
        ausente: d.ausente,
        pctAsistencia: pctAsistencia
      };
    })
    .sort((a, b) => b.pctAsistencia - a.pctAsistencia);
  
  // Escribir datos con ranking
  const filas = resultados.map((r, i) => [
    r.nombre, r.partido, r.votaciones, r.presente, r.ausente, r.pctAsistencia + '%', i + 1
  ]);
  
  if (filas.length > 0) {
    asistSheet.getRange(2, 1, filas.length, 7).setValues(filas);
    
    // Formato condicional para % asistencia
    const rango = asistSheet.getRange(2, 6, filas.length, 1);
    
    // Color verde para alta asistencia, rojo para baja
    const reglaAlta = SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('100%')
      .setBackground('#c8e6c9')
      .setRanges([rango])
      .build();
    
    const reglaBaja = SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('0%')
      .setBackground('#ffcdd2')
      .setRanges([rango])
      .build();
    
    asistSheet.setConditionalFormatRules([reglaAlta, reglaBaja]);
  }
  
  asistSheet.setFrozenRows(1);
  asistSheet.autoResizeColumns(1, 7);
  
  SpreadsheetApp.getUi().alert(
    `✅ Asistencia calculada\n\n` +
    `📊 ${resultados.length} diputados analizados\n` +
    `🗳️ ${totalVotaciones} votaciones diferentes\n\n` +
    `Ver hoja "Asistencia" para resultados`
  );
  
  return resultados;
}

// Función para obtener asistencia de un diputado específico
function getAsistenciaDiputado(dipId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Votaciones_Historico');
  if (!sheet || sheet.getLastRow() <= 1) return null;
  
  const data = sheet.getDataRange().getValues();
  data.shift();
  
  const votosDelDip = data.filter(row => String(row[4]) === String(dipId));
  if (votosDelDip.length === 0) return null;
  
  let presente = 0;
  votosDelDip.forEach(row => {
    const voto = String(row[7] || '').toLowerCase();
    if (voto.includes('afirmativo') || voto.includes('negativo') || voto.includes('absten')) {
      presente++;
    }
  });
  
  return {
    total: votosDelDip.length,
    presente: presente,
    porcentaje: Math.round((presente / votosDelDip.length) * 100)
  };
}

// ============================================
// ESTADÍSTICAS DE VOTACIONES
// ============================================
function getEstadisticasVotaciones(categoria) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Votaciones_Historico');
  if (!sheet || sheet.getLastRow() <= 1) return { error: 'Sin datos de votaciones' };
  
  const data = sheet.getDataRange().getValues();
  data.shift(); // Quitar headers
  
  // Filtrar por categoría si se especifica
  const filtrados = categoria && categoria !== 'todos'
    ? data.filter(row => row[3] === categoria)
    : data;
  
  // Agrupar por partido
  const porPartido = {};
  filtrados.forEach(row => {
    const partido = row[6] || 'N/A';
    const voto = row[7];
    
    if (!porPartido[partido]) {
      porPartido[partido] = { aFavor: 0, enContra: 0, abstencion: 0, ausente: 0, total: 0 };
    }
    
    if (voto.includes('FAVOR') || voto.includes('favor') || voto === 'Si') porPartido[partido].aFavor++;
    else if (voto.includes('CONTRA') || voto.includes('contra') || voto === 'No') porPartido[partido].enContra++;
    else if (voto.includes('ABST') || voto.includes('abst')) porPartido[partido].abstencion++;
    else porPartido[partido].ausente++;
    
    porPartido[partido].total++;
  });
  
  // Calcular porcentajes
  const resultado = Object.entries(porPartido).map(([partido, stats]) => ({
    partido,
    aFavor: stats.aFavor,
    enContra: stats.enContra,
    abstencion: stats.abstencion,
    ausente: stats.ausente,
    total: stats.total,
    pctAFavor: Math.round((stats.aFavor / stats.total) * 100)
  })).sort((a, b) => b.pctAFavor - a.pctAFavor);
  
  return {
    categoria: categoria || 'todos',
    totalVotos: filtrados.length,
    porPartido: resultado
  };
}

function getVotacionesDiputadoHistorico(dipId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Votaciones_Historico');
  if (!sheet || sheet.getLastRow() <= 1) return [];
  
  const data = sheet.getDataRange().getValues();
  data.shift();
  
  return data
    .filter(row => String(row[4]) === String(dipId))
    .map(row => ({
      boletin: row[1],
      titulo: row[2],
      categoria: row[3],
      voto: row[7]
    }));
}
function importarDiputadosAPI() {
  try {
    const url = `${CAMARA_API_BASE}/getDiputados_Vigentes`;
    const res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    const doc = XmlService.parse(res.getContentText());
    const root = doc.getRootElement();
    const ns = root.getNamespace();
    const dips = root.getChildren('Diputado', ns);
    
    const datos = dips.map(d => [
      `${d.getChildText('Nombre', ns) || ''} ${d.getChildText('Apellido_Paterno', ns) || ''} ${d.getChildText('Apellido_Materno', ns) || ''}`.trim(),
      d.getChildText('DIPID', ns) || '', '', '', ''
    ]);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('Config');
    if (!s) { setupCivicWatchdog(); s = ss.getSheetByName('Config'); }
    if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, 5).clear();
    if (datos.length > 0) s.getRange(2, 1, datos.length, 5).setValues(datos);
    
    SpreadsheetApp.getUi().alert(`✅ ${datos.length} diputados importados`);
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ ' + e.toString());
  }
}

// ============================================
// ANÁLISIS PRINCIPAL
// ============================================
function runCivicWatchdog() {
  return runCivicWatchdogInterno(false);
}

// Versión para llamar desde Web App
function runCivicWatchdogWeb() {
  return runCivicWatchdogInterno(true);
}

function runCivicWatchdogInterno(desdeWeb) {
  const CONFIG = getConfig();
  if (!CONFIG.GEMINI_API_KEY) {
    return { error: 'Falta GEMINI_API_KEY', ok: 0, total: 0 };
  }
  
  const targets = getTrackingTargets();
  if (targets.length === 0) {
    return { error: 'Sin diputados en Config', ok: 0, total: 0 };
  }
  
  // Solo mostrar confirmación si NO es desde web y hay muchos
  if (!desdeWeb && targets.length > 5) {
    try {
      const ui = SpreadsheetApp.getUi();
      if (ui.alert('Confirmar', `Analizar ${targets.length} diputados?`, ui.ButtonSet.YES_NO) !== ui.Button.YES) {
        return { error: 'Cancelado', ok: 0, total: targets.length };
      }
    } catch (e) {
      // Si falla getUi, continuar sin confirmar
    }
  }
  
  let ok = 0;
  const maxAnalizar = desdeWeb ? Math.min(targets.length, 10) : targets.length; // Limitar desde web
  
  for (let i = 0; i < maxAnalizar; i++) {
    const t = targets[i];
    try {
      Logger.log(`[${i+1}/${maxAnalizar}] ${t.nombre}`);
      const news = fetchSocialListening(t.nombre, t.palabra_clave);
      Utilities.sleep(1500);
      let votesInfo = '';
      if (t.id_diputado) {
        const votos = getVotacionesDiputado(t.id_diputado, 2);
        votesInfo = votos.map(v => `${v.boletin}: ${v.voto}`).join(', ');
      }
      const result = analyzeWithGemini(t.nombre, t.partido, votesInfo, news);
      storeInsights(t.nombre, t.partido, result, votesInfo);
      ok++;
    } catch (e) { 
      Logger.log(`Error: ${e}`); 
    }
  }
  
  // Mostrar alert solo si es desde Sheets
  if (!desdeWeb) {
    try {
      SpreadsheetApp.getUi().alert(`✅ ${ok}/${maxAnalizar} completados`);
    } catch (e) {}
  }
  
  return { ok, total: maxAnalizar, error: null };
}

function analizarDiputadoEspecifico() {
  const ui = SpreadsheetApp.getUi();
  const CONFIG = getConfig();
  if (!CONFIG.GEMINI_API_KEY) { ui.alert('❌ Falta GEMINI_API_KEY'); return; }
  
  const resp = ui.prompt('Nombre del diputado:');
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  
  const buscar = resp.getResponseText().toLowerCase();
  const target = getTrackingTargets().find(t => t.nombre.toLowerCase().includes(buscar));
  if (!target) { ui.alert('❌ No encontrado'); return; }
  
  const news = fetchSocialListening(target.nombre, target.palabra_clave);
  let votesInfo = '';
  if (target.id_diputado) {
    const votos = getVotacionesDiputado(target.id_diputado, 3);
    votesInfo = votos.map(v => `${v.boletin}: ${v.voto}`).join('\n');
  }
  const result = analyzeWithGemini(target.nombre, target.partido, votesInfo, news);
  storeInsights(target.nombre, target.partido, result, votesInfo);
  
  ui.alert(`✅ ${target.nombre}\n\n🎭 ${result.sentimiento}\n🚨 ${result.nivel_alerta}\n📝 ${result.resumen}`);
}

function getTrackingTargets() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  if (!s) return [];
  const data = s.getDataRange().getValues();
  data.shift();
  return data.filter(r => r[0]).map(r => ({
    nombre: String(r[0]).trim(),
    id_diputado: String(r[1] || ''),
    twitter: String(r[2] || ''),
    palabra_clave: String(r[3] || ''),
    partido: String(r[4] || 'N/A')
  }));
}

// ============================================
// VOTACIONES
// ============================================
function getVotacionesBoletin(boletin) {
  try {
    const url = `${CAMARA_API_BASE}/getVotaciones_Boletin?prmBoletin=${encodeURIComponent(boletin)}`;
    const xml = UrlFetchApp.fetch(url, {muteHttpExceptions: true}).getContentText();
    const ids = xml.match(/<ID>(\d+)<\/ID>/g) || [];
    return ids.map(m => ({ id: m.replace(/<\/?ID>/g, '') }));
  } catch (e) { return []; }
}

function getVotacionDetalle(votacionId) {
  try {
    const url = `${CAMARA_API_BASE}/getVotacion_Detalle?prmVotacionID=${votacionId}`;
    const response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    const xml = response.getContentText();
    
    // Usar XmlService para parsing
    const doc = XmlService.parse(xml);
    const root = doc.getRootElement();
    const ns = root.getNamespace();
    
    // Buscar el contenedor Votos -> Voto
    const votosContainer = root.getChild('Votos', ns);
    if (!votosContainer) {
      Logger.log('No se encontró contenedor Votos');
      return [];
    }
    
    const votos = votosContainer.getChildren('Voto', ns);
    
    return votos.map(v => {
      // DIPID está dentro de Diputado
      const diputado = v.getChild('Diputado', ns);
      const dipId = diputado ? diputado.getChildText('DIPID', ns) : '';
      
      // El voto está en <Opcion>
      const opcion = v.getChild('Opcion', ns);
      const votoTexto = opcion ? opcion.getText() : '';
      
      return {
        dipId: dipId,
        voto: votoTexto
      };
    });
  } catch (e) {
    Logger.log('Error getVotacionDetalle: ' + e);
    // Fallback con regex para la estructura conocida
    try {
      const url = `${CAMARA_API_BASE}/getVotacion_Detalle?prmVotacionID=${votacionId}`;
      const xml = UrlFetchApp.fetch(url, {muteHttpExceptions: true}).getContentText();
      
      const resultados = [];
      // Buscar cada bloque <Voto>...</Voto>
      const votoRegex = /<Voto>[\s\S]*?<DIPID>(\d+)<\/DIPID>[\s\S]*?<Opcion[^>]*>([^<]+)<\/Opcion>[\s\S]*?<\/Voto>/g;
      
      let match;
      while ((match = votoRegex.exec(xml)) !== null) {
        resultados.push({
          dipId: match[1],
          voto: match[2]
        });
      }
      
      return resultados;
    } catch (e2) {
      Logger.log('Error fallback: ' + e2);
      return [];
    }
  }
}

function getVotacionesDiputado(dipId, max = 5) {
  const boletines = Object.values(BOLETINES).flat().map(b => b.id).slice(0, 10);
  const resultados = [];
  
  for (const bol of boletines) {
    const votaciones = getVotacionesBoletin(bol);
    for (const v of votaciones) {
      const detalle = getVotacionDetalle(v.id);
      const voto = detalle.find(d => d.dipId === String(dipId));
      if (voto) {
        resultados.push({ boletin: bol, voto: voto.voto });
        break;
      }
    }
    if (resultados.length >= max) break;
    Utilities.sleep(300);
  }
  return resultados;
}

// ============================================
// SOCIAL LISTENING
// ============================================
function fetchSocialListening(nombre, palabraClave) {
  const CONFIG = getConfig();
  
  if (CONFIG.JSON_SEARCH_API_KEY && CONFIG.CX) {
    try {
      const q = `${nombre} ${palabraClave || ''} diputado Chile`;
      const url = `https://www.googleapis.com/customsearch/v1?key=${CONFIG.JSON_SEARCH_API_KEY}&cx=${CONFIG.CX}&q=${encodeURIComponent(q)}&num=5`;
      const data = JSON.parse(UrlFetchApp.fetch(url, {muteHttpExceptions: true}).getContentText());
      if (data.items) return data.items.map(i => `• ${i.title}`).join('\n');
    } catch (e) {}
  }
  
  // Fallback: Google News RSS
  const q = `${nombre} ${palabraClave || ''}`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' Chile')}&hl=es-419&gl=CL&ceid=CL:es-419`;
  try {
    const xml = UrlFetchApp.fetch(url, {muteHttpExceptions: true}).getContentText();
    const matches = xml.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/g) || [];
    return matches.slice(1, 6).map(m => '• ' + m.replace(/<title><!\[CDATA\[|\]\]><\/title>/g, '')).join('\n');
  } catch (e) { return 'Sin noticias'; }
}

// ============================================
// GEMINI ANALYSIS
// ============================================
function analyzeWithGemini(nombre, partido, votaciones, noticias) {
  const CONFIG = getConfig();
  
  const prompt = `Analiza la coherencia del diputado chileno:

DIPUTADO: ${nombre} (${partido})

VOTACIONES:
${votaciones || 'Sin datos'}

NOTICIAS:
${noticias || 'Sin datos'}

JSON respuesta:
{"sentimiento":"positivo|negativo|neutral","nivel_alerta":1-10,"resumen":"texto breve","contradicciones_detectadas":["item"]}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    const res = UrlFetchApp.fetch(url, { 
      method: 'POST', 
      contentType: 'application/json', 
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
      }),
      muteHttpExceptions: true
    });
    const json = JSON.parse(res.getContentText());
    return JSON.parse(json.candidates[0].content.parts[0].text);
  } catch (e) {
    return { sentimiento: 'error', nivel_alerta: 0, resumen: e.toString(), contradicciones_detectadas: [] };
  }
}

// ============================================
// STORAGE
// ============================================
function storeInsights(nombre, partido, data, votaciones) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Analisis_IA');
  if (!s) return;
  const contras = Array.isArray(data.contradicciones_detectadas) ? data.contradicciones_detectadas.join(' | ') : '';
  s.appendRow([new Date(), nombre, partido, data.sentimiento, data.nivel_alerta, data.resumen, contras, votaciones]);
}

// ============================================
// TESTS & TRIGGERS
// ============================================
function testAPIs() {
  const ui = SpreadsheetApp.getUi();
  const CONFIG = getConfig();
  let msg = '🧪 TEST DE APIs\n\n';
  
  msg += CONFIG.GEMINI_API_KEY ? '✅ Gemini: OK\n' : '❌ Gemini: Falta API Key\n';
  
  try {
    UrlFetchApp.fetch(`${CAMARA_API_BASE}/getDiputados_Vigentes`, {muteHttpExceptions: true});
    msg += '✅ Cámara: OK\n';
  } catch (e) { msg += '❌ Cámara: Error\n'; }
  
  ui.alert(msg);
}

function crearActivadorDiario() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runCivicWatchdog') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runCivicWatchdog').timeBased().everyDays(1).atHour(8).create();
  SpreadsheetApp.getUi().alert('✅ Activador 8:00 AM diario');
}

// Función de debug para ver estructura del XML
function testVotacionXML() {
  const ui = SpreadsheetApp.getUi();
  
  // Usar un boletín conocido
  const boletin = '15869'; // Reforma Pensiones
  
  // Obtener votaciones del boletín
  const votaciones = getVotacionesBoletin(boletin);
  if (votaciones.length === 0) {
    ui.alert('No se encontraron votaciones para el boletín ' + boletin);
    return;
  }
  
  const votacionId = votaciones[0].id;
  const url = `${CAMARA_API_BASE}/getVotacion_Detalle?prmVotacionID=${votacionId}`;
  const xml = UrlFetchApp.fetch(url, {muteHttpExceptions: true}).getContentText();
  
  // Mostrar primeros 2000 caracteres del XML
  Logger.log('URL: ' + url);
  Logger.log('XML (primeros 2000 chars):');
  Logger.log(xml.substring(0, 2000));
  
  // Buscar todos los tags únicos
  const tags = xml.match(/<[A-Za-z_]+>/g) || [];
  const uniqueTags = [...new Set(tags)];
  
  ui.alert('🔍 DEBUG\n\nVotación ID: ' + votacionId + '\nTags encontrados:\n' + uniqueTags.slice(0, 15).join(', ') + '\n\nVer Logs para XML completo');
}
