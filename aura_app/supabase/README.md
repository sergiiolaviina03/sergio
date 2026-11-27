# Conectar Aura a su servidor (Supabase)

Sin servidor, Aura funciona en **modo demostración**: los datos se quedan en cada dispositivo. Con servidor, cada persona tiene su cuenta, la empresa comparte los datos en tiempo real y el registro de jornada se sella también en la base de datos, donde nadie puede modificarlo.

Supabase es de código abierto. Se puede empezar con su plan gratuito y pasar al de pago cuando haya clientes, o instalarlo en un servidor propio con el mismo esquema.

## 1. Crear el proyecto (5 minutos)

1. Entra en [supabase.com](https://supabase.com), crea una cuenta y pulsa **New project**.
2. Elige la región **West EU (Ireland)** o **Central EU (Frankfurt)**, para que los datos se queden en la UE (RGPD), y una contraseña para la base de datos. Guárdala.
3. Cuando el proyecto esté listo, abre **SQL Editor → New query**, pega el contenido completo de [`schema.sql`](schema.sql) y pulsa **Run**. Debe terminar en «Success».

## 2. Configurar el acceso

1. **Authentication → URL Configuration**:
   - *Site URL*: la dirección donde está publicada Aura, por ejemplo `https://sergiiolaviina03.github.io/sergio/`.
   - *Redirect URLs*: añade esa misma dirección.
2. **Project Settings → API**: copia la **Project URL** y la clave **anon public**. Esa clave es pública por diseño: la seguridad la dan las reglas del esquema (cada persona solo ve y cambia lo que le corresponde).

## 3. Decirle a Aura dónde está el servidor

Elige una de las dos opciones:

- **Para todos (recomendado):** en GitHub, ve a *Settings → Secrets and variables → Actions → Variables* y crea `SUPABASE_URL` y `SUPABASE_ANON_KEY` con esos valores. Después, en *Actions*, vuelve a ejecutar «Publicar Aura». Todas las personas entrarán directamente a la pantalla de inicio de sesión.
- **Solo en tu navegador, para probar:** en Aura, *Ajustes → Servidor*: pega la URL y la clave y pulsa *Conectar*.

## 4. Empezar

1. Abre Aura, pulsa **Crear cuenta** y luego **Crear mi empresa**. Serás administrador.
2. Trae tus datos en *Ajustes → Importar desde otro sistema* (Factorial, Sesame, Woffu, A3, Excel…) o da de alta a las personas en *Personas*.
3. En *Personas*, pulsa **Invitar** junto a cada persona y envíale el enlace. Al abrirlo crea su cuenta y queda unida a su ficha.

## Para producción

- **Emails:** el plan gratuito envía pocos correos por hora (confirmación de cuenta y recuperación de contraseña). Configura un SMTP propio en *Authentication → Emails → SMTP Settings* (Brevo, Resend, Amazon SES…).
- **Copias de seguridad:** activa las copias diarias del plan de pago o programa `pg_dump`.
- **Seguridad:** activa la verificación en dos pasos de tu cuenta de Supabase y no compartas la clave `service_role`, que Aura no necesita.

## Qué protege el esquema

| Quién | Puede |
|---|---|
| Administrador | Todo, incluido invitar a otros administradores y editar los datos de la empresa |
| Responsable | Ver y gestionar la plantilla, aprobar solicitudes, publicar turnos, importar, fichar en el quiosco |
| Empleado | Ver y fichar lo suyo, pedir ausencias, enviar gastos y su hoja de horas, firmar sus documentos. No ve salarios ajenos ni los fichajes o la ubicación de otras personas |
| Nadie | Modificar o borrar un fichaje ya sellado (no existe ese permiso en la base de datos) |
