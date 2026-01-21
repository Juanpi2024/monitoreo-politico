# Guía de Configuración: Estructura de Google Sheets (Civic Watchdog)

Para que el script `main.gs` funcione correctamente, debes configurar tu Google Sheet con las siguientes especificaciones:

## 1. Pestaña: `Config`

Esta hoja controla quiénes serán monitoreados.

| Nombre (Col A) | ID Diputado (Col B) | Perfil Twitter (Col C) | Palabra Clave Extra (Col D) |
| :--- | :--- | :--- | :--- |
| Juan Pérez | 123 | @juanperez | "Ley de Pesca" |
| María Soto | 456 | @mariasoto | "Reforma Previsional" |

*Nota: El ID Diputado lo obtienes de la web de la Cámara de Diputados.*

## 2. Pestaña: `Analisis_IA`

Aquí se almacenarán los resultados procesados por Gemini.

| Fecha (Col A) | Nombre (Col B) | Sentimiento (Col C) | Alerta (Col D) | Resumen (Col E) | Contradicciones (Col F) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 21/01/2026 | Juan Pérez | negativo | 8 | Votó a favor pese a críticas en X | ["Discurso pro-pymes vs Voto pro-impuestos"] |

## 3. Pestaña: `Raw_Log` (Opcional)

Para depuración de las respuestas crudas de las APIs.

---

## Instrucciones de Despliegue

1. En tu Google Sheet, ve a **Extensiones > Apps Script**.
2. Borra todo lo que haya y pega el contenido de `main.gs`.
3. Reemplaza las constantes `GEMINI_API_KEY`, `JSON_SEARCH_API_KEY` y `CX` con tus claves.
4. Crea un **Activador (Reloj)** para que la función `runCivicWatchdog` se ejecute cada 6 o 12 horas.
