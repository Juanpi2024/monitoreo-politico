/**
 * ============================================
 * CIVIC WATCHDOG - Sistema de Monitoreo Político
 * Observatorio de Inteligencia Legislativa & Social
 * MOTOR: Gemini 2.5 Flash | FECHA: 21-ENE-2026
 * VERSIÓN: 3.0 - Con Votaciones Legislativas
 * ============================================
 */

// ============================================
// CONFIGURACIÓN PRINCIPAL
// ============================================
const MODELO = "gemini-2.5-flash";
const CAMARA_API_BASE = "https://opendata.camara.cl/wscamaradiputados.asmx";

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    GEMINI_API_KEY: props.getProperty('GEMINI_API_KEY') || '',
    JSON_SEARCH_API_KEY: props.getProperty('GOOGLE_SEARCH_API_KEY') || '',
    CX: props.getProperty('GOOGLE_SEARCH_CX') || '',
    SHEET_ID: SpreadsheetApp.getActiveSpreadsheet().getId()
  };
}

// ============================================
// MENÚ PERSONALIZADO
// ============================================
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔍 Civic Watchdog')
    .addItem('📋 Crear Estructura Inicial', 'setupCivicWatchdog')
    .addItem('👥 Importar Diputados Vigentes (API)', 'importarDiputadosAPI')
    .addSeparator()
    .addItem('▶️ Ejecutar Análisis Completo', 'runCivicWatchdog')
    .addItem('🎯 Analizar Diputado Específico', 'analizarDiputadoEspecifico')
    .addItem('🗳️ Ver Votaciones Recientes', 'verVotacionesRecientes')
    .addSeparator()
    .addItem('🧪 Verificar Configuración', 'verificarConfiguracion')
    .addItem('🧪 Test Conexión Gemini', 'testGeminiConnection')
    .addItem('🧪 Test API Cámara', 'testAPICamara')
    .addSeparator()
    .addItem('⏰ Crear Activador Diario', 'crearActivadorDiario')
    .addItem('🗑️ Eliminar Activadores', 'eliminarActivadores')
    .addToUi();
}

// ============================================
// VERIFICACIÓN
// ============================================
function verificarConfiguracion() {
  const CONFIG = getConfig();
  const ui = SpreadsheetApp.getUi();
  
  let msg = '📋 CIVIC WATCHDOG v3.0\n═══════════════════════\n\n';
  msg += `🤖 Modelo: ${MODELO}\n\n`;
  msg += CONFIG.GEMINI_API_KEY ? '✅ GEMINI_API_KEY\n' : '❌ GEMINI_API_KEY\n';
  msg += CONFIG.JSON_SEARCH_API_KEY ? '✅ GOOGLE_SEARCH_API_KEY\n' : '⚠️ GOOGLE_SEARCH_API_KEY (opcional)\n';
  msg += CONFIG.CX ? '✅ GOOGLE_SEARCH_CX\n' : '⚠️ GOOGLE_SEARCH_CX (opcional)\n';
  msg += '\n🏛️ API Cámara: opendata.camara.cl\n';
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  if (configSheet) {
    msg += `\n👥 Diputados: ${Math.max(0, configSheet.getLastRow() - 1)}`;
  }
  
  ui.alert(msg);
}

function testAPICamara() {
  const ui = SpreadsheetApp.getUi();
  try {
    const url = `${CAMARA_API_BASE}/getDiputados_Vigentes`;
    const res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    const xml = res.getContentText();
    const count = (xml.match(/<DIPID>/g) || []).length;
    ui.alert(`✅ API Cámara OK\n\nDiputados encontrados: ${count}`);
  } catch (e) {
    ui.alert('❌ Error API Cámara: ' + e.toString());
  }
}

function testGeminiConnection() {
  const CONFIG = getConfig();
  const ui = SpreadsheetApp.getUi();
  if (!CONFIG.GEMINI_API_KEY) {
    ui.alert('❌ GEMINI_API_KEY no configurada');
    return;
  }
  try {
    const result = analyzeWithGemini('Test', 'IND', 'Votó a favor de ley X', 'Criticó ley X en prensa');
    ui.alert(`✅ Gemini OK\n\n${result.resumen}`);
  } catch (e) {
    ui.alert('❌ Error: ' + e.toString());
  }
}

// ============================================
// ESTRUCTURA DE HOJAS
// ============================================
function setupCivicWatchdog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  createConfigSheet(ss);
  createAnalysisSheet(ss);
  createVotacionesSheet(ss);
  createRawLogSheet(ss);
  SpreadsheetApp.getUi().alert('✅ Estructura creada!\n\nUsa "Importar Diputados Vigentes" para cargar datos desde la API oficial.');
}

function createConfigSheet(ss) {
  let sheet = ss.getSheetByName('Config');
  if (!sheet) sheet = ss.insertSheet('Config');
  if (sheet.getLastRow() === 0) {
    const headers = ['Nombre', 'ID Diputado', 'Perfil Twitter', 'Palabra Clave Extra', 'Partido Político'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#1a73e8').setFontColor('#fff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function createAnalysisSheet(ss) {
  let sheet = ss.getSheetByName('Analisis_IA');
  if (!sheet) sheet = ss.insertSheet('Analisis_IA');
  if (sheet.getLastRow() === 0) {
    const headers = ['Fecha', 'Nombre', 'Partido', 'Sentimiento', 'Alerta', 'Resumen', 'Contradicciones', 'Votaciones Analizadas'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#34a853').setFontColor('#fff').setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    // Formato condicional
    const range = sheet.getRange('E2:E1000');
    sheet.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(7).setBackground('#ea4335').setFontColor('#fff').setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(4,6).setBackground('#fbbc04').setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenNumberLessThanOrEqualTo(3).setBackground('#34a853').setFontColor('#fff').setRanges([range]).build()
    ]);
  }
}

function createVotacionesSheet(ss) {
  let sheet = ss.getSheetByName('Votaciones');
  if (!sheet) sheet = ss.insertSheet('Votaciones');
  if (sheet.getLastRow() === 0) {
    const headers = ['Fecha Consulta', 'Boletín', 'Descripción', 'ID Votación', 'Tipo', 'Quorum', 'Resultado'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#673ab7').setFontColor('#fff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function createRawLogSheet(ss) {
  let sheet = ss.getSheetByName('Raw_Log');
  if (!sheet) sheet = ss.insertSheet('Raw_Log');
  if (sheet.getLastRow() === 0) {
    const headers = ['Timestamp', 'Fuente', 'Nombre', 'Datos'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#9e9e9e').setFontColor('#fff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

// ============================================
// IMPORTAR DIPUTADOS DESDE API OFICIAL
// ============================================
function importarDiputadosAPI() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    const url = `${CAMARA_API_BASE}/getDiputados_Vigentes`;
    const res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    const xml = res.getContentText();
    
    // Parsear XML
    const doc = XmlService.parse(xml);
    const root = doc.getRootElement();
    const ns = root.getNamespace();
    const diputados = root.getChildren('Diputado', ns);
    
    const datos = diputados.map(d => {
      const id = d.getChildText('DIPID', ns) || '';
      const nombre = d.getChildText('Nombre', ns) || '';
      const ap = d.getChildText('Apellido_Paterno', ns) || '';
      const am = d.getChildText('Apellido_Materno', ns) || '';
      return [`${nombre} ${ap} ${am}`.trim(), id, '', '', ''];
    });
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Config');
    if (!sheet) {
      setupCivicWatchdog();
      sheet = ss.getSheetByName('Config');
    }
    
    // Limpiar y escribir
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).clear();
    }
    if (datos.length > 0) {
      sheet.getRange(2, 1, datos.length, 5).setValues(datos);
    }
    
    ui.alert(`✅ Importados ${datos.length} diputados desde API oficial`);
  } catch (e) {
    ui.alert('❌ Error: ' + e.toString());
  }
}

// ============================================
// OBTENER VOTACIONES POR BOLETÍN
// ============================================
function getVotacionesBoletin(boletin) {
  try {
    const url = `${CAMARA_API_BASE}/getVotaciones_Boletin?prmBoletin=${encodeURIComponent(boletin)}`;
    const res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    const xml = res.getContentText();
    
    // Extraer votaciones del XML
    const votaciones = [];
    const idMatches = xml.match(/<ID>(\d+)<\/ID>/g) || [];
    const tipoMatches = xml.match(/<Tipo>([^<]+)<\/Tipo>/g) || [];
    const quorumMatches = xml.match(/<Quorum>([^<]+)<\/Quorum>/g) || [];
    
    for (let i = 0; i < idMatches.length; i++) {
      votaciones.push({
        id: idMatches[i]?.replace(/<\/?ID>/g, '') || '',
        tipo: tipoMatches[i]?.replace(/<\/?Tipo>/g, '') || '',
        quorum: quorumMatches[i]?.replace(/<\/?Quorum>/g, '') || ''
      });
    }
    
    return votaciones;
  } catch (e) {
    Logger.log('Error votaciones: ' + e);
    return [];
  }
}

function getVotacionDetalle(votacionId) {
  try {
    const url = `${CAMARA_API_BASE}/getVotacion_Detalle?prmVotacionID=${votacionId}`;
    const res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    const xml = res.getContentText();
    
    // Extraer votos individuales
    const votos = [];
    const dipIdMatches = xml.match(/<DIPID>(\d+)<\/DIPID>/g) || [];
    const votoMatches = xml.match(/<Voto[^>]*>([^<]+)<\/Voto>/g) || [];
    
    for (let i = 0; i < dipIdMatches.length; i++) {
      const dipId = dipIdMatches[i]?.replace(/<\/?DIPID>/g, '') || '';
      const voto = votoMatches[i]?.replace(/<\/?Voto[^>]*>/g, '') || '';
      votos.push({ dipId, voto });
    }
    
    return votos;
  } catch (e) {
    Logger.log('Error detalle votación: ' + e);
    return [];
  }
}

// Buscar las votaciones más recientes de un diputado
function getVotacionesDiputado(dipId, maxVotaciones = 5) {
  try {
    // Buscar en boletines recientes (últimos proyectos importantes)
    const boletinesRecientes = ['17478', '16621', '16617', '15869', '14614'];
    const votacionesDip = [];
    
    for (const boletin of boletinesRecientes) {
      const votaciones = getVotacionesBoletin(boletin);
      for (const v of votaciones) {
        const detalle = getVotacionDetalle(v.id);
        const votoDip = detalle.find(d => d.dipId === String(dipId));
        if (votoDip) {
          votacionesDip.push({
            boletin,
            tipo: v.tipo,
            voto: votoDip.voto
          });
        }
        if (votacionesDip.length >= maxVotaciones) break;
      }
      if (votacionesDip.length >= maxVotaciones) break;
      Utilities.sleep(500);
    }
    
    return votacionesDip;
  } catch (e) {
    Logger.log('Error votaciones diputado: ' + e);
    return [];
  }
}

function verVotacionesRecientes() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('🗳️ Ver Votaciones', 'Número de Boletín (ej: 17478):', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  
  const boletin = resp.getResponseText().trim();
  const votaciones = getVotacionesBoletin(boletin);
  
  if (votaciones.length === 0) {
    ui.alert(`No se encontraron votaciones para el boletín ${boletin}`);
    return;
  }
  
  // Guardar en hoja
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Votaciones');
  if (!sheet) {
    createVotacionesSheet(ss);
    sheet = ss.getSheetByName('Votaciones');
  }
  
  votaciones.forEach(v => {
    sheet.appendRow([new Date(), boletin, '', v.id, v.tipo, v.quorum, '']);
  });
  
  ui.alert(`✅ ${votaciones.length} votaciones encontradas para boletín ${boletin}\n\nVer pestaña "Votaciones"`);
}

// ============================================
// ANÁLISIS PRINCIPAL
// ============================================
function runCivicWatchdog() {
  const ui = SpreadsheetApp.getUi();
  const CONFIG = getConfig();
  
  if (!CONFIG.GEMINI_API_KEY) {
    ui.alert('❌ Configura GEMINI_API_KEY');
    return;
  }
  
  const targets = getTrackingTargets();
  if (targets.length === 0) {
    ui.alert('⚠️ No hay diputados en Config');
    return;
  }
  
  if (targets.length > 5) {
    const resp = ui.alert('Confirmar', `Analizar ${targets.length} diputados?`, ui.ButtonSet.YES_NO);
    if (resp !== ui.Button.YES) return;
  }
  
  let ok = 0, fail = 0;
  
  targets.forEach((t, i) => {
    try {
      Logger.log(`[${i+1}/${targets.length}] ${t.nombre}`);
      
      // 1. Obtener noticias
      const news = fetchSocialListening(t.nombre, t.palabra_clave);
      Utilities.sleep(1000);
      
      // 2. Obtener votaciones (si hay ID)
      let votesInfo = '';
      if (t.id_diputado) {
        const votos = getVotacionesDiputado(t.id_diputado, 3);
        if (votos.length > 0) {
          votesInfo = votos.map(v => `Boletín ${v.boletin}: ${v.voto}`).join(', ');
        }
      }
      Utilities.sleep(1000);
      
      // 3. Analizar con Gemini
      const result = analyzeWithGemini(t.nombre, t.partido, votesInfo, news);
      
      // 4. Guardar (con columna extra de votaciones)
      storeInsightsConVotaciones(t.nombre, t.partido, result, votesInfo);
      ok++;
    } catch (e) {
      Logger.log(`Error ${t.nombre}: ${e}`);
      fail++;
    }
  });
  
  ui.alert(`✅ Completado\n\nOK: ${ok} | Errores: ${fail}`);
}

function analizarDiputadoEspecifico() {
  const ui = SpreadsheetApp.getUi();
  const CONFIG = getConfig();
  
  if (!CONFIG.GEMINI_API_KEY) {
    ui.alert('❌ Configura GEMINI_API_KEY');
    return;
  }
  
  const resp = ui.prompt('🎯 Analizar Diputado', 'Nombre:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  
  const buscar = resp.getResponseText().toLowerCase().trim();
  const targets = getTrackingTargets();
  const target = targets.find(t => t.nombre.toLowerCase().includes(buscar));
  
  if (!target) {
    ui.alert(`❌ "${buscar}" no encontrado`);
    return;
  }
  
  try {
    // Noticias
    const news = fetchSocialListening(target.nombre, target.palabra_clave);
    
    // Votaciones
    let votesInfo = 'Sin datos de votaciones';
    if (target.id_diputado) {
      ui.alert(`🔄 Buscando votaciones de ${target.nombre}...`);
      const votos = getVotacionesDiputado(target.id_diputado, 3);
      if (votos.length > 0) {
        votesInfo = votos.map(v => `Boletín ${v.boletin}: ${v.voto}`).join('\n');
      }
    }
    
    // Análisis
    const result = analyzeWithGemini(target.nombre, target.partido, votesInfo, news);
    storeInsightsConVotaciones(target.nombre, target.partido, result, votesInfo);
    
    ui.alert(`✅ ANÁLISIS: ${target.nombre} (${target.partido})\n\n🗳️ Votaciones: ${votesInfo}\n\n🎭 ${result.sentimiento}\n🚨 Alerta: ${result.nivel_alerta}\n📝 ${result.resumen}`);
  } catch (e) {
    ui.alert('❌ Error: ' + e.toString());
  }
}

// ============================================
// LECTURA CONFIG
// ============================================
function getTrackingTargets() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    data.shift();
    return data.filter(r => r[0]).map(r => ({
      nombre: String(r[0]).trim(),
      id_diputado: String(r[1] || ''),
      twitter: String(r[2] || ''),
      palabra_clave: String(r[3] || ''),
      partido: String(r[4] || 'N/A')
    }));
  } catch (e) { return []; }
}

// ============================================
// SOCIAL LISTENING
// ============================================
function fetchSocialListening(nombre, palabraClave) {
  const CONFIG = getConfig();
  
  if (CONFIG.JSON_SEARCH_API_KEY && CONFIG.CX) {
    const query = `${nombre} ${palabraClave || ''} diputado Chile`;
    const url = `https://www.googleapis.com/customsearch/v1?key=${CONFIG.JSON_SEARCH_API_KEY}&cx=${CONFIG.CX}&q=${encodeURIComponent(query)}&num=5`;
    try {
      const res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
      const data = JSON.parse(res.getContentText());
      if (data.items) {
        const snippets = data.items.map(i => `• ${i.title}`).join('\n');
        logRawData('CustomSearch', nombre, snippets);
        return snippets;
      }
    } catch (e) {}
  }
  
  // Fallback: Google News RSS
  const query = `${nombre} ${palabraClave || ''}`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' Chile')}&hl=es-419&gl=CL&ceid=CL:es-419`;
  try {
    const res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    const xml = res.getContentText();
    const matches = xml.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/g) || [];
    const news = matches.slice(1, 6).map(m => '• ' + m.replace(/<title><!\[CDATA\[|\]\]><\/title>/g, '')).join('\n');
    logRawData('GoogleNews', nombre, news);
    return news || 'Sin noticias';
  } catch (e) { return 'Error noticias'; }
}

// ============================================
// ANÁLISIS GEMINI 2.5 FLASH
// ============================================
function analyzeWithGemini(nombre, partido, votaciones, noticias) {
  const CONFIG = getConfig();
  
  const prompt = `Eres un analista político chileno experto. Analiza la COHERENCIA entre el comportamiento legislativo y el discurso público del siguiente parlamentario:

DIPUTADO/A: ${nombre}
PARTIDO: ${partido}

🗳️ VOTACIONES RECIENTES:
${votaciones || 'Sin datos de votaciones'}

📰 NOTICIAS/PRENSA:
${noticias || 'Sin información'}

ANÁLISIS REQUERIDO:
1. ¿Hay coherencia entre sus votos y declaraciones públicas?
2. Nivel de controversia actual (1-10)
3. Contradicciones específicas detectadas

Responde SOLO JSON:
{"sentimiento":"positivo|negativo|neutral","nivel_alerta":1,"resumen":"texto","contradicciones_detectadas":["item1"]}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  
  try {
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
    if (json.error) throw new Error(json.error.message);
    return JSON.parse(json.candidates[0].content.parts[0].text);
  } catch (e) {
    return { sentimiento: 'error', nivel_alerta: 0, resumen: 'Error: ' + e.toString(), contradicciones_detectadas: [] };
  }
}

// ============================================
// ALMACENAMIENTO
// ============================================
function storeInsightsConVotaciones(nombre, partido, data, votaciones) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Analisis_IA');
    if (!sheet) return;
    const contras = Array.isArray(data.contradicciones_detectadas) ? data.contradicciones_detectadas.join(' | ') : '';
    sheet.appendRow([new Date(), nombre, partido, data.sentimiento, data.nivel_alerta, data.resumen, contras, votaciones || '']);
  } catch (e) {}
}

function logRawData(fuente, nombre, datos) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Raw_Log');
    if (!sheet) return;
    sheet.appendRow([new Date(), fuente, nombre, String(datos).substring(0, 3000)]);
    if (sheet.getLastRow() > 300) sheet.deleteRows(2, sheet.getLastRow() - 300);
  } catch (e) {}
}

// ============================================
// ACTIVADORES
// ============================================
function crearActivadorDiario() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runCivicWatchdog') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runCivicWatchdog').timeBased().everyDays(1).atHour(8).create();
  SpreadsheetApp.getUi().alert('✅ Análisis programado: 8:00 AM diario');
}

function eliminarActivadores() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  SpreadsheetApp.getUi().alert('✅ Activadores eliminados');
}
