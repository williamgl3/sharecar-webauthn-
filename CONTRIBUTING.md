# Contribuir a ShareCar

Gracias por querer contribuir. Este documento resume el flujo recomendado
para colaborar, normas de estilo y pasos para preparar PRs.

1. Fork / Clone

```bash
git clone <tu-fork-url>
git checkout -b feat/mi-cambio
```

2. Estilo de commits
- Mensajes en inglés o español claro. Formato sugerido: `tipo: breve-descripción`.
- Ejemplos: `fix: corregir bug en auth flow`, `feat: añadir validación de email`.

3. Tests y lint
- Añade tests para cambios relevantes cuando sea posible.
- Ejecuta linters disponibles antes de crear el PR.

4. Pull Request
- Abre un PR hacia la rama `main` del repositorio original.
- Describe el cambio, motivo, y cómo probarlo localmente.

5. Revisión
- Responde a comentarios y actualiza el PR según sea necesario.

6. Responsabilidades
- Los cambios que incluyan credenciales o claves deben evitarse; use variables
  de entorno y secretos en el servidor.

Contacto: abra un issue si necesita orientación antes de implementar cambios.
