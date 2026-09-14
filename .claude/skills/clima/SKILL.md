---
name: clima
description: Consulta el clima actual y el pronóstico de una ciudad (Lerma, Villa, CDMX, Leon) y muestra las referencias usadas. Usar cuando el usuario pida el clima o /clima.
argument-hint: "[Lerma|Villa|CDMX|Leon]"
allowed-tools: WebFetch, WebSearch
---

# Clima

Muestra el clima actual y el pronóstico corto de una ciudad, citando siempre las fuentes consultadas.

## 1. Determinar la ciudad

Argumento recibido: `$ARGUMENTS`

Compara el argumento sin distinguir mayúsculas/minúsculas ni acentos (p. ej. `león`, `LEON`, `cdmx`). Si viene vacío, usa **Lerma** (default).

| Parámetro | Ciudad | Latitud | Longitud |
|-----------|--------|---------|----------|
| `Lerma` (default) | Lerma de Villada, Estado de México, México | 19.2847 | -99.5119 |
| `Villa` | Villa Cuauhtémoc (Otzolotepec), Estado de México, México | 19.4317 | -99.5500 |
| `CDMX` | Ciudad de México, México | 19.4326 | -99.1332 |
| `Leon` | León, Guanajuato, México | 21.1250 | -101.6860 |

Si el argumento no coincide con ninguna opción, indícalo al usuario, lista las opciones válidas y no consultes nada.

## 2. Obtener los datos

**Fuente principal — Open-Meteo** (sin API key). Usa WebFetch con esta URL, sustituyendo `LAT` y `LON`:

```
https://api.open-meteo.com/v1/forecast?latitude=LAT&longitude=LON&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FMexico_City&forecast_days=3
```

Interpreta `weather_code` según la tabla WMO de Open-Meteo (0 despejado; 1–3 mayormente despejado/parcialmente nublado/nublado; 45–48 niebla; 51–57 llovizna; 61–67 lluvia; 71–77 nieve; 80–82 chubascos; 95–99 tormenta).

**Fuente de contraste (opcional pero recomendada)**: usa WebSearch con `clima <nombre de la ciudad> hoy` y, si hay un resultado confiable (SMN/CONAGUA, Meteored, AccuWeather, weather.com), úsalo para complementar o validar. Si las fuentes difieren notablemente, menciónalo.

Si Open-Meteo falla, recurre a WebSearch/WebFetch sobre las fuentes anteriores y dilo explícitamente.

## 3. Formato de respuesta (en español)

```
## Clima en <Ciudad completa>
_Actualizado: <fecha y hora local de los datos>_

**Ahora:** <descripción> · <temp> °C (sensación <temp> °C)
Humedad: <x> % · Viento: <x> km/h · Precipitación: <x> mm

### Próximos días
| Día | Condición | Mín / Máx | Prob. lluvia |
|-----|-----------|-----------|--------------|
| ... | ...       | ... °C / ... °C | ... % |

### Referencias
- Open-Meteo Forecast API — <URL exacta consultada>
- <Otras fuentes consultadas con título y URL>
```

Reglas:
- La sección **Referencias** es obligatoria y debe listar **todas** las URLs realmente consultadas (incluidas las búsquedas usadas).
- No inventes datos: si un valor no está disponible, escribe "N/D".
