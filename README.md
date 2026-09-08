# 🎱 BingHo (Tablero de Bingo 1 al 90)

Aplicación para la gestión, control y proyección en vivo de tableros de Bingo (números del 1 al 90), diseñada especialmente para eventos presenciales, pantallas LED de gran formato y transmisiones en directo.

![BingHo - Tablero de Bingo 1 al 90](preview.png)

---

## 🌟 Funciones y Características

- **Tablero de Alta Visibilidad**: Grilla completa del 1 al 90 maximizada en pantalla para una lectura nítida a larga distancia.
- **Ajuste de Escala de Fuente (60% - 130%)**: Control deslizante para calibrar en tiempo real el tamaño de los números y adaptarlo a cualquier resolución o relación de aspecto de pantalla.
- **Modo Auditoría BINGO y Festejo de Cartón Ganador**:
  - Validación visual inmediata de cartones ganadores.
  - Los números correctos se destacan en **verde con zoom**.
  - Los números no cantados alertan en **rojo**.
  - Los números auditados permanecen resaltados hasta finalizar la revisión.
  - **Botón ¡CARTÓN GANADOR!**: Despliega una animación de confeti en Canvas a 60 FPS, fanfarria triunfal y cartel de felicitaciones visible simultáneamente en la pantalla del operador y en el proyector/pantalla LED (`Ctrl + W`).
- **Actualizador Integrado desde GitHub**:
  - Comprobación de nuevas versiones con un clic o al inicio.
  - Descarga directa de la última versión desde GitHub Releases.
- **Información del Sorteo en Vivo**:
  - Panel con el último número cantado en tamaño gigante.
  - Historial vertical de los últimos números salidos en orden cronológico.
  - Contador de números cantados en tiempo real (`X / 90`).
  - Campo editable para el nombre o número de sorteo.
- **Corrección de Errores Rápida**:
  - Opción para quitar un número específico ingresado por error sin interrumpir la visualización.
  - Botón de deshacer el último número cantado.
- **Temas Visuales**:
  - **Clásico**: Azul marino y amarillo de alto impacto.
  - **Alto Contraste**: Fondo negro absoluto con cian y blanco.
  - **Luz de Día**: Fondo claro con azul rey profundo, diseñado para evitar cualquier solapamiento de colores con el verde y rojo de auditoría.
- **Protección del Tablero**: Las celdas del tablero central están bloqueadas a clics directos para evitar modificaciones accidentales.
- **Persistencia Automática (Anti-Cierre)**: El estado del sorteo y los números cantados se guardan continuamente; si la aplicación se cierra por accidente, se reanuda exactamente donde quedó.
- **Efectos de Sonido**: Tonos sintetizados para el sorteo y la auditoría (con opción de silencio).
- **Modo Segunda Pantalla (Proyector / Pantalla Extendida)**:
  - Permite proyectar en un segundo monitor, proyector o pantalla gigante LED en modo escritorio extendido de Windows.
  - La pantalla de proyección muestra únicamente el panel informativo y el tablero 1-90 maximizados al 100% del espacio disponible, ocultando por completo los controles del operador.
  - Sincronización en tiempo real sin latencia entre el operador y el proyector.
  - Apertura y cierre rápido con un solo clic o con el atajo `F10`.
- **Modo Pantalla Completa**: Alternancia fluida con la tecla `F11`.

---

## ⌨️ Atajos de Teclado

| Tecla | Acción |
| :--- | :--- |
| `[Enter]` | Cantar número (en Sorteo) o Validar número (en Auditoría) |
| `[F10]` | Abrir / Cerrar Modo Segunda Pantalla (Proyector) |
| `[F11]` | Alternar Pantalla Completa |
| `[Ctrl + B]` | Entrar / Salir del Modo Auditoría BINGO |
| `[Ctrl + W]` | Festejo de Cartón Ganador (en Modo Auditoría) |
| `[Esc]` | Cerrar cuadros de diálogo o superposición de ganador |

---

## 💻 Requisitos del Sistema

- **Sistema Operativo**: Windows 10 o Windows 11 (64 bits).
- **Instalación**: No requiere instalación ni privilegios de administrador.

---

## 🚀 Instrucciones de Uso

1. **Descargar**: Descarga la última versión del archivo `BingHo.exe` desde la sección de **[Releases](https://github.com/hernancussit/BingHo/releases)**.
2. **Ejecutar**: Haz doble clic sobre `BingHo.exe` para iniciar la aplicación de forma inmediata.
3. **Proyectar**: Presiona `F11` para activar el modo pantalla completa en tu monitor, proyector o pantalla LED.

---

## 👤 Autor y Créditos

Desarrollado con ❤️ por **Hernán Cussit** ([@hernancussit](https://github.com/hernancussit)).

---

## 📄 Licencia

Este proyecto está bajo la Licencia **[MIT](LICENSE)**.
