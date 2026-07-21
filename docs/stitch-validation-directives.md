# Directivas del usuario — validación de diseño con Google Stitch

Registro de las órdenes explícitas dadas durante la sesión de validación de diseño Stitch de GLPI-Plus. Sirve como referencia para no perder contexto entre pasadas.

## Reglas activas (en orden de prioridad)

1. **100% de las pantallas deben tener un mockup real generado por Google Stitch**, no solo el sistema de diseño extraído aplicado de memoria.
   > "quiero que le pases las pantallas a google stitch y cada una el la corrija y tu las actualices... ese debe ser el proceso"
   > "no quiero ninguna pantalla hecha por ti. todas por stitch"
   > "al final deben quedar 100% pantallas generadas"

2. **Login y menú principal (sidebar) son las pantallas fundacionales.** Su diseño dicta el criterio para el resto.
   > "la primera pantalla a mejorarse es la de login y la del menu principal... eso dictara el resto de las mejoras"

3. **Ninguna pantalla puede perder campos reales al aplicar un ajuste de Stitch.** Los mockups de Stitch son simplificados y a veces inventan/omiten campos — está prohibido eliminar o simplificar un campo, input o columna que ya existe en el código real. Solo se permite ajustar estilo/agrupación/orden visual.
   > "a ninguna pantalla nueva le puede faltar campos... valida"

4. **No debe haber código muerto en la app.**
   > "no debe haber codigo muerto en la app"

5. **No deployar hasta mejorar cada pantalla del lote en curso.**
   > "no hagas deploy hasta mejorar cada pantalla"

6. **Responder siempre en español**, nunca en inglés.
   > "no sigas respondiendo en ingles... ya te lo dije y adverti"

## Reglas heredadas de la sesión (ya establecidas antes de este bloque)

- Usar Playwright para validar visualmente la app — nunca Kapture.
- No hardcodear valores de configuración en el código de la app (deben venir de variables de entorno).
- No exponer secretos/contraseñas/tokens crudos en el chat.
- 2FA es opt-in por usuario, nunca global.

## Criterio de ejecución acordado (no explícito del usuario, pero necesario para cumplir lo anterior sin generar trabajo redundante)

- No se genera un mockup de Stitch por cada una de las ~75 rutas si varias comparten el mismo patrón visual exacto (ej. lista+formulario) — se genera un mockup real por patrón/pantalla representativa y se aplica consistentemente, salvo que el usuario pida explícitamente uno por ruta literal.
- El color de acento ya validado (`--accent`, azul acero `#0369a1`) no se cambia aunque un mockup puntual muestre negro — fue una decisión ya tomada y confirmada en una pasada anterior.
- Elementos que el mockup "inventa" sin respaldo real en el modelo de datos (badges de estado que no existen, columnas de acción, tarjetas de estadísticas con números falsos, buscador/notificaciones sin funcionalidad real) NO se implementan — eso sería UI falsa, no fidelidad de diseño.
