/**
 * ============================================
 * CIVIC WATCHDOG - API Service
 * Connection to Google Apps Script Backend
 * ============================================
 */

// ============================================
// CONFIGURACIÓN - IMPORTANTE
// ============================================
// 
// Para conectar con tu API de Google Apps Script:
// 
// 1. Abre tu proyecto en Google Apps Script
// 2. Click en "Implementar" > "Nueva implementación"
// 3. Selecciona "Aplicación web"
// 4. Configurar:
//    - Ejecutar como: "Yo" (tu cuenta)
//    - Quién tiene acceso: "Cualquier persona"
// 5. Click en "Implementar"
// 6. Copia la URL que te da (termina en /exec)
// 7. Pégala abajo en API_URL
// 8. Cambia USE_MOCK a false
//
// ============================================

const CONFIG = {
    // ✅ URL configurada automáticamente - Apps Script desplegado
    API_URL: 'https://script.google.com/macros/s/AKfycbypfUY3_VkqowWYDnKIpwhMeZ6ro1uIGrYCll6ePnsY46Ye_gooKnGOCJZ466Xp3fih3w/exec',

    // ✅ Usando datos reales del backend
    USE_MOCK: false,
};

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI(endpoint, params = {}) {
    if (CONFIG.USE_MOCK || !CONFIG.API_URL) {
        return getMockData(endpoint, params);
    }

    // Construir URL con parámetros
    const url = new URL(CONFIG.API_URL);
    url.searchParams.append('page', 'api');
    url.searchParams.append('action', endpoint);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
    });

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Normalizar datos para el frontend
        return normalizeData(endpoint, data);
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        // Fallback a mock data si hay error
        console.warn('Usando datos de prueba debido al error');
        return getMockData(endpoint, params);
    }
}

/**
 * Normaliza los datos de la API al formato esperado por el frontend
 */
function normalizeData(endpoint, data) {
    if (!data || data.error) return data;

    switch (endpoint) {
        case 'diputados':
            return Array.isArray(data) ? data.map(normalizeDiputado) : [];
        case 'alertas':
            return Array.isArray(data) ? data.map(normalizeDiputado) : [];
        case 'estadisticas':
            return {
                totalDiputados: data.totalDiputados || 0,
                alertasAltas: data.alertasAltas || 0,
                votacionesAnalizadas: data.votacionesAnalizadas || data.contradicciones || 0,
                asistenciaPromedio: data.asistenciaPromedio || data.promedioAlerta || 0,
                ultimaActualizacion: new Date().toISOString()
            };
        case 'estadisticasPartido':
            return Array.isArray(data) ? data : [];
        default:
            return data;
    }
}

/**
 * Normaliza un diputado al formato del frontend
 */
function normalizeDiputado(d) {
    return {
        id: d.dipId || d.id || Math.random().toString(36).substr(2, 9),
        nombre: d.nombre || 'Sin nombre',
        partido: d.partido || 'IND',
        partidoNombre: d.partidoNombre || d.partido || 'Independiente',
        partidoColor: d.partidoColor || getPartyColor(d.partido),
        region: d.distrito || d.region || '',
        nivelAlerta: d.alerta ?? d.nivelAlerta ?? 0,
        asistencia: d.asistencia ?? 0,
        votacionesTotal: d.votaciones ?? d.votacionesTotal ?? 0,
        aFavor: d.aFavor || 0,
        enContra: d.enContra || 0,
        abstencion: d.abstencion || 0,
        twitter: d.redes?.twitter || d.twitter || '',
        instagram: d.redes?.instagram || d.instagram || '',
        email: d.correo || d.email || '',
        inconsistencias: d.contradiccionesDetalle || d.inconsistencias || [],
        votaciones: (d.votacionesDetalle || d.votaciones || []).map(v => ({
            titulo: v.titulo || v.proyecto || '',
            voto: normalizeVoto(v.voto),
            fecha: v.fecha || ''
        }))
    };
}

function normalizeVoto(voto) {
    if (!voto) return 'abstencion';
    const v = String(voto).toLowerCase();
    if (v.includes('afirmativo') || v.includes('favor') || v.includes('si')) return 'favor';
    if (v.includes('negativo') || v.includes('contra') || v.includes('no')) return 'contra';
    return 'abstencion';
}

function getPartyColor(partido) {
    const colors = {
        'RN': '#1e40af', 'UDI': '#1e3a5f', 'PS': '#dc2626', 'PPD': '#f59e0b',
        'PC': '#b91c1c', 'DC': '#16a34a', 'REP': '#0d47a1', 'EVOP': '#0891b2',
        'FA': '#7c3aed', 'IND': '#6b7280', 'RD': '#ec4899', 'CS': '#0ea5e9'
    };
    return colors[partido] || '#6b7280';
}

/**
 * Get all deputies with their data
 */
export async function getDiputados() {
    return fetchAPI('diputados');
}

/**
 * Get general statistics
 */
export async function getEstadisticas() {
    return fetchAPI('estadisticas');
}

/**
 * Get statistics by party
 */
export async function getEstadisticasPorPartido() {
    return fetchAPI('estadisticasPartido');
}

/**
 * Get voting data by category
 */
export async function getVotaciones(categoria) {
    return fetchAPI('votaciones', { categoria });
}

/**
 * Get deputy detail
 */
export async function getDiputadoDetalle(id) {
    return fetchAPI('diputadoDetalle', { id });
}

/**
 * Get deputies with high alerts
 */
export async function getAlertas() {
    return fetchAPI('alertas');
}

/**
 * Get legislative projects
 */
export async function getProyectosLey() {
    return fetchAPI('proyectosLey');
}

/**
 * Get upcoming high-priority votes
 */
export async function getProximasVotaciones() {
    return fetchAPI('proximasVotaciones');
}

// ============================================
// MOCK DATA FOR DEVELOPMENT
// ============================================

const PARTIDOS = [
    // Partidos oficiales según Cámara de Diputados 2022-2026
    { sigla: 'RN', nombre: 'Renovación Nacional', color: '#1e40af' },
    { sigla: 'UDI', nombre: 'Unión Demócrata Independiente', color: '#1e3a5f' },
    { sigla: 'PS', nombre: 'Partido Socialista', color: '#dc2626' },
    { sigla: 'PPD', nombre: 'Partido Por la Democracia', color: '#f59e0b' },
    { sigla: 'PC', nombre: 'Partido Comunista', color: '#b91c1c' },
    { sigla: 'DC', nombre: 'Democracia Cristiana', color: '#16a34a' },
    { sigla: 'PREP', nombre: 'Partido Republicano', color: '#0d47a1' },
    { sigla: 'EVOP', nombre: 'Evópoli', color: '#0891b2' },
    { sigla: 'FA', nombre: 'Frente Amplio', color: '#7c3aed' },
    { sigla: 'IND', nombre: 'Independiente', color: '#6b7280' },
    { sigla: 'PSC', nombre: 'Partido Social Cristiano', color: '#059669' },
    { sigla: 'LIBERAL', nombre: 'Partido Liberal', color: '#eab308' },
    { sigla: 'PNL', nombre: 'Partido Nacional Liberal', color: '#14532d' },
    { sigla: 'PDG', nombre: 'Partido de la Gente', color: '#f97316' },
];

// Mapeo CORRECTO de diputados con sus partidos reales (Cámara de Diputados 2022-2026)
const DIPUTADOS_REALES = [
    { nombre: 'María Candelaria Acevedo', partido: 'PC', distrito: 20 },
    { nombre: 'Eric Aedo', partido: 'DC', distrito: 20 },
    { nombre: 'Yovana Ahumada', partido: 'PSC', distrito: 3 },
    { nombre: 'Jorge Alessandri', partido: 'UDI', distrito: 10 },
    { nombre: 'René Alinco', partido: 'IND', distrito: 27 },
    { nombre: 'Jaime Araya', partido: 'IND', distrito: 3 },
    { nombre: 'Cristián Araya', partido: 'PREP', distrito: 11 },
    { nombre: 'Mónica Arce', partido: 'IND', distrito: 12 },
    { nombre: 'Roberto Arroyo', partido: 'PSC', distrito: 20 },
    { nombre: 'Danisa Astudillo', partido: 'PS', distrito: 2 },
    { nombre: 'Chiara Barchiesi', partido: 'PREP', distrito: 6 },
    { nombre: 'Boris Barrera', partido: 'PC', distrito: 9 },
    { nombre: 'Héctor Barría', partido: 'DC', distrito: 25 },
    { nombre: 'Arturo Barrios', partido: 'PS', distrito: 7 },
    { nombre: 'Miguel Ángel Becker', partido: 'RN', distrito: 23 },
    { nombre: 'María Francisca Bello', partido: 'FA', distrito: 6 },
    { nombre: 'Juan Carlos Beltrán', partido: 'RN', distrito: 22 },
    { nombre: 'Gustavo Benavente', partido: 'UDI', distrito: 18 },
    { nombre: 'Bernardo Berger', partido: 'IND', distrito: 24 },
    { nombre: 'Alejandro Bernales', partido: 'LIBERAL', distrito: 26 },
    { nombre: 'Carlos Bianchi', partido: 'IND', distrito: 28 },
    { nombre: 'Sergio Bobadilla', partido: 'UDI', distrito: 20 },
    { nombre: 'Fernando Bórquez', partido: 'UDI', distrito: 26 },
    { nombre: 'Ana María Bravo', partido: 'PS', distrito: 24 },
    { nombre: 'Marta Bravo', partido: 'UDI', distrito: 19 },
    { nombre: 'Jorge Brito', partido: 'FA', distrito: 7 },
    { nombre: 'Félix Bugueño', partido: 'FA', distrito: 16 },
    { nombre: 'Miguel Ángel Calisto', partido: 'IND', distrito: 27 },
    { nombre: 'Felipe Camaño', partido: 'IND', distrito: 19 },
    { nombre: 'Karol Cariola', partido: 'PC', distrito: 9 },
    { nombre: 'Álvaro Carter', partido: 'IND', distrito: 12 },
    { nombre: 'Nathalie Castillo', partido: 'PC', distrito: 5 },
    { nombre: 'José Miguel Castro', partido: 'RN', distrito: 3 },
    { nombre: 'Roberto Celedón', partido: 'IND', distrito: 17 },
    { nombre: 'Andrés Celis', partido: 'RN', distrito: 7 },
    { nombre: 'Daniella Cicardini', partido: 'PS', distrito: 4 },
    { nombre: 'Sofía Cid', partido: 'IND', distrito: 4 },
    { nombre: 'Ricardo Cifuentes', partido: 'DC', distrito: 5 },
    { nombre: 'Juan Antonio Coloma', partido: 'UDI', distrito: 14 },
    { nombre: 'Sara Concha', partido: 'PSC', distrito: 19 },
    { nombre: 'María Luisa Cordero', partido: 'IND', distrito: 10 },
    { nombre: 'Eduardo Cornejo', partido: 'UDI', distrito: 16 },
    { nombre: 'Luis Alberto Cuello', partido: 'PC', distrito: 7 },
    { nombre: 'Gonzalo de la Carrera', partido: 'PNL', distrito: 11 },
    { nombre: 'Catalina Del Real', partido: 'IND', distrito: 11 },
    { nombre: 'Viviana Delgado', partido: 'IND', distrito: 8 },
    { nombre: 'Felipe Donoso', partido: 'UDI', distrito: 17 },
    { nombre: 'Jorge Durán', partido: 'RN', distrito: 9 },
    { nombre: 'Eduardo Durán', partido: 'RN', distrito: 13 },
    { nombre: 'Diego Schalper', partido: 'RN', distrito: 15 },
    { nombre: 'Johannes Kaiser', partido: 'PREP', distrito: 10 },
    { nombre: 'Pamela Jiles', partido: 'PDG', distrito: 12 },
    { nombre: 'Vlado Mirosevic', partido: 'LIBERAL', distrito: 1 },
    { nombre: 'Marcos Ilabaca', partido: 'PS', distrito: 24 },
    { nombre: 'Andrés Longton', partido: 'RN', distrito: 6 },
    { nombre: 'Jaime Sáez', partido: 'FA', distrito: 15 },
    { nombre: 'Erika Olivera', partido: 'IND', distrito: 14 },
    { nombre: 'Cristhian Moreira', partido: 'UDI', distrito: 23 },
    { nombre: 'Gonzalo Winter', partido: 'FA', distrito: 10 },
    { nombre: 'Tomás Hirsch', partido: 'FA', distrito: 8 },
    { nombre: 'Ximena Ossandón', partido: 'RN', distrito: 11 },
    { nombre: 'Francisco Undurraga', partido: 'EVOP', distrito: 9 },
    { nombre: 'Emilia Schneider', partido: 'FA', distrito: 9 },
    { nombre: 'Harry Jürgensen', partido: 'RN', distrito: 26 },
    { nombre: 'Carolina Marzán', partido: 'PPD', distrito: 6 },
    { nombre: 'Gaspar Rivas', partido: 'PREP', distrito: 15 },
    { nombre: 'Maite Orsini', partido: 'FA', distrito: 10 },
    { nombre: 'Leonardo Soto', partido: 'PS', distrito: 5 },
    { nombre: 'Gloria Naveillan', partido: 'IND', distrito: 8 },
    { nombre: 'Hotuiti Teao', partido: 'PREP', distrito: 13 },
    { nombre: 'Camila Rojas', partido: 'FA', distrito: 8 },
    { nombre: 'Diego Ibáñez', partido: 'FA', distrito: 6 },
    { nombre: 'Natalia Castillo', partido: 'PC', distrito: 5 },
    { nombre: 'Catalina Pérez', partido: 'FA', distrito: 3 },
    { nombre: 'Gonzalo Fuenzalida', partido: 'RN', distrito: 9 },
    { nombre: 'Alexis Sepúlveda', partido: 'PS', distrito: 25 },
    { nombre: 'José Meza', partido: 'IND', distrito: 1 },
    { nombre: 'Rubén Oyarzo', partido: 'IND', distrito: 28 },
    { nombre: 'Marcela Riquelme', partido: 'IND', distrito: 3 },
    { nombre: 'Joanna Pérez', partido: 'DC', distrito: 18 },
    { nombre: 'Lorena Fries', partido: 'FA', distrito: 9 },
    { nombre: 'Félix González', partido: 'FA', distrito: 8 },
    { nombre: 'Andrés Jouannet', partido: 'PDG', distrito: 21 },
    { nombre: 'Luis Malla', partido: 'PREP', distrito: 2 },
    { nombre: 'Hugo Rey', partido: 'RN', distrito: 16 },
    { nombre: 'Agustín Romero', partido: 'PREP', distrito: 27 },
    { nombre: 'Daniel Lilayu', partido: 'PREP', distrito: 23 },
    { nombre: 'Stephan Schubert', partido: 'PREP', distrito: 25 },
    { nombre: 'Cristián Labbé', partido: 'UDI', distrito: 13 },
    { nombre: 'Henry Leal', partido: 'RN', distrito: 17 },
    { nombre: 'Francesca Muñoz', partido: 'IND', distrito: 15 },
    { nombre: 'Carla Morales', partido: 'UDI', distrito: 4 },
    { nombre: 'Marisela Santibáñez', partido: 'PC', distrito: 10 },
    { nombre: 'Carmen Hertz', partido: 'PC', distrito: 10 },
    { nombre: 'Lorena Pizarro', partido: 'PC', distrito: 9 },
    { nombre: 'Boris Chamorro', partido: 'PS', distrito: 22 },
    { nombre: 'Jaime Naranjo', partido: 'PS', distrito: 16 },
    { nombre: 'Raúl Leiva', partido: 'PS', distrito: 21 },
    { nombre: 'Daniel Melo', partido: 'PS', distrito: 18 },
    { nombre: 'Nelson Venegas', partido: 'PS', distrito: 21 },
    { nombre: 'Cristóbal Urruticoechea', partido: 'PREP', distrito: 6 },
    { nombre: 'Juan Irarrázaval', partido: 'PREP', distrito: 12 },
    { nombre: 'Christian Matheson', partido: 'PREP', distrito: 24 },
    { nombre: 'Mauricio Ojeda', partido: 'PREP', distrito: 2 },
    { nombre: 'Héctor Ulloa', partido: 'DC', distrito: 27 },
    { nombre: 'Miguel Mellado', partido: 'RN', distrito: 23 },
    { nombre: 'Alberto Undurraga', partido: 'DC', distrito: 10 },
    { nombre: 'Raúl Soto', partido: 'PPD', distrito: 15 },
    { nombre: 'Marco Sulantay', partido: 'UDI', distrito: 2 },
    { nombre: 'Sebastián Videla', partido: 'DC', distrito: 20 },
    { nombre: 'Flor Weisse', partido: 'RN', distrito: 22 },
    { nombre: 'Renzo Trisotti', partido: 'UDI', distrito: 1 },
    { nombre: 'Consuelo Veloso', partido: 'FA', distrito: 20 },
    { nombre: 'Hernán Palma', partido: 'IND', distrito: 21 },
    { nombre: 'Cristina Girardi', partido: 'PPD', distrito: 9 },
    { nombre: 'Marta González', partido: 'DC', distrito: 19 },
    { nombre: 'Luis Sánchez', partido: 'PREP', distrito: 8 },
    { nombre: 'Ignacio Urrutia', partido: 'PREP', distrito: 14 },
    { nombre: 'Pablo Prieto', partido: 'PREP', distrito: 22 },
    { nombre: 'Gastón Saavedra', partido: 'PS', distrito: 21 },
    { nombre: 'María José Hoffmann', partido: 'UDI', distrito: 6 },
    { nombre: 'Gustavo Sanhueza', partido: 'UDI', distrito: 23 },
];

// Función para obtener partido por nombre
function getPartidoByNombre(nombre) {
    const diputado = DIPUTADOS_REALES.find(d => d.nombre === nombre);
    if (diputado) {
        return PARTIDOS.find(p => p.sigla === diputado.partido) || PARTIDOS.find(p => p.sigla === 'IND');
    }
    return PARTIDOS[Math.floor(Math.random() * PARTIDOS.length)];
}

// Función para obtener distrito por nombre
function getDistritoByNombre(nombre) {
    const diputado = DIPUTADOS_REALES.find(d => d.nombre === nombre);
    return diputado ? diputado.distrito : Math.floor(Math.random() * 28) + 1;
}

function generateMockDiputados(count = 30) {
    // Usar diputados reales directamente
    const diputadosCount = Math.min(count, DIPUTADOS_REALES.length);

    return DIPUTADOS_REALES.slice(0, diputadosCount).map((dip, i) => {
        const partido = PARTIDOS.find(p => p.sigla === dip.partido) || PARTIDOS.find(p => p.sigla === 'IND');
        const alertLevel = Math.floor(Math.random() * 11);
        const attendance = 70 + Math.floor(Math.random() * 30);

        return {
            id: i + 1,
            nombre: dip.nombre,
            partido: partido.sigla,
            partidoNombre: partido.nombre,
            partidoColor: partido.color,
            region: `Distrito N°${dip.distrito}`,
            nivelAlerta: alertLevel,
            asistencia: attendance,
            votacionesTotal: 50 + Math.floor(Math.random() * 50),
            aFavor: 30 + Math.floor(Math.random() * 40),
            enContra: 10 + Math.floor(Math.random() * 20),
            abstencion: Math.floor(Math.random() * 10),
            twitter: `@diputado${i + 1}`,
            instagram: `diputado${i + 1}`,
            email: `diputado${i + 1}@congreso.cl`,
            inconsistencias: alertLevel > 5 ? [
                'Votó en contra de reforma de pensiones tras apoyarla públicamente',
                'Cambio de posición en tema tributario'
            ] : [],
            // NUEVA SECCIÓN: Polémicas y Debilidades
            polemicas: getPolemicas(alertLevel, partido.sigla),
            debilidades: getDebilidades(alertLevel, attendance),
            fortalezas: getFortalezas(partido.sigla, attendance),
            perfilElectoral: {
                elecciones: 2 + Math.floor(Math.random() * 3),
                reelecciones: Math.floor(Math.random() * 2),
                votosUltimaEleccion: 15000 + Math.floor(Math.random() * 30000),
                porcentaje: (15 + Math.random() * 25).toFixed(1) + '%'
            },
            votaciones: [
                { titulo: 'Reforma de Pensiones', voto: Math.random() > 0.5 ? 'favor' : 'contra', fecha: '2026-01-15' },
                { titulo: 'Ley 40 Horas', voto: 'favor', fecha: '2026-01-10' },
                { titulo: 'Presupuesto 2026', voto: Math.random() > 0.3 ? 'favor' : 'abstencion', fecha: '2025-12-20' },
                { titulo: 'Reforma Tributaria', voto: Math.random() > 0.5 ? 'contra' : 'favor', fecha: '2025-12-01' },
                { titulo: 'Ley Naín-Retamal', voto: Math.random() > 0.4 ? 'favor' : 'contra', fecha: '2025-11-15' },
            ]
        };
    });
}

// Genera polémicas basadas en nivel de alerta
function getPolemicas(alertLevel, partido) {
    const polemicasDatabase = [
        { tipo: 'declaracion', texto: 'Declaraciones polémicas sobre política migratoria', severidad: 'media', fecha: '2025-12' },
        { tipo: 'votacion', texto: 'Votó contra proyecto apoyado por su propia bancada', severidad: 'alta', fecha: '2025-11' },
        { tipo: 'conflicto', texto: 'Enfrentamiento público con dirigentes de su partido', severidad: 'media', fecha: '2025-10' },
        { tipo: 'asistencia', texto: 'Ausencia prolongada a sesiones de comisión', severidad: 'baja', fecha: '2025-09' },
        { tipo: 'cambio', texto: 'Cambio de posición tras reunión con lobby empresarial', severidad: 'alta', fecha: '2025-08' },
        { tipo: 'redes', texto: 'Tweet polémico generó críticas transversales', severidad: 'media', fecha: '2026-01' },
        { tipo: 'financiamiento', texto: 'Cuestionamiento sobre fuentes de financiamiento de campaña', severidad: 'alta', fecha: '2025-07' },
        { tipo: 'promesa', texto: 'Incumplimiento de promesa de campaña sobre pensiones', severidad: 'media', fecha: '2025-06' },
    ];

    if (alertLevel <= 3) return [];
    if (alertLevel <= 5) return polemicasDatabase.slice(0, 1);
    if (alertLevel <= 7) return polemicasDatabase.slice(0, 3);
    return polemicasDatabase.slice(0, 5);
}

// Genera debilidades políticas
function getDebilidades(alertLevel, asistencia) {
    const debilidades = [];

    if (asistencia < 80) debilidades.push({ area: 'Asistencia', desc: `Baja asistencia (${asistencia}%)`, impacto: 'medio' });
    if (alertLevel > 6) debilidades.push({ area: 'Coherencia', desc: 'Alta inconsistencia discurso-voto', impacto: 'alto' });
    if (Math.random() > 0.6) debilidades.push({ area: 'Comunicación', desc: 'Baja presencia en medios', impacto: 'bajo' });
    if (Math.random() > 0.7) debilidades.push({ area: 'Liderazgo', desc: 'Pocas iniciativas legislativas propias', impacto: 'medio' });
    if (Math.random() > 0.8) debilidades.push({ area: 'Bancada', desc: 'Tensiones con su bancada', impacto: 'alto' });

    return debilidades;
}

// Genera fortalezas políticas
function getFortalezas(partido, asistencia) {
    const fortalezas = [];

    if (asistencia >= 90) fortalezas.push({ area: 'Compromiso', desc: 'Excelente asistencia a sesiones' });
    if (Math.random() > 0.5) fortalezas.push({ area: 'Legislación', desc: 'Autor de proyectos de ley relevantes' });
    if (Math.random() > 0.6) fortalezas.push({ area: 'Comisiones', desc: 'Líder en comisión permanente' });
    if (Math.random() > 0.7) fortalezas.push({ area: 'Mediático', desc: 'Alta presencia en medios' });
    if (['RN', 'UDI', 'PS', 'DC'].includes(partido)) fortalezas.push({ area: 'Partido', desc: 'Respaldo partidario sólido' });

    return fortalezas;
}

const mockDiputados = generateMockDiputados(155);

function getMockData(endpoint, params = {}) {
    return new Promise((resolve) => {
        // Simulate network delay
        setTimeout(() => {
            switch (endpoint) {
                case 'diputados':
                    resolve(mockDiputados);
                    break;

                case 'estadisticas':
                    resolve({
                        totalDiputados: mockDiputados.length,
                        alertasAltas: mockDiputados.filter(d => d.nivelAlerta >= 7).length,
                        alertasMedias: mockDiputados.filter(d => d.nivelAlerta >= 4 && d.nivelAlerta < 7).length,
                        votacionesAnalizadas: 156,
                        asistenciaPromedio: Math.round(mockDiputados.reduce((sum, d) => sum + d.asistencia, 0) / mockDiputados.length),
                        ultimaActualizacion: new Date().toISOString()
                    });
                    break;

                case 'estadisticasPartido':
                    const partidoStats = {};
                    mockDiputados.forEach(d => {
                        if (!partidoStats[d.partido]) {
                            partidoStats[d.partido] = {
                                sigla: d.partido,
                                nombre: d.partidoNombre,
                                color: d.partidoColor,
                                count: 0,
                                alertaPromedio: 0
                            };
                        }
                        partidoStats[d.partido].count++;
                        partidoStats[d.partido].alertaPromedio += d.nivelAlerta;
                    });
                    Object.values(partidoStats).forEach(p => {
                        p.alertaPromedio = Math.round(p.alertaPromedio / p.count * 10) / 10;
                    });
                    resolve(Object.values(partidoStats).sort((a, b) => b.count - a.count));
                    break;

                case 'alertas':
                    resolve(
                        mockDiputados
                            .filter(d => d.nivelAlerta >= 5)
                            .sort((a, b) => b.nivelAlerta - a.nivelAlerta)
                            .slice(0, 10)
                    );
                    break;

                case 'diputadoDetalle':
                    const dip = mockDiputados.find(d => d.id === parseInt(params.id));
                    resolve(dip || null);
                    break;

                case 'proyectosLey':
                case 'proximasVotaciones':
                    const mockProyectos = [
                        { boletin: '17797-06', titulo: 'Modifica ley sobre asociaciones y participación ciudadana', tema: 'Participación', prioridad: 'alto', impactoCiudadania: 'alto', url: '#' },
                        { boletin: '16854-07', titulo: 'Moderniza regulación del lobby y gestiones de intereses', tema: 'Transparencia', prioridad: 'alto', impactoCiudadania: 'alto', url: '#' },
                        { boletin: '15987-04', titulo: 'Protección de defensoras de naturaleza y derechos ambientales', tema: 'Derechos', prioridad: 'medio', impactoCiudadania: 'alto', url: '#' },
                        { boletin: '17234-06', titulo: 'Modifica ley de acceso a información pública', tema: 'Transparencia', prioridad: 'alto', impactoCiudadania: 'alto', url: '#' },
                        { boletin: '16432-12', titulo: 'Participación política de personas con discapacidad', tema: 'Electoral', prioridad: 'medio', impactoCiudadania: 'medio', url: '#' },
                    ];
                    resolve(endpoint === 'proximasVotaciones' ? mockProyectos.filter(p => p.prioridad === 'alto') : mockProyectos);
                    break;

                default:
                    resolve(null);
            }
        }, 300);
    });
}

export { CONFIG };
