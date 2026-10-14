# NEXO MX 2030
## Observatorio conversacional de inclusión y comercio digital en México

**Lema:** *Del acceso a la compra: quién queda fuera, por qué y qué intervención funciona.*

**Nombre expandido:** **NEXO MX** — Navegador de Equidad, eXpansión y Oportunidades del comercio digital.

---

# 1. Resumen ejecutivo

NEXO MX 2030 es una plataforma de inteligencia pública y privada que combina:

1. **Diagnóstico económico-estadístico reproducible** del consumo electrónico en México.
2. **Chatbot analítico de pantalla completa** que responde con cifras, gráficas, mapas, intervalos de confianza, fuentes y metodología.
3. **Mapa territorial de demanda potencial y oferta omnicanal**, con estimaciones directas a nivel estatal y estimaciones modeladas a nivel municipal.
4. **Simulador de escenarios a 2030**, con supuestos explícitos y bandas de incertidumbre.
5. **Portafolio de intervenciones Puentes NEXO**, dirigido por segmento, barrera y territorio, para gobierno, ANTAD, minoristas, instituciones financieras y operadores logísticos.

La tesis central es que la brecha no termina al conectar a una persona a internet. El tránsito completo es:

> acceso → habilidades → medios de pago → confianza → primera compra → repetición → experiencia satisfactoria → integración al comercio formal omnicanal.

NEXO identifica en qué eslabón se pierde cada segmento y recomienda la intervención con mayor alcance, equidad, factibilidad e impacto esperado.

---

# 2. Traducción del reto a productos concretos

| Pregunta del reto | Entregable NEXO |
|---|---|
| Diagnóstico general | Embudo nacional y estatal de adopción digital, 2015–2025 |
| ¿Quién compra? | Perfiles, efectos marginales y brechas por edad, sexo, escolaridad, localidad, hogar e ingreso imputado |
| ¿Qué compra? | Canasta digital por categoría, frecuencia, medio de entrega y forma de pago |
| Barreras | Taxonomía y personas estadísticas de exclusión digital |
| Problemas de compradores | Índice de fricción, confianza y madurez del ecosistema |
| Diferencias territoriales | Estimación directa estatal y MRP municipal con incertidumbre |
| Mercado en 2030 | Simulador de cuatro escenarios y efectos económicos |
| Estrategias | Recomendador de intervenciones públicas y privadas con KPIs y diseño de evaluación |

---

# 3. Propuesta diferenciadora

## 3.1 No será solo un dashboard

El producto central es un **copiloto analítico verificable**. Cada respuesta del chatbot deberá incluir:

- conclusión breve;
- métrica o comparación solicitada;
- gráfica o mapa generado con datos revisados;
- fuente, año y universo;
- indicación de si la cifra es observada o modelada;
- intervalo de confianza, coeficiente de variación o bandera de precisión;
- explicación de cálculo;
- advertencia metodológica pertinente.

## 3.2 No será RAG puro

El modelo de lenguaje no calculará estadísticas ni ejecutará SQL arbitrario. La arquitectura será:

1. Clasificar intención.
2. Elegir una función analítica permitida.
3. Consultar una capa semántica con métricas ya validadas.
4. Recuperar notas metodológicas y fuentes.
5. Redactar la explicación a partir de un objeto estructurado.
6. Validar que toda cifra tenga procedencia antes de mostrarla.

## 3.3 Demanda y oferta en el mismo mapa

Se construirá un **Índice de Oportunidad Omnicanal** que combine:

- demanda potencial de consumidores;
- brecha de conversión entre acceso y compra;
- capacidad de gasto del hogar;
- inclusión financiera;
- conectividad territorial;
- densidad y madurez digital del comercio formal;
- logística y puntos potenciales de recolección/devolución.

El cuadrante de mayor interés será: **alta demanda potencial + baja oferta omnicanal formal**.

---

# 4. Fuentes oficiales, submódulos y uso analítico

## 4.1 ENDUTIH 2025 — fuente principal de adopción

**Portal:** https://www.inegi.org.mx/programas/endutih/2025/

**Cuestionario:** https://www.inegi.org.mx/contenidos/programas/endutih/2025/doc/CENDUTIH2025.pdf

**Uso principal:** acceso a internet, habilidades, compra en línea, barreras, frecuencia, categorías, entrega, problemas, pagos y banca digital.

### Submódulos conceptuales

La edición 2024 se publicó en cinco tablas y la edición 2025 debe validarse al descargar sus microdatos antes de fijar nombres físicos:

- `viviendas`: identificación, servicios y diseño muestral;
- `residentes`: composición y características sociodemográficas del hogar;
- `hogares`: disponibilidad, gasto y calidad de TIC;
- `usuarios`: computadora, internet, compras, pagos y problemas;
- `usuarios2`: telefonía móvil, radio y televisión.

**Regla de ingestión:** detectar nombres y columnas desde el paquete 2025 y su descriptor; no asumir que los nombres 2024 son idénticos.

### Bloque crítico del cuestionario

- P7.21: compra en línea en los últimos 12 meses.
- P7.22: motivos para no comprar.
- P7.23: frecuencia.
- P7.24: categorías de bienes y servicios.
- P7.25: medio de entrega.
- P7.26: existencia de problemas.
- P7.27: tipo de problema.
- P7.28–P7.32: pagos en línea, frecuencia, propósito y método.

### Variables derivadas propuestas

- `internet_user`
- `online_buyer_12m`
- `purchase_frequency_index`
- `digital_payment_user`
- `online_banking_user`
- `buyer_problem_any`
- `trust_barrier`
- `skills_barrier`
- `payment_barrier`
- `access_barrier`
- `delivery_friction`
- `digital_skill_score`

## 4.2 ENIGH 2024, Nueva Serie — ingreso, gasto y hogar

**Portal:** https://www.inegi.org.mx/programas/enigh/nc/2024/

**Descriptor:** https://www.inegi.org.mx/contenidos/programas/enigh/nc/2024/microdatos/889463924494.pdf

### Tablas relevantes

- `VIVIENDAS`
- `HOGARES`
- `POBLACION`
- `GASTOSHOGAR`
- `GASTOSPERSONA`
- `GASTOTARJETAS`
- `EROGACIONES`
- `INGRESOS`
- `TRABAJOS`
- `CONCENTRADOHOGAR`

### Llaves y diseño

- vivienda: `folioviv`;
- hogar: `folioviv`, `foliohog`;
- persona: `folioviv`, `foliohog`, `numren`;
- diseño: `factor`, `est_dis`, `upm` en las tablas correspondientes.

### Variables útiles

- ingreso corriente total y per cápita;
- decil de ingreso construido;
- gasto por clasificación COICOP/CCIF;
- composición y tamaño del hogar;
- equipamiento y acceso a internet;
- ocupación e informalidad;
- `forma_pag1`, `forma_pag2`, `forma_pag3`;
- `lugar_comp` cuando el apartado del cuestionario lo soporte.

### Advertencia obligatoria

El código `lugar_comp = 18` significa internet, pero su descriptor se refiere al lugar de compra o consumo de alimentos, bebidas y/o tabaco. No debe utilizarse como si midiera todo el gasto electrónico del hogar. Para otros rubros se construirá **gasto potencialmente digitalizable**, no “gasto electrónico observado”.

## 4.3 Encuesta Intercensal 2025 — municipalización y postestratificación

**Portal:** https://www.inegi.org.mx/programas/eic/2025/

**Uso principal:** denominadores y celdas de población para MRP, contexto municipal, tamaño de localidad, escolaridad, edad, hogar, discapacidad, pertenencia indígena/afromexicana, actividad económica y TIC en la vivienda.

### Variables/indicadores prioritarios

- viviendas con internet (`PCN_VPH_INTER` en el sistema de indicadores);
- celular;
- computadora, laptop o tableta;
- estructura por edad y sexo;
- escolaridad;
- población indígena y hablante de lengua indígena;
- discapacidad;
- tamaño y composición del hogar;
- tamaño de localidad;
- participación económica.

### Regla de precisión

Conservar los cinco campos publicados por indicador: estimación, error estándar, límite inferior, límite superior y coeficiente de variación. Respetar el nivel de confianza de 90 % usado por la EIC.

## 4.4 ENOE 2025 — empleo, informalidad y capacidad económica

**Portal:** https://www.inegi.org.mx/programas/enoe/15ymas/

### Tablas

- `VIVT<PERIODO>` — vivienda;
- `HOGT<PERIODO>` — hogar;
- `SDEMT<PERIODO>` — sociodemográfico y variables reconstruidas;
- `COE1T<PERIODO>` — cuestionario de ocupación, parte I;
- `COE2T<PERIODO>` — cuestionario de ocupación, parte II.

### Variables útiles

- condición de actividad;
- ocupación y sector;
- informalidad laboral;
- tamaño de establecimiento;
- posición en la ocupación;
- trabajo por cuenta propia;
- horas e ingreso por trabajo;
- subocupación;
- acceso a seguridad social.

**Uso:** contexto de vulnerabilidad laboral y capacidad de adopción, no unión persona a persona con ENDUTIH.

## 4.5 ENIF 2024 — inclusión financiera

**Portal:** https://www.inegi.org.mx/programas/enif/2024/

### Tablas

- `TVIVIENDA`
- `THOGAR`
- `TSDEM`
- `TMODULO`

### Variables útiles

- cuenta financiera;
- tarjeta de débito/crédito;
- banca móvil y aplicaciones;
- transferencias y pagos digitales;
- ahorro formal e informal;
- confianza, habilidades y bienestar financiero.

**Cobertura:** usar a nivel nacional, regional y por tamaño de localidad conforme al diseño; no fabricar estimaciones estatales si el diseño no las soporta.

## 4.6 Censos Económicos 2024 — oferta y digitalización empresarial

**Portal:** https://www.inegi.org.mx/programas/ce/2024/

**Uso:** compra/venta por internet, tamaño de establecimiento, sector SCIAN, formalidad, empleo, ingresos, gastos, valor agregado y geografía.

**Regla:** usar resultados definitivos corregidos. No mezclar totales definitivos con cifras oportunas previas.

## 4.7 VABCOEL 2024 — escala macroeconómica

**Portal:** https://www.inegi.org.mx/temas/vabcoel/

**Uso:** contribución del comercio electrónico al PIB, crecimiento real y composición entre comercio al por menor, mayorista y otros servicios.

**Regla:** valor agregado no equivale a ventas, GMV ni gasto de hogares.

## 4.8 MIP 2018 — impactos económicos indirectos

**Portal:** https://www.inegi.org.mx/programas/mip/2018/

**Uso:** multiplicadores de producción, valor agregado y empleo de escenarios de demanda adicional en comercio, logística, telecomunicaciones y servicios relacionados. Actualizar monetariamente y documentar supuestos; presentar rangos, no falsa precisión.

## 4.9 DENUE — tejido comercial y logística potencial

**API:** https://www.inegi.org.mx/servicios/api_denue.html

**Campos:** CLEE, actividad SCIAN, estrato de personal, tipo de establecimiento, municipio/localidad, sitio web y coordenadas.

**Uso:** densidad de comercio formal, cobertura sectorial, cercanía a nodos y selección propuesta de puntos de recolección/devolución.

## 4.10 CNBV — infraestructura financiera municipal

**Portal:** https://www.gob.mx/cnbv/acciones-y-programas/bases-de-datos-de-inclusion-financiera

**Variables:** sucursales, corresponsales, cajeros, TPV, contratos de banca móvil, cuentas, crédito y transacciones. Usar el corte municipal más reciente compatible con el análisis.

## 4.11 IFT — cobertura móvil

**Portal:** https://www.ift.org.mx/mapas-de-cobertura-del-servicio-de-datos-moviles

**Uso:** cobertura 4G observada por crowdsourcing y/o cobertura reportada por operadores. Mantener ambas como capas distintas y conservar sus advertencias metodológicas.

## 4.12 Marco Geoestadístico 2025

**Ficha:** https://www.inegi.org.mx/app/biblioteca/ficha.html?upc=794551163061

**Capas:** entidad, municipio, localidad, AGEB, manzana y otras geometrías. Usar claves oficiales de año y una tabla de correspondencias territoriales.

## 4.13 PROFECO — módulo opcional de confianza

**Portal:** https://burocomercial.profeco.gob.mx/

**Uso:** motivos de reclamación y quejas concluidas/publicables. No interpretarlo como el universo total de quejas ni como incidencia por comprador sin un denominador adecuado.

---

# 5. Arquitectura de datos y repositorio

```text
nexo-mx-2030/
├── data/
│   ├── raw/                 # archivos originales, solo lectura
│   ├── interim/             # limpieza intermedia
│   ├── processed/           # marts analíticos
│   ├── geo/                 # geometrías simplificadas
│   └── manifests/           # URL, fecha, hash, licencia, versión
├── src/
│   ├── ingestion/
│   │   ├── endutih/
│   │   ├── enigh/
│   │   ├── eic/
│   │   ├── enoe/
│   │   ├── enif/
│   │   ├── censos_economicos/
│   │   ├── vabcoel/
│   │   ├── mip/
│   │   ├── denue/
│   │   └── cnbv_ift/
│   ├── metadata_registry/
│   ├── harmonization/
│   ├── survey_design/
│   ├── features/
│   ├── econometrics/
│   ├── segmentation/
│   ├── mrp/
│   ├── spatial/
│   ├── scenarios/
│   ├── economic_impact/
│   ├── policy_optimizer/
│   └── semantic_layer/
├── exports/
│   ├── database/
│   ├── charts/
│   ├── geojson/
│   └── reports/
├── web/
├── tests/
└── docs/
```

## Marts analíticos

- `mart_person_adoption_endutih`
- `mart_household_capacity_enigh`
- `mart_municipality_context_eic`
- `mart_labor_context_enoe`
- `mart_financial_inclusion_enif_cnbv`
- `mart_business_supply_ce_denue`
- `mart_macro_vabcoel_mip`
- `fact_estimates`
- `fact_scenarios`
- `fact_intervention_scores`

## Reglas de integración

1. No unir personas de encuestas distintas.
2. Unir únicamente por geografía-año, dominio o mediante fusión estadística documentada.
3. Mantener separado el universo persona, hogar, vivienda y establecimiento.
4. Conservar pesos, estratos y UPM.
5. Distinguir siempre estimación directa, imputada y modelada.
6. Versionar cada fuente con fecha y hash.
7. No publicar microdatos identificables ni coordenadas sensibles de encuestas.

---

# 6. Plan estadístico y econométrico

## 6.1 Estimación descriptiva con diseño complejo

Para ENDUTIH, ENIGH, ENOE y ENIF:

- totales, proporciones y medias ponderadas;
- errores estándar por linearización de Taylor o replicación cuando corresponda;
- intervalos de confianza;
- coeficientes de variación;
- banderas de precisión;
- comparación de proporciones con pruebas Wald/Rao–Scott;
- corrección por comparaciones múltiples en rankings extensos.

## 6.2 Embudo de adopción

Construir, dentro del universo válido de ENDUTIH:

1. acceso a internet;
2. uso de internet;
3. habilidades digitales;
4. pagos/banca digital;
5. compra en línea en 12 meses;
6. compra recurrente;
7. compra sin problema reportado.

No multiplicar porcentajes de universos distintos sin recalcular el denominador.

## 6.3 Modelo de propensión de compra

Modelo principal: regresión logística ponderada y multinivel.

```text
Pr(compra_online = 1) = f(
  edad, sexo, escolaridad, actividad,
  tamaño_localidad, estado,
  composición_hogar, acceso_dispositivo,
  habilidades_TIC, pagos_digitales,
  identidad_indígena/afro, discapacidad
)
```

Entregables:

- efectos marginales promedio;
- probabilidades ajustadas por segmento;
- interacciones prioritarias;
- calibración, discriminación y validación temporal/territorial;
- análisis de sensibilidad para población de 15 años y más.

## 6.4 Ingreso imputado de forma transparente

ENDUTIH no debe fingir observar ingreso si no lo captura directamente. Se propone:

1. crear variables comunes ENDUTIH–ENIGH;
2. hacer emparejamiento estadístico o imputación múltiple;
3. predecir decil/rango de ingreso, no pesos exactos;
4. calibrar la distribución por entidad y tamaño de localidad contra ENIGH;
5. validar fuera de muestra;
6. etiquetar siempre como **“decil de ingreso imputado”**.

## 6.5 Descomposición de brechas

- Fairlie para resultados binarios: rural–urbano, menor–mayor escolaridad, baja–alta capacidad económica.
- Oaxaca–Blinder solo para resultados continuos apropiados.
- Separar componente explicado de componente residual sin interpretarlo automáticamente como causalidad o discriminación.

## 6.6 Segmentación de barreras

Aplicar análisis de clases latentes ponderado o clustering mixto estable. Elegir número de segmentos con BIC, estabilidad y utilidad de política.

Personas de trabajo iniciales, sujetas a validación:

1. **Conectado pero desconfiado**.
2. **Móvil y dependiente del efectivo**.
3. **Conectado sin habilidades/interés**.
4. **Territorio con déficit de infraestructura**.
5. **Comprador activo con fricción**.
6. **Alta demanda latente y baja oferta formal**.

## 6.7 Estimación municipal con MRP

1. Ajustar modelo multinivel en ENDUTIH.
2. Construir celdas municipio × edad × sexo × escolaridad × localidad con EIC 2025.
3. Postestratificar predicciones a cada municipio.
4. Propagar incertidumbre mediante simulaciones o draws posteriores.
5. Agregar predicciones municipales a entidad y compararlas con estimaciones directas ENDUTIH.
6. Publicar como **estimación modelada**, nunca como cifra observada.

## 6.8 Análisis espacial

- Moran global;
- LISA/local Moran;
- clústeres alto-alto, bajo-bajo, alto-bajo y bajo-alto;
- análisis de sensibilidad a la matriz de vecindad;
- mapas con incertidumbre, no solo mapas de color.

## 6.9 Índice de Oportunidad Omnicanal

Normalizar componentes y publicar también cada componente por separado.

```text
Oportunidad =
  demanda_latente
  × brecha_de_conversión
  × capacidad_de_gasto
  × factibilidad_financiera
  × conectividad
  × (1 - madurez_oferta_formal)
```

El ranking final debe incluir análisis de sensibilidad a los pesos. Una opción robusta es mostrar el rango de posición bajo múltiples ponderaciones, no un único ranking absoluto.

## 6.10 Escenarios 2030

Modelo de difusión jerárquico logístico o Gompertz, con series 2015–2025 y covariables.

Escenarios:

- **S0 Inercial:** continuidad de tendencia.
- **S1 Acceso y habilidades:** menor déficit de conectividad y alfabetización.
- **S2 Pago y confianza:** mayor acceso a medios digitales y menor fricción/temor.
- **S3 Omnicanal incluyente:** acceso + habilidades + pago + confianza + oferta formal/logística.

Resultados:

- compradores adicionales;
- reducción de brecha rural/urbana y por escolaridad;
- frecuencia esperada;
- gasto potencialmente digitalizable, como rango;
- ventas formales potencialmente capturables, como rango;
- impacto en producción, valor agregado y empleo con MIP, bajo supuestos explícitos.

Los efectos de intervención serán escenarios de sensibilidad mientras no exista evidencia causal mexicana. El piloto generará dicha evidencia.

---

# 7. Solución pública-privada: Puentes NEXO

| Módulo | Barrera | Acción propuesta | Actores potenciales | KPI |
|---|---|---|---|---|
| NEXO Acceso | conectividad/costo | acceso asistido, experiencia de bajo consumo de datos | gobierno, telecom, comercio | hogares/personas habilitadas |
| NEXO Hábil | habilidades | acompañamiento a primera compra y seguridad digital | comercio, educación, municipios | primera compra completada |
| NEXO Pago | efectivo/no cuenta | onboarding a cuenta, tarjeta o pago digital y puentes efectivo-digital | bancos, fintech, comercios | pago digital y repetición |
| NEXO Confianza | fraude/calidad | protección de primera compra, devolución clara, trazabilidad y educación antifraude | comercios, PROFECO, logística | problemas y tiempo de resolución |
| NEXO Comercio | baja madurez de MIPYME | kit “Omnicanal Lite”: catálogo, inventario, pago, entrega y métricas | ANTAD, cámaras, plataformas | comercios activos y ventas digitales |
| NEXO Territorio | logística | nodos propuestos de recolección/devolución en comercios existentes | minoristas y operadores | cobertura y costo de última milla |
| NEXO Inclusivo | accesibilidad | UX accesible, lenguaje claro y apoyo a adultos mayores, discapacidad y población indígena | todos | adopción en grupos prioritarios |

NEXO no debe afirmar que existe una alianza con ANTAD, gobierno o empresas. Debe describirlos como **actores potenciales**.

## Priorización de intervenciones

```text
Puntaje =
  alcance × impacto_modelado × equidad × factibilidad
  ---------------------------------------------------
                costo_relativo
```

Mostrar los componentes y permitir cambiar ponderaciones.

## Evaluación causal del piloto

Diseño recomendado:

- ensayo aleatorizado por clúster o implementación escalonada;
- alternativa: diferencias en diferencias con municipios comparables;
- mediciones 0, 3, 6 y 12 meses;
- resultados: primera compra, repetición, pago digital, problemas, ventas digitales, formalización y costo por adopción adicional.

---

# 8. Experiencia web

## 8.1 Pantalla principal

Ruta `/` en `100dvh`, sin una landing tradicional.

### Escritorio

- **Rail izquierdo colapsable:** Inicio, Explorar, Mapa, Segmentos, Escenarios 2030, Acciones, Metodología, Fuentes.
- **Centro:** conversación, preguntas sugeridas, respuestas y composer fijo.
- **Panel derecho de evidencia:** gráfica, mapa, tarjetas de métricas, fuente y método. Puede ocultarse.
- **Barra superior:** filtros de año, entidad, ruralidad, sexo, edad, escolaridad e ingreso imputado.

### Móvil

- conversación a pantalla completa;
- filtros en drawer;
- evidencia en bottom sheet;
- composer fijo y accesible al teclado.

## 8.2 Preguntas sugeridas

- “¿Qué grupos tienen menor probabilidad de comprar en línea?”
- “Compara la brecha rural y urbana en 2025.”
- “¿Qué barreras explican más la exclusión digital?”
- “¿Dónde hay alta demanda potencial y baja oferta formal?”
- “Simula qué pasaría en 2030 al reducir la barrera de medios de pago.”
- “¿Por qué esta cifra municipal aparece como modelada?”

## 8.3 Formato de respuesta del chatbot

```json
{
  "answer": "Texto breve y verificable",
  "metrics": [
    {
      "label": "Compradores en línea",
      "value": 37.3,
      "unit": "%",
      "ci_low": null,
      "ci_high": null,
      "precision_flag": "official_baseline"
    }
  ],
  "visual": {
    "type": "map|bar|line|funnel|quadrant|table",
    "title": "",
    "data": []
  },
  "citations": [
    {
      "source_id": "ENDUTIH_2025",
      "title": "ENDUTIH 2025",
      "year": 2025,
      "url": "",
      "table_or_question": "P7.21"
    }
  ],
  "methodology": {
    "universe": "Personas usuarias de internet de 6 años y más",
    "observed_or_modeled": "observed",
    "method": "Estimación oficial o estimación ponderada con diseño complejo"
  },
  "warnings": []
}
```

## 8.4 Reglas del chatbot

- Nunca inventar cifras o fuentes.
- Nunca inferir causalidad de una asociación.
- Nunca mezclar denominadores.
- Nunca llamar “observada” a una estimación MRP o imputación.
- No ejecutar SQL libre proporcionado por el usuario.
- No exponer prompts internos, secretos o cadenas de conexión.
- Rechazar comparaciones sin muestra suficiente y explicar por qué.
- Ofrecer descarga CSV/PNG únicamente de datos ya filtrados y revisados.

---

# 9. Arquitectura técnica

## MVP recomendado

- **Frontend y SSR:** plantilla actual de Lovable con TanStack Start + TypeScript.
- **Diseño:** Tailwind y componentes accesibles.
- **Backend:** Lovable Cloud para el prototipo competitivo.
- **Base:** Postgres administrado.
- **Funciones:** Edge Functions.
- **IA:** conector de IA de Lovable desde backend.
- **Gráficas:** ECharts o Recharts.
- **Mapas:** MapLibre GL y GeoJSON simplificado.
- **Validación:** Zod.
- **Pruebas:** unitarias, integración y browser testing.

## División de responsabilidades

- **Python/R:** encuestas complejas, modelos, MRP, escenarios, multiplicadores y generación de outputs revisados.
- **Postgres:** métricas y resultados normalizados.
- **Edge Function:** clasificar intención, llamar funciones permitidas, ensamblar evidencia y narrar.
- **LLM:** lenguaje y explicación; no fuente de verdad numérica.
- **Lovable UI:** interacción, filtros, visualización y exportación.

## Esquema de base

- `dim_geography`
- `dim_segment`
- `dim_metric`
- `dim_method`
- `fact_estimate`
- `fact_barrier`
- `fact_category`
- `fact_problem`
- `fact_supply`
- `scenario_definition`
- `scenario_result`
- `intervention`
- `intervention_score`
- `source_document`
- `source_chunk`
- `methodology_note`
- `chat_session`
- `chat_message`

### Campos mínimos de `fact_estimate`

```text
metric_code
reference_year
source_id
universe_id
geo_level
geo_code
segment_json
estimate
unit
standard_error
ci_low
ci_high
confidence_level
cv
precision_flag
observed_or_modeled
method_id
version
created_at
```

## Funciones analíticas permitidas

- `get_metric`
- `compare_segments`
- `rank_geographies`
- `get_barriers`
- `get_categories`
- `get_problems`
- `get_opportunity_map`
- `get_scenario`
- `get_interventions`
- `get_sources`

---

# 10. Semillas oficiales para construir la interfaz

Estas cifras sirven para el primer demo y deben quedar etiquetadas por fuente/universo:

- 86.1 % de la población de 6 años y más usó internet en 2025.
- 37.3 % de las personas usuarias de internet compró productos o servicios en línea.
- compra en línea entre usuarios: 41.1 % urbana y 20.2 % rural.
- 78.3 % de los hogares tenía internet.
- 75.7 % de las viviendas particulares habitadas tenía internet en la EIC 2025; no es el mismo universo que ENDUTIH.
- VABCOEL 2024: 2,308,458 millones de pesos corrientes, 6.9 % del PIB y crecimiento real de 7.1 %.

No usar cifras de demostración para estimaciones no calculadas. Mostrar skeletons o estados “dato pendiente de carga”.

---

# 11. Plan de trabajo de 20 días hábiles

## Sprint 1 — fuentes y replicación, días 1–4

- manifiesto de fuentes y descarga;
- diccionarios y universos;
- claves geográficas;
- pipeline de ingestión;
- replicar baselines oficiales nacionales;
- pruebas de pesos y llaves.

## Sprint 2 — diagnóstico, días 5–9

- embudo y tendencias;
- perfiles;
- barreras, categorías, medios de entrega y problemas;
- inclusión financiera;
- oferta empresarial;
- primera versión de capa semántica.

## Sprint 3 — modelos y propuesta, días 10–14

- modelos ajustados y efectos marginales;
- ingreso imputado;
- segmentación;
- MRP municipal;
- índice de oportunidad;
- escenarios 2030;
- Puentes NEXO y diseño de piloto.

## Sprint 4 — producto y cierre, días 15–20

- web y chatbot;
- mapas y simulador;
- QA estadístico;
- accesibilidad y seguridad;
- narrativa, demo y pitch;
- paquete reproducible y documentación.

---

# 12. Criterios de calidad

- replicar baselines oficiales dentro de tolerancia de redondeo;
- respetar diseño muestral y dominios válidos;
- mostrar intervalos/CV y banderas de precisión;
- validar MRP agregando municipios a resultados estatales;
- validación temporal y territorial de modelos;
- análisis de sensibilidad a pesos del índice y supuestos 2030;
- trazabilidad de cada cifra hasta fuente y versión;
- cero cifras hardcodeadas fuera de semillas oficiales marcadas;
- estados de carga, vacío y error;
- RLS, rate limiting y validación de inputs;
- contraste WCAG, teclado y lector de pantalla;
- funcionamiento en móvil, tablet y desktop.

---

# 13. Datos que debe producir el equipo analítico antes de la demo final

1. `estimates.csv` — métricas directas e intervalos.
2. `barriers.csv` — razones y segmentos.
3. `categories.csv` — bienes/servicios, frecuencia y entrega.
4. `problems.csv` — fricciones de compradores.
5. `municipality_mrp.csv` — estimaciones municipales con intervalos.
6. `supply.csv` — oferta, comercio formal y conectividad.
7. `opportunity.csv` — componentes, índice y sensibilidad.
8. `scenarios.csv` — escenario, año, segmento, supuesto y resultado.
9. `interventions.csv` — segmentos, módulos y KPIs.
10. `sources.csv` — linaje y metadatos.
11. `municipalities.geojson` — geometrías simplificadas con claves 2025.

---

# 14. Mensaje central para el pitch

> México ya no enfrenta una sola brecha digital. Enfrenta una cadena de brechas entre estar conectado, poder pagar, confiar, comprar y volver a comprar. NEXO MX 2030 identifica exactamente dónde se rompe esa cadena para cada segmento y territorio, calcula qué oportunidad económica se pierde y convierte el diagnóstico en intervenciones medibles para consumidores y comercio formal.

