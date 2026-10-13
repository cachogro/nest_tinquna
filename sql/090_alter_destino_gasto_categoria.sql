-- parametrica.destino_gasto: categoría para el flujo de dinero y la ganancia
-- estimada del dashboard.
--
-- No todo lo que sale de caja o banco es gasto, ni todo lo que entra es
-- ganancia. La categoría dice cómo cuenta cada destino:
--
--   Cuentan en la ganancia estimada:
--     GASTO_OPERATIVO    (resta)  combustible, servicios, laboratorio, fletes...
--     SUELDOS            (resta)  sueldos, anticipos de sueldo, aguinaldo, bonos
--     OTRO_INGRESO       (suma)   alquiler, toll, venta de combustible...
--
--   No cuentan (son flujo de dinero, no resultado):
--     COMPRA_MINERAL     ya está dentro del "efectivo invertido" de cada lote
--     VENTA_MINERAL      ya está en la liquidación de cada lote vendido
--     INVERSION          terrenos, vehículos, equipos, construcciones
--     PRESTAMO_ANTICIPO  dinero que se presta y debe volver
--     FINANCIERO         bancos, deudas, cambios de cheque, devoluciones
--
-- Ganancia estimada = utilidad de los lotes liquidados (venta − invertido)
--                     + OTRO_INGRESO − GASTO_OPERATIVO − SUELDOS.
--
-- La clasificación inicial sale del nombre de cada destino y es una
-- propuesta: se corrige desde Paramétricas › Destino del gasto. Solo se
-- aplica al crear la columna, para no pisar correcciones hechas a mano.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'parametrica'
           AND table_name = 'destino_gasto'
           AND column_name = 'categoria'
    ) THEN
        RETURN;
    END IF;

    ALTER TABLE parametrica.destino_gasto
        ADD COLUMN categoria VARCHAR(20) NOT NULL DEFAULT 'GASTO_OPERATIVO';

    -- Punto de partida: todo ingreso es OTRO_INGRESO y todo egreso GASTO_OPERATIVO.
    UPDATE parametrica.destino_gasto
       SET categoria = 'OTRO_INGRESO'
     WHERE es_egreso = false;

    -- ---------------------------------------------------------------- Ingresos
    UPDATE parametrica.destino_gasto
       SET categoria = 'VENTA_MINERAL'
     WHERE es_egreso = false
       AND UPPER(nombre) IN ('INGRESO POR VENTA', 'VENTA DE MINERALES', 'VENTA DE MINERAL ESTAÑO');

    UPDATE parametrica.destino_gasto
       SET categoria = 'FINANCIERO'
     WHERE es_egreso = false
       AND UPPER(nombre) IN ('INGRESO DE DEUDA', 'INGRESO POR CAMBIO DE CHEQUE');

    -- ----------------------------------------------------------------- Egresos
    UPDATE parametrica.destino_gasto
       SET categoria = 'COMPRA_MINERAL'
     WHERE es_egreso = true
       AND UPPER(nombre) IN (
           'ANTICIPO A CTA CARGA DE COMPLEJO DE MINERAL',
           'ANTICIPO A CTA CONCENTRADO',
           'ANTICIPO A CTA SACO MINERAL',
           'ANTICIPO A CTA SACOS DE MINERAL',
           'ANTICIPO A CTA SACOS DE MINERAL CUADERNO',
           'ANTICIPO A CTA QUIMBALATE',
           'ANTICIPO A CTA INGENIO',
           'ANTICIPO A TINTAYA',
           'COMPRA DE CARGA',
           'COMPRA DE MINERAL',
           'COMPRA DE QUIMBALENTES',
           'COOPERATIVAS',
           'RETENCIONES EN COMPRAS DE MINERAL'
       );

    UPDATE parametrica.destino_gasto
       SET categoria = 'SUELDOS'
     WHERE es_egreso = true
       AND UPPER(nombre) IN (
           'ANTICIPO A CTA PERSONAL',
           'ANTICIPO A CTA SUELDO',
           'PAGO DE SUELDO Y SALARIO EVENTUAL',
           'SUELDOS Y SALARIOS PERSONAL',
           'PERSONAL EVENTUAL',
           'BONO DE TRANSPORTE',
           'SUBSIDIO DE LACTANCIA',
           'AGUINALDO'
       );

    UPDATE parametrica.destino_gasto
       SET categoria = 'INVERSION'
     WHERE es_egreso = true
       AND UPPER(nombre) IN (
           'ANT. TERRENO GARITA SURCO',
           'ANTICIPO A CTA CONSTRUCCION GARITA SURCO',
           'ANTICIPO A CTA COMPRESORA',
           'COMPRA DE GENERADOR',
           'CONSTRUCCIONES EN PROCESO',
           'EQUIPO DE COMPUTACION',
           'EQUIPOS PARA PROCESOS DE INFORMACION',
           'EQUIPO Y MAQUINARIA',
           'INSTALACION DE CAMARAS',
           'MUEBLES Y ENSERES',
           'SISTEMA SOFTWARE',
           'TERRENO',
           'TERRENO COLAVI',
           'VEHICULO'
       );

    UPDATE parametrica.destino_gasto
       SET categoria = 'PRESTAMO_ANTICIPO'
     WHERE es_egreso = true
       AND UPPER(nombre) IN ('PRESTAMO DE DINERO');

    UPDATE parametrica.destino_gasto
       SET categoria = 'FINANCIERO'
     WHERE es_egreso = true
       AND UPPER(nombre) IN (
           'BANCO MERCANTIL SANTA CRUZ S.A.',
           'BANCO UNION S.A.',
           'BANCO FIE S.A.',
           'PAGO DE DEUDA',
           'DEVOLUCION DE DINERO',
           'INGRESO POR DEVUELTO',
           'RETIRO POR CAMBIO DE CHEQUE'
       );
END $$;

ALTER TABLE parametrica.destino_gasto
    DROP CONSTRAINT IF EXISTS ck_destino_gasto_categoria;
ALTER TABLE parametrica.destino_gasto
    ADD CONSTRAINT ck_destino_gasto_categoria CHECK (
        categoria IN (
            'GASTO_OPERATIVO', 'SUELDOS', 'OTRO_INGRESO',
            'COMPRA_MINERAL', 'VENTA_MINERAL',
            'INVERSION', 'PRESTAMO_ANTICIPO', 'FINANCIERO'
        )
    );
