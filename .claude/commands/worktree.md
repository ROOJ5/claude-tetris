---
description: Crea un git worktree aislado en .trees/[nombre] y ejecuta ahí las instrucciones dadas, de forma independiente del código principal.
argument-hint: <instrucciones a ejecutar en el worktree>
---

Se te dieron estas instrucciones para ejecutar en un worktree aislado:

$ARGUMENTS

Sigue estos pasos:

1. A partir de las instrucciones anteriores, elige un nombre corto en kebab-case que describa el requerimiento (por ejemplo: `fix-login-bug`, `power-up-shield`, `refactor-board`).
2. Verifica el estado del repo con `git status` antes de crear el worktree.
3. Crea el worktree con:
   ```bash
   git worktree add .trees/<nombre-elegido>
   ```
   Si `.trees/` no existe, `git worktree add` lo crea automáticamente. Si ya existe un directorio o rama con ese nombre, elige un nombre alternativo.
4. Cambia tu contexto de trabajo a esa ruta (`.trees/<nombre-elegido>`) y trata esa carpeta como el directorio de trabajo activo para todo lo que sigue.
5. Ejecuta las instrucciones del usuario **únicamente dentro de ese worktree**, sin tocar archivos en el checkout principal del repositorio.
6. Al terminar, resume qué se hizo y en qué rama/carpeta (`.trees/<nombre-elegido>`) quedó el trabajo, y menciona que el usuario puede revisarlo, mergearlo o eliminar el worktree (`git worktree remove .trees/<nombre-elegido>`) cuando lo desee. No hagas merge ni push sin que el usuario lo pida explícitamente.
</content>
