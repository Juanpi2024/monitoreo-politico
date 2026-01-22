/**
 * ============================================
 * CIVIC WATCHDOG - ARCHIVO 2: FUNCIONES
 * Votaciones, Redes Sociales, Analisis
 * ============================================
 */

// ============================================
// VOTACIONES
// ============================================
function getEstadisticasVotaciones(categoria) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Votaciones_Historico');
  if (!sheet || sheet.getLastRow() <= 1) return { error: 'Sin datos de votaciones', porPartido: [], totalVotos: 0 };
  
  var data = sheet.getDataRange().getValues();
  data.shift();
  
  var filtrados = categoria && categoria !== 'todos' ? data.filter(function(row) { return row[3] === categoria; }) : data;
  
  var porPartido = {};
  filtrados.forEach(function(row) {
    var partido = row[6] || 'N/A';
    var voto = String(row[7] || '').toLowerCase();
    
    if (!porPartido[partido]) porPartido[partido] = { aFavor: 0, enContra: 0, abstencion: 0, ausente: 0, total: 0 };
    
    if (voto.indexOf('afirmativo') >= 0 || voto.indexOf('favor') >= 0) porPartido[partido].aFavor++;
    else if (voto.indexOf('negativo') >= 0 || voto.indexOf('contra') >= 0) porPartido[partido].enContra++;
    else if (voto.indexOf('abst') >= 0) porPartido[partido].abstencion++;
    else porPartido[partido].ausente++;
    
    porPartido[partido].total++;
  });
  
  var resultado = Object.keys(porPartido).map(function(partido) {
    var stats = porPartido[partido];
    return {
      partido: partido,
      aFavor: stats.aFavor,
      enContra: stats.enContra,
      abstencion: stats.abstencion,
      pctAFavor: stats.total > 0 ? Math.round((stats.aFavor / stats.total) * 100) : 0,
      total: stats.total
    };
  }).sort(function(a, b) { return b.total - a.total; });
  
  return { porPartido: resultado, totalVotos: filtrados.length };
}

function importarVotacionesCategoria(categoria) {
  var boletines = BOLETINES[categoria];
  if (!boletines) return { error: 'Categoria no existe', importados: 0 };
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Votaciones_Historico');
  if (!sheet) { setupCivicWatchdog(); sheet = ss.getSheetByName('Votaciones_Historico'); }
  
  var diccionario = getDiputadosDiccionario();
  var importados = 0;
  var fechaHoy = new Date();
  
  boletines.forEach(function(boletin) {
    try {
      var votaciones = getVotacionesBoletin(boletin.id);
      votaciones.forEach(function(vot) {
        var detalles = getVotacionDetalle(vot.id);
        detalles.forEach(function(det) {
          var dip = diccionario[det.dipId] || { nombre: 'Desconocido', partido: 'N/A' };
          sheet.appendRow([fechaHoy, boletin.id, boletin.titulo, categoria, det.dipId, dip.nombre, dip.partido, det.voto, vot.id]);
          importados++;
        });
        Utilities.sleep(500);
      });
    } catch (e) { Logger.log('Error boletin ' + boletin.id + ': ' + e); }
  });
  
  return { importados: importados, categoria: categoria };
}

function importarTodasLasVotaciones() {
  var total = 0;
  var categorias = Object.keys(BOLETINES);
  categorias.forEach(function(cat) {
    var result = importarVotacionesCategoria(cat);
    total += result.importados || 0;
  });
  return { total: total };
}

function getVotacionesBoletin(boletinId) {
  try {
    var url = CAMARA_API_BASE + '/getVotaciones_Boletin?prmBoletin=' + boletinId;
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var xml = response.getContentText();
    
    var votaciones = [];
    var regex = /<Votacion>[\s\S]*?<ID>(\d+)<\/ID>[\s\S]*?<\/Votacion>/gi;
    var match;
    while ((match = regex.exec(xml)) !== null) {
      votaciones.push({ id: match[1] });
    }
    return votaciones;
  } catch (e) {
    Logger.log('Error getVotacionesBoletin: ' + e);
    return [];
  }
}

function getVotacionDetalle(votacionId) {
  try {
    var url = CAMARA_API_BASE + '/getVotacion_Detalle?prmVotacionID=' + votacionId;
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var xmlText = response.getContentText();
    
    var votos = [];
    try {
      var doc = XmlService.parse(xmlText);
      var root = doc.getRootElement();
      var ns = root.getNamespace();
      var votosElement = root.getChild('Votos', ns);
      if (votosElement) {
        var votosList = votosElement.getChildren('Voto', ns);
        votosList.forEach(function(voto) {
          var diputadoEl = voto.getChild('Diputado', ns);
          var dipId = diputadoEl ? diputadoEl.getChildText('DIPID', ns) : '';
          var opcion = voto.getChildText('Opcion', ns) || '';
          if (dipId) votos.push({ dipId: dipId, voto: opcion });
        });
      }
    } catch (parseError) {
      var regex = /<DIPID>(\d+)<\/DIPID>[\s\S]*?<Opcion>([^<]+)<\/Opcion>/gi;
      var match;
      while ((match = regex.exec(xmlText)) !== null) {
        votos.push({ dipId: match[1], voto: match[2] });
      }
    }
    return votos;
  } catch (e) {
    Logger.log('Error getVotacionDetalle: ' + e);
    return [];
  }
}

function getDiputadosDiccionario() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  if (!sheet || sheet.getLastRow() <= 1) return {};
  var data = sheet.getDataRange().getValues();
  data.shift();
  var dict = {};
  data.forEach(function(row) {
    if (row[1]) dict[String(row[1])] = { nombre: String(row[0]).trim(), partido: String(row[2] || 'N/A').trim() };
  });
  return dict;
}

function calcularAsistencia() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Votaciones_Historico');
  if (!sheet || sheet.getLastRow() <= 1) {
    SpreadsheetApp.getUi().alert('No hay datos en Votaciones_Historico');
    return;
  }
  
  var data = sheet.getDataRange().getValues();
  data.shift();
  
  var asistenciaPorDiputado = {};
  data.forEach(function(row) {
    var dipId = String(row[4]);
    var nombre = row[5];
    var partido = row[6];
    var voto = String(row[7] || '').toLowerCase();
    var votoEfectivo = voto.indexOf('afirmativo') >= 0 || voto.indexOf('negativo') >= 0 || voto.indexOf('absten') >= 0;
    
    if (!asistenciaPorDiputado[dipId]) asistenciaPorDiputado[dipId] = { nombre: nombre, partido: partido, votaciones: 0, presente: 0 };
    asistenciaPorDiputado[dipId].votaciones++;
    if (votoEfectivo) asistenciaPorDiputado[dipId].presente++;
  });
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var asistSheet = ss.getSheetByName('Asistencia') || ss.insertSheet('Asistencia');
  asistSheet.clear();
  
  asistSheet.getRange(1, 1, 1, 6).setValues([['Nombre', 'Partido', 'Votaciones', 'Presente', '% Asistencia', 'Ranking']]);
  asistSheet.getRange(1, 1, 1, 6).setBackground('#4CAF50').setFontColor('#fff').setFontWeight('bold');
  
  var resultados = Object.values(asistenciaPorDiputado).map(function(d) {
    return { nombre: d.nombre, partido: d.partido, votaciones: d.votaciones, presente: d.presente, pct: d.votaciones > 0 ? Math.round((d.presente / d.votaciones) * 100) : 0 };
  }).sort(function(a, b) { return b.pct - a.pct; });
  
  var filas = resultados.map(function(r, i) { return [r.nombre, r.partido, r.votaciones, r.presente, r.pct + '%', i + 1]; });
  if (filas.length > 0) asistSheet.getRange(2, 1, filas.length, 6).setValues(filas);
  
  asistSheet.setFrozenRows(1);
  SpreadsheetApp.getUi().alert('Asistencia calculada: ' + resultados.length + ' diputados');
  return resultados;
}

// ============================================
// REDES SOCIALES
// ============================================
var NITTER_INSTANCES = ['https://nitter.poast.org', 'https://nitter.privacydev.net', 'https://nitter.cz'];

function getTweetsFromNitter(username) {
  if (!username || username.trim() === '') return [];
  username = username.replace('@', '').trim();
  var tweets = [];
  
  for (var i = 0; i < NITTER_INSTANCES.length; i++) {
    try {
      var url = NITTER_INSTANCES[i] + '/' + username;
      var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (response.getResponseCode() !== 200) continue;
      
      var html = response.getContentText();
      var tweetPattern = /<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      var match;
      var count = 0;
      
      while ((match = tweetPattern.exec(html)) !== null && count < 10) {
        var tweetText = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (tweetText.length > 20) {
          tweets.push({ text: tweetText.substring(0, 500), source: 'twitter', username: username, fecha: new Date().toISOString().split('T')[0] });
          count++;
        }
      }
      if (tweets.length > 0) break;
    } catch (e) { Logger.log('Error Nitter: ' + e.message); }
  }
  return tweets;
}

function searchGoogleMentions(query, numResults) {
  numResults = numResults || 5;
  var config = getConfig();
  if (!config.JSON_SEARCH_API_KEY || !config.CX) return [];
  
  try {
    var url = 'https://www.googleapis.com/customsearch/v1?key=' + config.JSON_SEARCH_API_KEY + '&cx=' + config.CX + '&q=' + encodeURIComponent(query) + '&num=' + numResults + '&dateRestrict=m1';
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(response.getContentText());
    if (data.items) {
      return data.items.map(function(item) {
        return { titulo: item.title, snippet: item.snippet, url: item.link, fuente: new URL(item.link).hostname };
      });
    }
    return [];
  } catch (e) { Logger.log('Error Google Search: ' + e.message); return []; }
}

function extraerDatosRedes(dipId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = ss.getSheetByName('Config');
  if (!configSheet) return { error: 'No hay hoja Config' };
  
  var data = configSheet.getDataRange().getValues();
  var dipRow = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(dipId)) { dipRow = data[i]; break; }
  }
  if (!dipRow) return { error: 'Diputado no encontrado' };
  
  var nombre = dipRow[0];
  var partido = dipRow[2];
  var twitter = dipRow[5] ? dipRow[5].replace('@', '') : '';
  var palabraClave = dipRow[11] || nombre;
  
  var resultado = { nombre: nombre, partido: partido, fuentes: [], totalMenciones: 0, extractedAt: new Date().toISOString() };
  
  if (twitter) {
    var tweets = getTweetsFromNitter(twitter);
    if (tweets.length > 0) {
      resultado.fuentes.push({ tipo: 'Twitter/Nitter', items: tweets, count: tweets.length });
      resultado.totalMenciones += tweets.length;
    }
  }
  
  var searchQuery = '"' + nombre + '" "' + partido + '" Chile diputado';
  var googleResults = searchGoogleMentions(searchQuery, 5);
  if (googleResults.length > 0) {
    resultado.fuentes.push({ tipo: 'Google News', items: googleResults, count: googleResults.length });
    resultado.totalMenciones += googleResults.length;
  }
  
  return resultado;
}

function extraerRedesTodos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = ss.getSheetByName('Config');
  var rawLogSheet = ss.getSheetByName('Raw_Log');
  if (!configSheet || !rawLogSheet) { SpreadsheetApp.getUi().alert('Faltan hojas Config o Raw_Log'); return; }
  
  var data = configSheet.getDataRange().getValues();
  data.shift();
  var procesados = 0;
  
  for (var i = 0; i < data.length && procesados < 10; i++) {
    if (!data[i][0] || !data[i][5]) continue;
    try {
      var datos = extraerDatosRedes(data[i][1]);
      if (datos.totalMenciones > 0) {
        rawLogSheet.appendRow([new Date(), 'Redes Sociales', datos.nombre, JSON.stringify(datos)]);
        procesados++;
      }
      Utilities.sleep(1500);
    } catch (e) { Logger.log('Error: ' + e.message); }
  }
  
  SpreadsheetApp.getUi().alert('Extraccion completada: ' + procesados + ' diputados');
  return procesados;
}

function extraerRedesDiputado() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt('ID del Diputado', 'Ingresa el ID:', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  
  var dipId = response.getResponseText().trim();
  var datos = extraerDatosRedes(dipId);
  
  if (datos.error) { ui.alert('Error: ' + datos.error); return; }
  
  var mensaje = 'Datos para ' + datos.nombre + '\nTotal menciones: ' + datos.totalMenciones + '\n';
  datos.fuentes.forEach(function(f) { mensaje += f.tipo + ': ' + f.count + ' items\n'; });
  ui.alert(mensaje);
}

function testNitter() {
  var ui = SpreadsheetApp.getUi();
  ui.alert('Probando conexion a Nitter...');
  var tweets = getTweetsFromNitter('gabrielboric');
  if (tweets.length > 0) {
    ui.alert('Nitter funcionando! Encontrados: ' + tweets.length + ' tweets');
  } else {
    ui.alert('No se pudieron obtener tweets. Nitter puede estar caido.');
  }
}

// ============================================
// ANALISIS CON GEMINI
// ============================================
function runCivicWatchdog() {
  var targets = getTrackingTargets();
  if (targets.length === 0) { SpreadsheetApp.getUi().alert('No hay diputados en Config'); return; }
  
  var analizados = 0;
  var maxAnalizar = 10;
  
  for (var i = 0; i < targets.length && analizados < maxAnalizar; i++) {
    try {
      var target = targets[i];
      var votes = getVotacionesDiputado(target.id_diputado);
      var mentions = prepararTextoAnalisis(target.id_diputado);
      var insights = analyzeWithGemini(target.nombre, target.partido, votes, mentions);
      storeInsights(target.nombre, target.partido, insights);
      analizados++;
      Utilities.sleep(2000);
    } catch (e) { Logger.log('Error analizando: ' + e); }
  }
  
  SpreadsheetApp.getUi().alert('Analisis completado: ' + analizados + ' diputados');
}

function runCivicWatchdogWeb() {
  var targets = getTrackingTargets();
  if (targets.length === 0) return { ok: 0, total: 0, error: 'Sin diputados' };
  
  var analizados = 0;
  for (var i = 0; i < Math.min(10, targets.length); i++) {
    try {
      var target = targets[i];
      var votes = getVotacionesDiputado(target.id_diputado);
      var insights = analyzeWithGemini(target.nombre, target.partido, votes, '');
      storeInsights(target.nombre, target.partido, insights);
      analizados++;
      Utilities.sleep(2000);
    } catch (e) { Logger.log('Error: ' + e); }
  }
  return { ok: analizados, total: targets.length };
}

function getTrackingTargets() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var data = sheet.getDataRange().getValues();
  data.shift();
  return data.filter(function(r) { return r[0]; }).map(function(r) {
    return { nombre: r[0], id_diputado: r[1], partido: r[2] || 'N/A', twitter: r[5] || '', palabra_clave: r[11] || r[0] };
  });
}

function analyzeWithGemini(nombre, partido, votes, mentions) {
  var config = getConfig();
  if (!config.GEMINI_API_KEY) return { sentimiento: 'neutral', alerta: 0, resumen: 'Sin API Key configurada', contradicciones: '' };
  
  var votosTexto = 'Sin votaciones registradas';
  if (votes && votes.length > 0) {
    votosTexto = votes.slice(0, 10).map(function(v) { return (v.titulo || 'Proyecto') + ': ' + (v.voto || 'N/A'); }).join('; ');
  }
  
  var prompt = 'Analiza brevemente al diputado chileno ' + nombre + ' del partido ' + partido + '.\n';
  prompt += 'Votaciones recientes: ' + votosTexto + '\n';
  if (mentions && mentions.length > 50) {
    prompt += mentions.substring(0, 1000) + '\n';
  }
  prompt += '\nResponde SOLO con este JSON exacto (sin texto adicional): {"sentimiento":"positivo|negativo|neutral","alerta":0,"resumen":"breve analisis","contradicciones":""}';
  
  try {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODELO + ':generateContent?key=' + config.GEMINI_API_KEY;
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ 
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.3 }
      }),
      muteHttpExceptions: true
    });
    
    var responseText = response.getContentText();
    var result = JSON.parse(responseText);
    
    // Verificar estructura de respuesta
    if (!result || !result.candidates || !result.candidates[0]) {
      Logger.log('Gemini sin candidates para ' + nombre);
      return { sentimiento: 'neutral', alerta: 0, resumen: 'Sin respuesta de Gemini', contradicciones: '' };
    }
    
    var candidate = result.candidates[0];
    if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
      Logger.log('Gemini sin content para ' + nombre);
      return { sentimiento: 'neutral', alerta: 0, resumen: 'Respuesta vacia de Gemini', contradicciones: '' };
    }
    
    var text = candidate.content.parts[0].text || '';
    
    // Buscar JSON en la respuesta
    var jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        var parsed = JSON.parse(jsonMatch[0]);
        return {
          sentimiento: parsed.sentimiento || 'neutral',
          alerta: Number(parsed.alerta) || 0,
          resumen: parsed.resumen || text.substring(0, 300),
          contradicciones: parsed.contradicciones || ''
        };
      } catch (parseErr) {
        Logger.log('Error parseando JSON de Gemini: ' + parseErr);
      }
    }
    
    // Si no hay JSON, usar texto plano
    return { sentimiento: 'neutral', alerta: 5, resumen: text.substring(0, 300), contradicciones: '' };
    
  } catch (e) {
    Logger.log('Error Gemini para ' + nombre + ': ' + e);
    return { sentimiento: 'error', alerta: 0, resumen: 'Error: ' + e.toString().substring(0, 100), contradicciones: '' };
  }
}

function storeInsights(nombre, partido, insights) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Analisis_IA');
  if (!sheet) return;
  sheet.appendRow([new Date(), nombre, partido, insights.sentimiento, insights.alerta, insights.resumen, insights.contradicciones, '']);
}

function getVotacionesDiputado(dipId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Votaciones_Historico');
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var data = sheet.getDataRange().getValues();
  data.shift();
  return data.filter(function(row) { return String(row[4]) === String(dipId); }).map(function(row) {
    return { boletin: row[1], titulo: row[2], categoria: row[3], voto: row[7] };
  });
}

function analizarDiputadoEspecifico() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt('Nombre del Diputado', 'Ingresa el nombre:', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  
  var nombre = response.getResponseText().trim();
  var targets = getTrackingTargets();
  var target = targets.find(function(t) { return t.nombre.toLowerCase().indexOf(nombre.toLowerCase()) >= 0; });
  
  if (!target) { ui.alert('Diputado no encontrado'); return; }
  
  ui.alert('Analizando a ' + target.nombre + '...');
  var votes = getVotacionesDiputado(target.id_diputado);
  var mentions = prepararTextoAnalisis(target.id_diputado);
  var insights = analyzeWithGemini(target.nombre, target.partido, votes, mentions);
  storeInsights(target.nombre, target.partido, insights);
  
  ui.alert('Resultado:\nAlerta: ' + insights.alerta + '/10\n' + insights.resumen);
}

function prepararTextoAnalisis(dipId) {
  var datos = extraerDatosRedes(dipId);
  if (!datos || datos.error) return '';
  
  var texto = 'DATOS REDES SOCIALES DE ' + datos.nombre + ' (' + datos.partido + '):\n';
  datos.fuentes.forEach(function(fuente) {
    texto += fuente.tipo + ' (' + fuente.count + ' items):\n';
    fuente.items.forEach(function(item, i) {
      if (item.text) texto += '  Tweet: "' + item.text.substring(0, 200) + '..."\n';
      else if (item.snippet) texto += '  [' + item.fuente + '] ' + item.titulo + '\n';
    });
  });
  return texto;
}

// ============================================
// UTILIDADES
// ============================================
function importarDiputadosAPI() {
  try {
    var url = CAMARA_API_BASE + '/getDiputados_Vigentes';
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var doc = XmlService.parse(res.getContentText());
    var root = doc.getRootElement();
    var ns = root.getNamespace();
    var dips = root.getChildren('Diputado', ns);
    
    var datos = dips.map(function(d) {
      var nombre = (d.getChildText('Nombre', ns) || '') + ' ' + (d.getChildText('Apellido_Paterno', ns) || '') + ' ' + (d.getChildText('Apellido_Materno', ns) || '');
      return [nombre.trim(), d.getChildText('DIPID', ns) || '', '', '', '', '', '', '', '', '', '', ''];
    });
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var s = ss.getSheetByName('Config');
    if (!s) { setupCivicWatchdog(); s = ss.getSheetByName('Config'); }
    if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, 12).clear();
    if (datos.length > 0) s.getRange(2, 1, datos.length, 12).setValues(datos);
    
    SpreadsheetApp.getUi().alert('Importados: ' + datos.length + ' diputados');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error: ' + e);
  }
}

function testAPIs() {
  var ui = SpreadsheetApp.getUi();
  var config = getConfig();
  var msg = 'TEST APIs:\n\n';
  
  // 1. Verificar API Keys
  msg += '1. CONFIGURACION:\n';
  msg += '   Gemini API: ' + (config.GEMINI_API_KEY ? 'SI (' + config.GEMINI_API_KEY.substring(0, 10) + '...)' : 'NO configurada') + '\n';
  msg += '   Google Search: ' + (config.JSON_SEARCH_API_KEY ? 'SI' : 'NO') + '\n';
  msg += '   Search CX: ' + (config.CX ? 'SI' : 'NO') + '\n\n';
  
  // 2. Test real de Gemini
  if (config.GEMINI_API_KEY) {
    msg += '2. TEST GEMINI:\n';
    try {
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODELO + ':generateContent?key=' + config.GEMINI_API_KEY;
      var response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          contents: [{ parts: [{ text: 'Responde solo: FUNCIONANDO' }] }],
          generationConfig: { maxOutputTokens: 50 }
        }),
        muteHttpExceptions: true
      });
      
      var code = response.getResponseCode();
      var body = response.getContentText();
      
      if (code === 200) {
        var result = JSON.parse(body);
        if (result.candidates && result.candidates[0]) {
          var text = result.candidates[0].content.parts[0].text;
          msg += '   Estado: OK (codigo ' + code + ')\n';
          msg += '   Respuesta: ' + text.substring(0, 50) + '\n';
        } else {
          msg += '   Estado: Sin candidates\n';
          msg += '   Body: ' + body.substring(0, 200) + '\n';
        }
      } else {
        msg += '   Estado: ERROR (codigo ' + code + ')\n';
        msg += '   Error: ' + body.substring(0, 200) + '\n';
      }
    } catch (e) {
      msg += '   Estado: EXCEPCION\n';
      msg += '   Error: ' + e.toString().substring(0, 100) + '\n';
    }
  }
  
  msg += '\nModelo: ' + MODELO;
  ui.alert(msg);
}

function crearActivadorDiario() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('runCivicWatchdog').timeBased().everyDays(1).atHour(8).create();
  SpreadsheetApp.getUi().alert('Activador diario 8:00 AM creado');
}

// ============================================
// SEGUIMIENTO LEGISLATIVO - TRANSPARENTES.CL
// ============================================

var TRANSPARENTES_URL = 'https://transparentes.cl/seguimiento-legislativo.html';

/**
 * Extrae proyectos de ley desde Transparentes.cl
 */
function scrapeTransparentes() {
  try {
    var response = UrlFetchApp.fetch(TRANSPARENTES_URL, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    
    if (response.getResponseCode() !== 200) {
      Logger.log('Error accediendo a Transparentes: ' + response.getResponseCode());
      return { error: 'No se pudo acceder al sitio', proyectos: [] };
    }
    
    var html = response.getContentText();
    var proyectos = [];
    
    // Extraer boletines (pattern: Nº XXXXX-XX)
    var boletinPattern = /Nº\s*(\d{4,6}-\d{1,2})/gi;
    var boletines = [];
    var match;
    while ((match = boletinPattern.exec(html)) !== null) {
      if (boletines.indexOf(match[1]) < 0) boletines.push(match[1]);
    }
    
    // Extraer proyectos del HTML
    // Buscar bloques de proyectos
    var projectPattern = /Proyecto[^<]*ley[^<]*que[^<]+([^<]+)/gi;
    var proyectoTextos = [];
    while ((match = projectPattern.exec(html)) !== null) {
      var texto = match[0].replace(/<[^>]+>/g, '').trim();
      if (texto.length > 30 && proyectoTextos.length < 20) {
        proyectoTextos.push(texto);
      }
    }
    
    // Asignar niveles de prioridad basados en palabras clave
    var keywords = {
      alto: ['votación', 'tabla', 'urgencia', 'plazo', 'indicaciones'],
      medio: ['discusión', 'audiencias', 'comisión'],
      bajo: ['ingresado', 'primer trámite', 'espera']
    };
    
    for (var i = 0; i < Math.min(boletines.length, 15); i++) {
      var titulo = proyectoTextos[i] || 'Proyecto de Ley';
      titulo = titulo.substring(0, 200);
      
      // Determinar prioridad
      var prioridad = 'bajo';
      var textoLower = titulo.toLowerCase();
      if (keywords.alto.some(function(k) { return textoLower.indexOf(k) >= 0; })) prioridad = 'alto';
      else if (keywords.medio.some(function(k) { return textoLower.indexOf(k) >= 0; })) prioridad = 'medio';
      
      // Categorizar tema
      var tema = categorizarProyecto(titulo);
      
      proyectos.push({
        boletin: boletines[i],
        titulo: titulo,
        tema: tema,
        prioridad: prioridad,
        impactoCiudadania: determinarImpacto(titulo, 'ciudadania'),
        impactoSociedadCivil: determinarImpacto(titulo, 'sociedad'),
        url: 'https://www.camara.cl/legislacion/ProyectosDeLey/tramitacion.aspx?prmID=' + boletines[i].split('-')[0],
        fuente: 'transparentes.cl',
        fechaExtraccion: new Date().toISOString()
      });
    }
    
    return { proyectos: proyectos, total: proyectos.length };
    
  } catch (e) {
    Logger.log('Error scrapeTransparentes: ' + e);
    return { error: e.toString(), proyectos: [] };
  }
}

/**
 * Categoriza proyecto según palabras clave
 */
function categorizarProyecto(titulo) {
  var lower = titulo.toLowerCase();
  var categorias = {
    'Transparencia': ['transparencia', 'información pública', 'acceso', 'lobby'],
    'Participación': ['participación', 'ciudadana', 'vecinos', 'juntas', 'organizaciones'],
    'Derechos': ['derechos', 'defensoras', 'protección', 'discapacidad'],
    'Electoral': ['electoral', 'votaciones', 'sufragar', 'política'],
    'Institucional': ['congreso', 'servicio', 'funcionarios', 'regulación'],
    'Justicia': ['justicia', 'defensoría', 'víctimas'],
    'Niñez': ['niñez', 'adolescencia', 'niños'],
    'Gobierno': ['gobernadores', 'regional', 'royalty']
  };
  
  for (var cat in categorias) {
    if (categorias[cat].some(function(kw) { return lower.indexOf(kw) >= 0; })) {
      return cat;
    }
  }
  return 'General';
}

/**
 * Determina nivel de impacto
 */
function determinarImpacto(titulo, tipo) {
  var lower = titulo.toLowerCase();
  var altoPrioridad = ['derechos fundamentales', 'participación ciudadana', 'transparencia', 
                       'acceso a la información', 'libertad', 'democracia'];
  var mediaPrioridad = ['organizaciones', 'regulación', 'servicio', 'proceso'];
  
  if (altoPrioridad.some(function(k) { return lower.indexOf(k) >= 0; })) return 'alto';
  if (mediaPrioridad.some(function(k) { return lower.indexOf(k) >= 0; })) return 'medio';
  return 'bajo';
}

/**
 * Guarda proyectos en hoja de cálculo
 */
function guardarProyectosLey(proyectos) {
  if (!proyectos || proyectos.length === 0) return 0;
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Proyectos_Ley');
  
  if (!sheet) {
    sheet = ss.insertSheet('Proyectos_Ley');
    var headers = ['Fecha', 'Boletín', 'Título', 'Tema', 'Prioridad', 'Impacto Ciudadanía', 'Impacto OSC', 'URL'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#7c3aed').setFontColor('#fff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  var nuevos = 0;
  var existentes = [];
  
  // Obtener boletines existentes
  if (sheet.getLastRow() > 1) {
    existentes = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().flat();
  }
  
  proyectos.forEach(function(p) {
    if (existentes.indexOf(p.boletin) < 0) {
      sheet.appendRow([
        new Date(),
        p.boletin,
        p.titulo,
        p.tema,
        p.prioridad,
        p.impactoCiudadania,
        p.impactoSociedadCivil,
        p.url
      ]);
      nuevos++;
    }
  });
  
  return nuevos;
}

/**
 * Obtiene proyectos de la hoja o scrape si no hay datos recientes
 */
function getProyectosLey(forceRefresh) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Proyectos_Ley');
  
  // Verificar si hay datos recientes (últimas 24 horas)
  var needsRefresh = forceRefresh || false;
  if (!sheet || sheet.getLastRow() <= 1) {
    needsRefresh = true;
  } else {
    var lastDate = sheet.getRange(sheet.getLastRow(), 1).getValue();
    if (lastDate && (new Date() - new Date(lastDate)) > 24 * 60 * 60 * 1000) {
      needsRefresh = true;
    }
  }
  
  // Hacer scraping si necesario
  if (needsRefresh) {
    var scrapeResult = scrapeTransparentes();
    if (scrapeResult.proyectos.length > 0) {
      guardarProyectosLey(scrapeResult.proyectos);
    }
  }
  
  // Leer datos de la hoja
  sheet = ss.getSheetByName('Proyectos_Ley');
  if (!sheet || sheet.getLastRow() <= 1) {
    return [];
  }
  
  var data = sheet.getDataRange().getValues();
  data.shift(); // Remover headers
  
  return data.map(function(row) {
    return {
      fecha: row[0],
      boletin: row[1],
      titulo: row[2],
      tema: row[3],
      prioridad: row[4],
      impactoCiudadania: row[5],
      impactoSociedadCivil: row[6],
      url: row[7]
    };
  }).sort(function(a, b) {
    // Ordenar por prioridad: alto > medio > bajo
    var orden = { alto: 3, medio: 2, bajo: 1 };
    return (orden[b.prioridad] || 0) - (orden[a.prioridad] || 0);
  });
}

/**
 * Menú: Actualizar proyectos de ley
 */
function actualizarProyectosLey() {
  var ui = SpreadsheetApp.getUi();
  ui.alert('Extrayendo proyectos de ley desde Transparentes.cl...');
  
  var result = scrapeTransparentes();
  
  if (result.error) {
    ui.alert('Error: ' + result.error);
    return;
  }
  
  var nuevos = guardarProyectosLey(result.proyectos);
  ui.alert('Listo! ' + result.total + ' proyectos encontrados, ' + nuevos + ' nuevos agregados.');
}

/**
 * Obtiene proyectos próximos a votación (alta prioridad)
 */
function getProximasVotaciones() {
  var proyectos = getProyectosLey(false);
  return proyectos.filter(function(p) { return p.prioridad === 'alto'; }).slice(0, 5);
}

/**
 * API endpoint para proyectos de ley
 */
function apiProyectosLey(e) {
  var action = e ? e.parameter.subaction : '';
  
  switch(action) {
    case 'proximas':
      return getProximasVotaciones();
    case 'refresh':
      var result = scrapeTransparentes();
      guardarProyectosLey(result.proyectos);
      return result;
    default:
      return getProyectosLey(false);
  }
}

/**
 * Menú: Ver próximas votaciones en un diálogo
 */
function verProximasVotaciones() {
  var ui = SpreadsheetApp.getUi();
  var proyectos = getProximasVotaciones();
  
  if (proyectos.length === 0) {
    ui.alert('No hay votaciones próximas de alta prioridad.\nPrueba actualizar los proyectos primero.');
    return;
  }
  
  var mensaje = '📋 PRÓXIMAS VOTACIONES (Alta Prioridad)\n\n';
  proyectos.forEach(function(p, i) {
    mensaje += (i + 1) + '. ' + p.boletin + '\n';
    mensaje += '   ' + p.titulo.substring(0, 80) + '...\n';
    mensaje += '   📁 Tema: ' + p.tema + ' | 🎯 Impacto: ' + p.impactoCiudadania + '\n\n';
  });
  
  ui.alert(mensaje);
}

// ============================================
// INTEGRACIÓN DECIDECHILE - DATOS ELECTORALES
// ============================================

var DECIDECHILE_BASE = 'https://www.decidechile.cl';

/**
 * Estructura de datos electorales para un diputado
 * Fuente: DecideChile proporciona datos electorales históricos
 */
function getDatosElectorales(nombreDiputado) {
  // Buscar en hoja de datos electorales
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Datos_Electorales');
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return null;
  }
  
  var data = sheet.getDataRange().getValues();
  data.shift(); // Remover headers
  
  var diputado = data.find(function(row) {
    return row[1] && row[1].toLowerCase().indexOf(nombreDiputado.toLowerCase()) >= 0;
  });
  
  if (!diputado) return null;
  
  return {
    nombre: diputado[1],
    distrito: diputado[2],
    region: diputado[3],
    elecciones: diputado[4],
    primeraEleccion: diputado[5],
    votosUltimaEleccion: diputado[6],
    porcentajeVotos: diputado[7],
    tendencia: diputado[8],
    fuente: 'decidechile.cl'
  };
}

/**
 * Crear estructura para datos electorales
 */
function setupDatosElectorales() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Datos_Electorales');
  
  if (!sheet) {
    sheet = ss.insertSheet('Datos_Electorales');
    var headers = ['ID', 'Nombre', 'Distrito', 'Región', 'Elecciones', 'Primera Elección', 'Votos Última', 'Porcentaje', 'Tendencia'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#0d47a1').setFontColor('#fff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

/**
 * Importar datos electorales desde DecideChile manualmente
 * (Para ser llenado con datos recopilados)
 */
function importarDatosElectoralesMuestra() {
  var sheet = setupDatosElectorales();
  
  // Datos de muestra basados en DecideChile
  var datosEjemplo = [
    [1, 'Karol Cariola', 'D8', 'Metropolitana', 3, 2013, 45678, 28.5, 'ascendente'],
    [2, 'Diego Schalper', 'D10', 'O\'Higgins', 2, 2017, 38234, 24.3, 'estable'],
    [3, 'Johannes Kaiser', 'D11', 'Metropolitana', 1, 2021, 52145, 31.2, 'nuevo'],
    [4, 'Pamela Jiles', 'D12', 'Metropolitana', 2, 2017, 67890, 35.6, 'ascendente'],
    [5, 'Gonzalo de la Carrera', 'D13', 'Metropolitana', 1, 2021, 41234, 22.8, 'nuevo'],
  ];
  
  if (sheet.getLastRow() <= 1) {
    datosEjemplo.forEach(function(row) {
      sheet.appendRow(row);
    });
    SpreadsheetApp.getUi().alert('Datos electorales de ejemplo importados');
  } else {
    SpreadsheetApp.getUi().alert('Ya existen datos en la hoja Datos_Electorales');
  }
}

/**
 * Obtener estadísticas electorales agregadas
 */
function getEstadisticasElectorales() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Datos_Electorales');
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return { error: 'No hay datos electorales', stats: null };
  }
  
  var data = sheet.getDataRange().getValues();
  data.shift();
  
  var stats = {
    totalConDatos: data.length,
    promedioElecciones: 0,
    nuevos2021: 0,
    reelectos: 0,
    tendencias: { ascendente: 0, estable: 0, descendente: 0, nuevo: 0 }
  };
  
  var sumaElecciones = 0;
  data.forEach(function(row) {
    sumaElecciones += row[4] || 0;
    if (row[4] === 1) stats.nuevos2021++;
    else stats.reelectos++;
    if (row[8] && stats.tendencias[row[8]] !== undefined) {
      stats.tendencias[row[8]]++;
    }
  });
  
  stats.promedioElecciones = (sumaElecciones / data.length).toFixed(1);
  
  return stats;
}

/**
 * API endpoint para datos electorales
 */
function apiDatosElectorales(e) {
  var action = e ? e.parameter.subaction : '';
  
  switch(action) {
    case 'stats':
      return getEstadisticasElectorales();
    case 'diputado':
      var nombre = e.parameter.nombre || '';
      return getDatosElectorales(nombre);
    default:
      return getEstadisticasElectorales();
  }
}

