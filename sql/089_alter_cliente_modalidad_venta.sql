-- parametrica.cliente: modalidad con la que el cliente compra los lotes.
--
--   COMERCIO_INTERNO: cuenta corriente. El cliente entrega anticipos sin
--                     atarlos a un lote; la empresa le va entregando lotes y
--                     cada lote LIQUIDADO se paga solo con esos anticipos, del
--                     más antiguo al más nuevo. Un lote sin liquidar no recibe
--                     nada.
--   EXPORTACION:      se cobra lote por lote (el total o por partes). Si el
--                     cliente deja un anticipo sin lote, también se aplica a
--                     sus lotes liquidados que tengan saldo.
--
-- La asignación de anticipos a lotes NO se guarda: se calcula a partir del
-- kardex CLIENTE (HABER = anticipos, DEBE = liquidaciones), que sigue siendo
-- la única fuente contable.
--
-- Hasta ahora el front deducía la exportación del tipo de actor "TRADING";
-- los clientes existentes se clasifican con esa misma regla, una sola vez.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'parametrica'
           AND table_name = 'cliente'
           AND column_name = 'modalidad_venta'
    ) THEN
        ALTER TABLE parametrica.cliente
            ADD COLUMN modalidad_venta VARCHAR(20) NOT NULL DEFAULT 'COMERCIO_INTERNO';

        UPDATE parametrica.cliente c
           SET modalidad_venta = 'EXPORTACION'
          FROM parametrica.tipo_actor_productivo_minero t
         WHERE t.id = c.id_tipo_actor_productivo_minero
           AND UPPER(TRIM(t.descripcion)) = 'TRADING';
    END IF;
END $$;

ALTER TABLE parametrica.cliente
    DROP CONSTRAINT IF EXISTS ck_cliente_modalidad_venta;
ALTER TABLE parametrica.cliente
    ADD CONSTRAINT ck_cliente_modalidad_venta CHECK (
        modalidad_venta IN ('COMERCIO_INTERNO', 'EXPORTACION')
    );
