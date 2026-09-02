# 🎱 BingHo (Tablero 1 al 90)

Aplicación de escritorio profesional desarrollada con **Electron**, **HTML5**, **CSS3 (Grid/Flexbox/Variables)** y **JavaScript Vanilla**, especialmente diseñada para proyectar tableros de Bingo en **pantallas LED de gran formato** y auditorías de cartón en tiempo real.

---

## 🌟 Características de BingHo

- **Nombre e Identidad de Marca**: Proyecto renombrado a **BingHo** con icono personalizado de bola de bingo 3D dorada y cian neón (`icon.ico` e `icon.png`).
- **Tablero Maximizado con Números Extra Grandes (96vh)**: Celdas con tipografía masiva (`clamp(20px, 4.8vmin, 58px)`) que llenan casi la totalidad del botón, optimizadas para lectura a larga distancia en escenarios y transmisiones.
- **Historial de Salidos Vertical Gigante**: La sección `ÚLTIMOS SALIDOS` en la columna izquierda muestra los números cantados en tarjetas de ancho completo apiladas verticalmente (`clamp(24px, 3.4vmin, 40px)`).
- **Columna de Información LED (Izquierda)**:
  - Título y número del sorteo ("SORTEO N° 001") con badge `● EN VIVO` (controlado y editable desde el panel lateral).
  - Tarjeta gigante del **Último Número Cantado**.
  - Contador en vivo (`CANTADOS: XX / 90`) e historial de salidos.
- **Panel de Control Compacto (Derecha)**:
  - Input para ingresar el **N° de Sorteo**.
  - Ingreso numérico con auto-focus permanente y teclado numérico.
  - Botón gigante toggle **"BINGO!"**.
  - Fila integrada `[ N° ] [ ✕ Quitar ]` para corrección de errores sin modales emergentes.
  - Selector rápido de 3 temas y pantalla completa (`F11`).
- **Modo Auditoría BINGO**:
  - El tablero mantiene su **brillo y visibilidad al 100%**.
  - Los aciertos (**verde neón con zoom 1.36x**) y los números no cantados (**rojo alerta con zoom 1.36x**) se mantienen resaltados sobre el tablero hasta que se sale del modo auditoría.
- **Tablero Protegido**: Las celdas del tablero central no responden a clics accidentales.
- **Persistencia Anti-Crash**: Sincronización continua en `localStorage`. Al reabrir el programa, el sorteo continúa exactamente donde quedó.
- **Ejecutable Único Portable (`BingHo.exe`)**:
  - Compilación directa a un solo archivo `.exe` con icono de Windows integrado listo para ejecutar sin instalación.

---

## 🚀 Comandos de Desarrollo y Compilación

### Ejecutar en modo desarrollo
```bash
npm start
```

### Compilar a un SOLO archivo Portable (.EXE) con Icono
```bash
npm run build:single
```
Genera `dist/BingHo.exe` (115 MB) con icono embebido listo para proyectar.

---

## ⌨️ Atajos de Teclado

| Tecla | Acción |
| :--- | :--- |
| `[Enter]` | Cantar número en Sorteo o Auditar en Modo Bingo |
| `[F11]` | Alternar Pantalla Completa |
| `[Ctrl + B]` | Alternar Modo Auditoría BINGO! |
| `[Esc]` | Cerrar modales |

---

## 📄 Licencia

MIT - BingHo para Proyección en Pantallas LED y Eventos en Vivo.
