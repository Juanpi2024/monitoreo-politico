# 🔍 Civic Watchdog

Sistema de monitoreo legislativo y análisis de redes sociales para la Cámara de Diputados de Chile.

![Estado](https://img.shields.io/badge/Estado-En%20Desarrollo-yellow)
![Motor IA](https://img.shields.io/badge/Motor%20IA-Gemini%202.5%20Flash-blue)
![Plataforma](https://img.shields.io/badge/Plataforma-Google%20Apps%20Script-green)

## 📋 Descripción

Civic Watchdog es una herramienta que permite:

- **Monitorear votaciones** de los 155 diputados chilenos
- **Analizar comportamiento** legislativo con IA (Gemini)
- **Extraer datos de redes sociales** (Twitter vía Nitter, Google Search)
- **Detectar contradicciones** entre discurso público y votaciones
- **Visualizar estadísticas** en un dashboard web interactivo

## 🚀 Características

### ✅ Implementado

- Importación automática de diputados desde API de la Cámara
- Descarga de votaciones por categoría (pensiones, presupuesto, salud, etc.)
- Análisis con Gemini 2.5 Flash
- Cálculo de asistencia
- Dashboard web responsive
- Extracción de tweets vía Nitter (proxy gratuito de Twitter)
- Búsqueda de menciones en Google

### 🔄 En Desarrollo

- Integración completa de datos de redes sociales en análisis
- Perfiles digitales ampliados de diputados

## 📁 Estructura de Archivos

| Archivo | Descripción |
|---------|-------------|
| `Codigo1.gs` | Funciones principales, menú, API y estructura |
| `Codigo2.gs` | Votaciones, redes sociales, análisis Gemini |
| `Dashboard.html` | Interfaz web del dashboard |
| `diputados_redes.csv` | Datos de redes sociales de 140+ diputados |
| `diputados_2022_2026.csv` | Lista de diputados del período actual |

## 🔧 Configuración

### Requisitos

- Cuenta de Google con acceso a Google Sheets
- API Key de Google AI (Gemini)
- (Opcional) API Key de Google Custom Search

### Instalación

1. Crear nuevo Google Sheet
2. Ir a **Extensiones > Apps Script**
3. Crear dos archivos: `Codigo1` y `Codigo2`
4. Copiar el contenido de cada archivo .gs
5. Crear archivo `Dashboard` (HTML)
6. Configurar propiedades del script:
   - `GEMINI_API_KEY`: Tu API Key de Gemini
   - `GOOGLE_SEARCH_API_KEY`: (Opcional) API Key de Custom Search
   - `GOOGLE_SEARCH_CX`: (Opcional) ID del motor de búsqueda

### Propiedades del Script

En Apps Script, ir a **Configuración del proyecto > Propiedades del script**:

```
GEMINI_API_KEY = tu_api_key_de_gemini
GOOGLE_SEARCH_API_KEY = tu_api_key_de_search (opcional)
GOOGLE_SEARCH_CX = tu_cx_id (opcional)
```

## 📊 Uso

### Menú en Google Sheets

```
🔍 Civic Watchdog
├── 📋 Crear Estructura
├── 👥 Importar Diputados (API)
├── 🗳️ Importar Votaciones
│   ├── Pensiones/AFP
│   ├── Presupuesto
│   ├── Salud
│   ├── Seguridad
│   ├── Educación
│   └── Trabajo
├── 📊 Calcular Asistencia
├── 📱 Redes Sociales
│   ├── Extraer de un Diputado
│   ├── Extraer de TODOS
│   └── Test Nitter
├── ▶️ Análisis Completo
├── 🎯 Analizar Diputado
├── 📊 Ver Dashboard Web
├── 🧪 Test APIs
└── ⏰ Activador Diario
```

### Hojas Generadas

| Hoja | Contenido |
|------|-----------|
| `Config` | Datos de diputados (nombre, partido, redes sociales) |
| `Analisis_IA` | Resultados del análisis con Gemini |
| `Votaciones_Historico` | Historial de votaciones por diputado |
| `Asistencia` | Ranking de asistencia |
| `Raw_Log` | Datos crudos de redes sociales |

## 🌐 Dashboard Web

El dashboard muestra:

- Estadísticas generales (alertas, contradicciones)
- Votaciones por partido y categoría
- Perfiles de diputados con:
  - Información de contacto
  - Enlaces a redes sociales
  - Historial de votaciones
  - Nivel de alerta
  - Inconsistencias detectadas

## 📡 Fuentes de Datos

- **API Cámara de Diputados**: Votaciones y datos oficiales
- **Nitter**: Tweets públicos (sin necesidad de API de Twitter)
- **Google Custom Search**: Menciones en prensa

## 🤖 Análisis con IA

El sistema usa Gemini 2.5 Flash para:

- Evaluar coherencia entre discurso y votaciones
- Detectar cambios de posición
- Asignar nivel de alerta (0-10)
- Identificar contradicciones

## 📝 Licencia

Este proyecto es de código abierto para uso educativo y cívico.

## 👤 Autor

Desarrollado con asistencia de IA para análisis político ciudadano.

---

*Última actualización: Enero 2026*
