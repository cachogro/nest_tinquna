# Promedios de mineral — guía para el front

Un **promedio** agrupa valorizaciones (PRE-VALORIZADO o VALORIZADO) elegidas por el usuario y calcula la **ley promedio ponderada por peso** de cada mineral. Cada promedio tiene su propio código (`PRM-0001`).

Una valorización que ya es parte de un promedio **no vuelve a aparecer** para seleccionar (hasta que el promedio se anule o se la quite de él).

## Convenciones

- **Base URL:** `http://<host>:3000/api/comercio_interno`
- **Auth:** todos los endpoints requieren `Authorization: Bearer <token>`.
- **Validación estricta:** el backend rechaza (400) cualquier campo o query param que no esté documentado aquí.
- **Ids son strings** (`"12"`, no `12`), porque son `bigint`.
- **Números:** pesos y leyes llegan como `number`.
- **Fechas:** `YYYY-MM-DD`.
- **Paginación** (listados): `page` (def. 1), `limit` (def. 10), `busqueda`, `orderDirection` (`ASC`|`DESC`). Respuesta:
  `{ data: [...], total, page, limit, totalPages }`

## Flujo en pantalla

1. **Pantalla "Nuevo promedio":** llamar `GET /promedio_mineral/disponibles?codificacion=ICC` → tabla con checkbox (código, proveedor, sacos, peso, ley).
2. El usuario marca filas. El front puede mostrar en vivo el total de kg y la ley promedio (fórmula abajo) como vista previa.
3. **Guardar:** `POST /promedio_mineral` con `idsValorizacion` de las filas marcadas → devuelve el promedio con su código `PRM-XXXX` y las leyes calculadas por el backend (usar esos valores como definitivos).
4. **Listado:** `GET /promedio_mineral`. **Detalle:** `GET /promedio_mineral/:id`.
5. **Editar composición:** `PATCH /promedio_mineral/:id` con la lista completa nueva de `idsValorizacion`.
6. **Anular:** `DELETE /promedio_mineral/:id` → sus valorizaciones quedan disponibles otra vez.

### Fórmula (para vista previa en el front)

Por cada mineral, sobre las valorizaciones marcadas que tienen ese mineral:

```
leyPromedio = Σ(ley × pesoKg) / Σ(pesoKg)
```

Igual que el `SUMPRODUCT/SUM` del Excel PROMEDIOS.xlsx.

---

## 1. Valorizaciones disponibles

`GET /promedio_mineral/disponibles`

Lista valorizaciones **PRE-VALORIZADO (2) y VALORIZADO (3)**, activas, que **no** pertenecen a ningún promedio.

| Query | Tipo | Def. | Descripción |
|---|---|---|---|
| `codificacion` | string | — | Código de codificación: `ICC`, `AC`… (no distingue mayúsculas). |
| `idCodificacion` | number | — | Alternativa por id de codificación. |
| `estado` | `ambas` \| `pre_valorizadas` \| `valorizadas` | `ambas` | Filtra por estado. |
| `busqueda` | string | — | Proveedor (nombres/apellidos) o código de operación. |
| `page`, `limit` | number | 1, 10 | Paginación. |
| `orderBy` | `codigoOperacion` \| `peso` \| `id` | `codigoOperacion` | Orden. |
| `orderDirection` | `ASC` \| `DESC` | `ASC` | Dirección. |

**Ejemplo**

```
GET /api/comercio_interno/promedio_mineral/disponibles?codificacion=ICC&estado=ambas&page=1&limit=50
```

**200 OK**

```json
{
  "data": [
    {
      "idValorizacion": "412",
      "codigoOperacion": "ICC-1797",
      "codificacion": "ICC",
      "proveedor": "CARLOS GARCIA",
      "numeroSacos": 2,
      "pesoKg": 57,
      "valorNetoVentaBolivianos": 17270,
      "leyes": [
        { "idMineral": "1", "mineral": "Ag", "ley": 196, "unidad": "DM" }
      ],
      "idEstadoValorizacion": 3,
      "estadoValorizacion": "VALORIZADO",
      "entregado": false,
      "fechaValorizacion": "2026-07-03"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

Notas:
- `idValorizacion` es el valor que se envía luego en `idsValorizacion`.
- `leyes` puede traer varios minerales (Ag, Pb, Zn…). Puede venir vacío si la valorización no tiene detalle.
- `numeroSacos` puede ser `null`.
- `valorNetoVentaBolivianos` es el valor neto de venta (Bs) de la valorización, ya como número. Sumar los de las filas marcadas da el total efectivo invertido en vivo.

---

## 2. Crear promedio

`POST /promedio_mineral`

**Body**

| Campo | Tipo | Req. | Descripción |
|---|---|---|---|
| `idsValorizacion` | string[] | **Sí** | Mínimo 1, sin repetidos. |
| `descripcion` | string (≤150) | No | Ej. `"JULIO BAJAS 461"`. |
| `fecha` | `YYYY-MM-DD` | No | Por defecto hoy. |
| `observaciones` | string (≤255) | No | |

```json
{
  "descripcion": "JULIO BAJAS 461",
  "fecha": "2026-07-03",
  "observaciones": "Lote para venta a Villa Imperial",
  "idsValorizacion": ["412", "413", "420"]
}
```

**201 Created** (mismo formato que el detalle, sección 4)

**Errores**

| Código | Cuándo |
|---|---|
| 400 | `idsValorizacion` vacío/repetido, fecha mal formada, o alguna valorización no existe / no está activa / no está en PRE-VALORIZADO o VALORIZADO / **ya forma parte de otro promedio**. El mensaje lista los ids problemáticos: `Las valorizaciones [413] no existen, no están activas, ...`. Si pasa esto no se crea nada. |
| 401 | Token ausente o inválido. |

> Si dos usuarios seleccionan la misma valorización a la vez, solo uno lo consigue; el otro recibe el 400. En ese caso, refrescar la lista de disponibles.

---

## 3. Listado de promedios

`GET /promedio_mineral`

| Query | Tipo | Def. | Descripción |
|---|---|---|---|
| `busqueda` / `codigo` | string | — | Busca en código (`PRM-0001`) y descripción. |
| `page`, `limit` | number | 1, 10 | |
| `orderBy` | `id` \| `codigo` \| `fecha` \| `pesoTotalKilogramos` | `id` | |
| `orderDirection` | `ASC` \| `DESC` | `DESC` | |

Solo devuelve promedios **activos** (no anulados).

**200 OK**

```json
{
  "data": [
    {
      "id": "3",
      "uuid": "9b0f3c1e-...",
      "correlativo": "3",
      "codigo": "PRM-0003",
      "descripcion": "JULIO BAJAS 461",
      "fecha": "2026-07-03",
      "cantidadValorizaciones": 3,
      "numeroSacosTotal": 6,
      "pesoTotalKilogramos": 140,
      "leyes": [
        {
          "idMineral": "1",
          "mineral": "Ag",
          "leyPromedio": 152.3571,
          "leyUnidad": "DM",
          "pesoBaseKilogramos": 140
        }
      ],
      "totalEfectivoInvertido": 144325.5,
      "observaciones": "Lote para venta a Villa Imperial",
      "activo": true,
      "usuarioUltimaModificacion": "admin",
      "fechaUltimaModificacion": "2026-07-03T15:20:11.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

---

## 4. Detalle de un promedio

`GET /promedio_mineral/:id`

Incluye cabecera, `leyes` y `detalles` (las valorizaciones que lo conforman).

**200 OK**

```json
{
  "id": "3",
  "codigo": "PRM-0003",
  "descripcion": "JULIO BAJAS 461",
  "fecha": "2026-07-03",
  "cantidadValorizaciones": 2,
  "numeroSacosTotal": 4,
  "pesoTotalKilogramos": 104,
  "leyes": [
    { "idMineral": "1", "mineral": "Ag", "leyPromedio": 145.1154, "leyUnidad": "DM", "pesoBaseKilogramos": 104 }
  ],
  "totalEfectivoInvertido": 21050.75,
  "observaciones": null,
  "activo": true,
  "detalles": [
    {
      "id": "21",
      "idValorizacion": "412",
      "numeroSacos": 2,
      "pesoKilogramos": 57,
      "valorNetoVentaBolivianos": 17270,
      "valorizacion": {
        "id": "412",
        "recepcionMineral": {
          "codigoOperacion": "ICC-1797",
          "persona": { "nombres": "CARLOS", "apellidoPaterno": "GARCIA" },
          "codificacion": { "codigo": "ICC" }
        }
      }
    }
  ]
}
```

**Errores:** `404` si el id no existe.

> `totalEfectivoInvertido` (listado y detalle) es el **TOTAL DE EFECTIVO INVERTIDO**: la suma del valor neto de venta (Bs) de las valorizaciones del promedio. Se **guarda** al crear el promedio y al reemplazar su composición (`PATCH` con `idsValorizacion`); no cambia solo si luego se modifica el monto de una valorización. Cada elemento de `detalles` guarda su `valorNetoVentaBolivianos` (el monto con el que entró).
>
> `pesoKilogramos` y `numeroSacos` de cada detalle son los valores **con los que la valorización entró al promedio**. `pesoTotalKilogramos` es la suma.

---

## 5. Editar promedio

`PATCH /promedio_mineral/:id`

Todos los campos son opcionales; solo se modifica lo que se envíe.

| Campo | Tipo | Descripción |
|---|---|---|
| `descripcion` | string (≤150) | |
| `fecha` | `YYYY-MM-DD` | |
| `observaciones` | string (≤255) | |
| `idsValorizacion` | string[] (mín. 1) | **Reemplaza la composición completa.** Enviar la lista final, no solo las nuevas. |

Con `idsValorizacion`:
- Las que estaban y ya no vienen → se **liberan** (vuelven a "disponibles").
- Las nuevas → se **toman** (deben estar disponibles).
- Se recalculan pesos, sacos y leyes.

Si se quiere cambiar solo el texto, **no** enviar `idsValorizacion`.

```json
{
  "descripcion": "JULIO BAJAS 461 (corregido)",
  "idsValorizacion": ["412", "420", "431"]
}
```

**200 OK:** promedio completo (formato sección 4).

**Errores**

| Código | Cuándo |
|---|---|
| 400 | Promedio anulado; o una valorización nueva no está disponible (mensaje con los ids). No se aplica ningún cambio. |
| 404 | El promedio no existe. |

> Para armar la pantalla de edición: mostrar las valorizaciones actuales del promedio (`detalles`) **más** las de `GET /disponibles`.

---

## 6. Anular promedio

`DELETE /promedio_mineral/:id`

Marca el promedio como anulado y **libera todas sus valorizaciones**. Desaparece del listado.

**200 OK:** el promedio anulado (`"activo": false`).

**Errores:** `400` si ya estaba anulado; `404` si no existe.

---

## Resumen de endpoints

| Método | Ruta | Uso |
|---|---|---|
| GET | `/promedio_mineral/disponibles` | Tabla para seleccionar (ICC no promediados) |
| POST | `/promedio_mineral` | Crear promedio |
| GET | `/promedio_mineral` | Listado paginado |
| GET | `/promedio_mineral/:id` | Detalle |
| PATCH | `/promedio_mineral/:id` | Editar datos y/o composición |
| DELETE | `/promedio_mineral/:id` | Anular y liberar |

## Ejemplo con `fetch`

```ts
const API = '/api/comercio_interno';
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

// 1) disponibles ICC
const disp = await fetch(`${API}/promedio_mineral/disponibles?codificacion=ICC&limit=100`, { headers })
  .then(r => r.json());

// 2) crear con las filas marcadas
const res = await fetch(`${API}/promedio_mineral`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    descripcion: 'JULIO BAJAS 461',
    idsValorizacion: seleccionadas.map(f => f.idValorizacion),
  }),
});
if (!res.ok) {
  const err = await res.json(); // { statusCode, message, error }
  alert(err.message);           // p. ej. "Las valorizaciones [413] ... ya forman parte de otro promedio."
} else {
  const promedio = await res.json();
  console.log(promedio.codigo); // "PRM-0001"
}

// Vista previa en vivo de la ley promedio (mineral por mineral)
function leyPromedio(filas, idMineral) {
  let sp = 0, s = 0;
  for (const f of filas) {
    const l = f.leyes.find(x => x.idMineral === idMineral);
    if (l) { s += l.ley * f.pesoKg; sp += f.pesoKg; }
  }
  return sp ? s / sp : 0;
}
```

## Requisito previo (backend)

Ejecutar una vez `sql/027_create_comercio_interno_promedio_mineral.sql`.
Opcional: variable de entorno `SECUENCIA_PROMEDIO_MINERAL` (por defecto `comercio_interno.seq_promedio_mineral`).
