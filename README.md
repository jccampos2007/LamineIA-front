# Lamene Developer Help README

¡Bienvenido a Lamene Developer Help! Esta extensión de Visual Studio Code está diseñada para ser tu asistente de programación personal, ofreciéndote consultas impulsadas por IA sobre código, prácticas recomendadas y resolución de problemas directamente en tu entorno de desarrollo.

## Características

Lamene Developer Help te proporciona las siguientes funcionalidades directamente en VS Code:

1.  **Consultas de Programación con IA:** Realiza preguntas sobre conceptos de programación, sintaxis de lenguajes, algoritmos y más. Obtén explicaciones claras y concisas para resolver tus dudas rápidamente.

    ![Consulta de sintaxis de JavaScript](images/feature-javascript-syntax.png)
    > Ejemplo de una consulta sobre la sintaxis de un bucle `for` en JavaScript.

2.  **Análisis y Mejora de Código:** Pega fragmentos de código y pregunta a la IA sobre posibles mejoras, detección de errores comunes, o alternativas más eficientes.

    ![Análisis de código Python](images/feature-python-analysis.png)
    > Ejemplo de una consulta sobre cómo mejorar un fragmento de código en Python.

3.  **Guías de Buenas Prácticas:** Pregunta sobre las mejores prácticas de codificación para diferentes lenguajes y escenarios. Obtén consejos sobre legibilidad, mantenibilidad y rendimiento.

    ![Consulta de buenas prácticas](images/feature-best-practices.png)
    > Ejemplo de una consulta sobre las mejores prácticas para la gestión de errores en Node.js.

4.  **Integración en la Barra de Actividad:** Accede fácilmente a Lamene Developer Help a través de un icono dedicado en la barra de actividad de VS Code.

    ![Icono en la barra de actividad](images/feature-activity-bar-icon.png)
    > El icono de Lamene Help en la barra de actividad para un acceso rápido.

5.  **Interfaz de Consulta Intuitiva:** Interactúa con la IA a través de un panel web integrado que muestra la lista de archivos de tu proyecto y un área de texto para ingresar tus preguntas.

    ![Panel de consulta](images/feature-consultation-panel.png)
    > El panel de Lamene Developer Help mostrando la lista de archivos y el área de consulta.

## Requisitos

* **Visual Studio Code:** Versión 1.99.0 o superior.
* **Conexión a Internet:** Se requiere una conexión a internet para comunicarse con el servicio de IA.

## Configuración de la Extensión

Actualmente, Lamene Developer Help no añade configuraciones personalizables a través del punto de extensión `contributes.configuration`. Las futuras versiones podrían incluir opciones para personalizar el comportamiento de la IA o la interfaz.

## Cómo Probar la Extensión

Sigue estos pasos para probar Lamene Developer Help en tu entorno de desarrollo de VS Code:

1.  **Abre tu Proyecto en VS Code:** Asegúrate de tener un proyecto de programación abierto en Visual Studio Code. La extensión utiliza la información de los archivos de este proyecto.

2.  **Ejecuta el Comando de la Extensión:**
    * Abre la Paleta de Comandos de VS Code (`Ctrl+Shift+P` en Windows/Linux o `Cmd+Shift+P` en macOS).
    * Busca y ejecuta el comando: `Lamene Help: Mostrar Panel Principal`.

3.  **Verifica el Icono en la Barra de Actividad:**
    * Deberías ver un nuevo icono con el título "Lamene Help" en la barra de actividad (el menú lateral donde se encuentran el Explorador, Buscar, etc.). Haz clic en este icono para abrir el panel de la extensión.

4.  **Interactúa con el Panel:**
    * **Lista de Archivos:** El panel mostrará una lista de los archivos de tu proyecto actual.
    * **Área de Consulta:** En la parte inferior, encontrarás un área de texto donde puedes escribir tus preguntas relacionadas con programación, código o mejores prácticas.
    * **Botón "Enviar Consulta":** Después de escribir tu pregunta, haz clic en este botón para enviarla a la IA.

5.  **Prueba las Consultas:**
    * Selecciona un archivo de la lista (esto podría ayudar a la IA a contextualizar mejor tu pregunta, aunque no es estrictamente necesario para todas las consultas).
    * Escribe preguntas como:
        * "¿Cómo funciona un bucle `for` en JavaScript?"
        * "¿Cuáles son las mejores prácticas para el manejo de errores en Python?"
        * "Revisa este código [pega un fragmento de tu código] y sugiere mejoras."
    * Haz clic en "Enviar Consulta" y observa la respuesta que proporciona la extensión (actualmente se muestra como un mensaje informativo en VS Code, la implementación completa de la respuesta de la IA se realizará en futuras versiones).

6.  **Verifica la Autenticación (Si aplica):** Si la extensión requiere autenticación y no has iniciado sesión previamente, deberías ver un panel de "Ingreso" donde se te pedirá tu correo electrónico. Sigue las instrucciones para ingresar.

7.  **Reporta Problemas:** Si encuentras algún error, comportamiento inesperado o tienes sugerencias, por favor, repórtalo a través de la sección de Issues de nuestro repositorio (si aplica).

## Problemas Conocidos

En la versión inicial, podrían existir limitaciones en la comprensión de contextos muy complejos o en la cobertura de lenguajes y frameworks menos comunes. Estamos trabajando continuamente para mejorar la precisión y la cobertura.

Si encuentras algún problema, por favor, repórtalo a través de la sección de Issues de nuestro repositorio (si aplica).

## Notas de la Versión

### 0.0.1

* Lanzamiento inicial de Lamene Developer Help.
* Integración de un panel web para la consulta a la IA.
* Funcionalidad para listar los archivos del proyecto.
* Campo de texto para ingresar preguntas sobre programación, código y mejores prácticas.
* Integración de un icono en la barra de actividad para acceder al panel.
* Implementación básica de autenticación de usuario.

---

## Siguiendo las guías de extensión

Asegúrate de haber leído las guías de extensiones y seguir las mejores prácticas para crear tu extensión.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Trabajando con Markdown

Puedes editar este README usando Visual Studio Code. Aquí tienes algunos atajos de teclado útiles:

* Dividir el editor (`Cmd+\` en macOS o `Ctrl+\` en Windows y Linux).
* Alternar previsualización (`Shift+Cmd+V` en macOS o `Shift+Ctrl+V` en Windows y Linux).
* Presiona `Ctrl+Espacio` (Windows, Linux, macOS) para ver una lista de fragmentos Markdown.

## Para más información

* [Soporte de Markdown en Visual Studio Code](http://code.visualstudio.com/docs/languages/markdown)
* [Referencia de sintaxis Markdown](https://help.github.com/articles/markdown-basics/)

**¡Disfruta probando Lamene Developer Help!**