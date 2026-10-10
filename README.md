# Anuncios semanales de la iglesia

Esta herramienta lee los eventos de la semana en Google Calendar y prepara, para cada
uno, una **imagen** y un **clip de video**, y escribe **una sola narración en español**
para toda la semana. Luego junta todo en **un solo video semanal** con una tarjeta de
introducción, transiciones, la voz de corrido y un cierre. El video muestra las mismas
imágenes que se publican.

Cuando apruebas el video de la semana, prepara además **un video para cada culto** (por
ejemplo martes, jueves y sábado): el del martes ya no anuncia lo que pasó ni lo de ese
mismo día, solo lo que viene después. Quedan en `out/<año>-W<semana>-martes/` y así.

Si en la sesión no está conectado Google Calendar, puedes mandar un pantallazo de la
semana del calendario o escribir los eventos, y Claude los toma de ahí.

Todo sale en formato horizontal (16:9, 1920x1080), en español de Colombia y hablándole
al público de **tú**.

Es para las congregaciones de la **IPUC** (Iglesia Pentecostal Unida de Colombia). El
logo, los colores del video y la tipografía son los de la organización, iguales para
todas, y ya vienen dentro del proyecto. Lo único que cambia de una congregación a otra es
su `church-info.md`: su nombre, su dirección y sus horarios.

## La regla que no se rompe

**La herramienta nunca inventa datos de un evento.** Una hora, un lugar o un detalle
solo pueden venir de tres sitios: la tarjeta del evento en el calendario,
`church-info.md`, o alguien del equipo. Una hora equivocada en un anuncio manda a la
gente a una puerta cerrada.

Por eso, si no se sabe la hora de un evento, el anuncio **sale sin hora** (solo con la
fecha). Antes de hacer nada, Claude te pregunta por lo que no esté claro, uno por uno: no
hay una sola palabra que conteste todo de una vez y le dé por bueno algo que tú no
confirmaste.

## Lo que necesitas una sola vez

1. **Claude Code**, abierto en esta carpeta y con acceso al Google Calendar de la
   iglesia.
2. **`church-info.md`**: los datos de tu iglesia. Copia `church-info.example.md` y
   llénalo. **No hay un formato que cumplir**: Claude lo lee como texto y entiende listas,
   frases o tablas, y no pasa nada por un error de tipeo. Todo es opcional, pero lo que
   falte no aparecerá en los anuncios. Esto es lo que conviene contar:

   | Campo | Para qué sirve |
   |---|---|
   | `Nombre` | El nombre de tu congregación (por ejemplo, «IPUC Envigado Central»). Se dice una vez, en la bienvenida de la voz de la semana; en pantalla el nombre va en el logo, nunca escrito aparte |
   | `Direccion` | Aparece en el cierre del video |
   | `Lugar por defecto` | Dónde es un evento cuando su tarjeta no dice nada |
   | `Ministerios` | Los grupos de la iglesia (Jóvenes, Familias...) para etiquetar el público |
   | `Llamado a la accion` | La frase con la que termina el video de la semana (por ejemplo, "Te esperamos") |
   | `Despedida` | Opcional: lo que se dice justo después (por ejemplo, "Dios te bendiga") |
   | Servicios recurrentes | Los horarios fijos de la semana (el día, la hora de inicio, y quién lo dirige o su tema si hay dos el mismo día). Cada uno se anuncia por sí solo, aunque no tenga un evento propio en el calendario: se da por sabido, pero igual pasa cada semana |

3. **Una cuenta de ElevenLabs de pago** y una voz elegida. Guarda los datos en un archivo
   `.env` en esta carpeta (nunca lo compartas ni lo subas a ningún sitio):

   ```
   ELEVEN_LABS_API_KEY=...
   ELEVEN_LABS_VOICE_ID=...
   ```

   Las voces de la biblioteca de ElevenLabs solo se pueden usar por API con un plan de
   pago. La voz elegida (`voiceId`), el modelo y sus ajustes están en `scripts/voice.json`:
   para cambiar de voz, cambia ahí el `voiceId`.
4. **El logo y los colores de la IPUC.** No hay que hacer nada: ya están, y son los de la
   organización, los mismos para todas las congregaciones. El logo está en `brand/logo/` y
   los colores, tomados del manual de identidad (`brand/corporate-brand.md`), en
   `video/src/brand/tokens.ts`, el único archivo donde viven. Falta la tipografía: hoy el
   diseño usa Montserrat de muestra en lugar de Myriad Pro, que es la del manual.
5. **Las imágenes de fondo de los anuncios.** También vienen listas: una por tema (familia,
   oración, jóvenes, evangelismo, alabanza, escuela dominical, bautismo), ya generadas y
   revisadas. Cada semana Claude te pregunta si sigues con las mismas o quieres que genere
   unas nuevas; generar cuesta dinero, así que lo normal es seguir con las que ya hay.

> Para quien administra el equipo: hace falta Node 22 o superior y las dependencias
> instaladas en `video/`. En Linux, el navegador de Remotion necesita librerías del
> sistema (`libnss3` y otras); `CLAUDE.md` explica cómo comprobarlo.

## Cada semana

Abre Claude Code en esta carpeta y pídele, por ejemplo:

> Haz los anuncios de esta semana.

No hace falta que lo escribas perfecto: Claude propone la semana y los calendarios, y te
pregunta lo que no esté claro. Sigue la guía `church-ads` (en `.claude/skills/church-ads/`).
En palabras sencillas, esto es lo que pasa:

1. **Propone la semana y los calendarios.** Si no le dices cuáles, toma la semana de hoy
   (o la próxima, si es fin de semana) y los calendarios de la iglesia, y te lo confirma.
2. **Trae los eventos** de esa semana, lee sus títulos junto con `church-info.md` (la hora
   escondida en un título, el servicio al que pertenece, el lugar de siempre) y los ordena
   en `out/2026-W39/events.json` (`W39` es el número de la semana del año, de lunes a
   domingo).
3. **Te muestra los eventos, agrupados por día, y te pregunta solo lo que no está
   claro**, en un solo mensaje. Ahí mismo te pregunta si sigues con las imágenes de fondo
   de siempre o quieres unas nuevas esta semana; si no dices nada, sigue con las que ya
   hay. Primero, cada evento con su hora y lugar y de dónde salió
   cada dato; lo rutinario (un evento sin hora sale solo con la fecha; uno sin lugar propio
   sale en el lugar de siempre; un culto de siempre sin evento propio en el calendario) va
   ahí, sin número. Después, con número, solo las dudas de verdad: una hora que no está
   segura, un lugar que quizá es otro, un título que no entiende o que parece interno, o
   dos eventos el mismo día que podrían ser el mismo culto. **Cada número necesita su
   propia respuesta**: aunque digas «sigue» o «todo bien», eso solo confirma la lista, no
   contesta las dudas numeradas, y Claude te vuelve a preguntar por las que falten.
   Respondes con pocas palabras, por ejemplo «1 los dos, 2 omitir, 3 anúncialo, 4 sin
   lugar». Nada se adivina: una hora o un lugar dudoso solo se usa si tú lo confirmas, y un
   evento que nadie explicó queda fuera hasta que tú lo pidas, porque un anuncio publicado
   no se puede deshacer. Al final te dice cuáles dejó fuera, y uno vuelve a entrar si le
   dices «anúncialo».
4. **Crea el diseño de cada evento y arma las imágenes de la semana en Claude Design.**
5. **Escribe la narración de la semana**: un solo guion (bienvenida, un evento tras
   otro y el cierre) y una sola voz que lo lee de corrido.
6. **Revisa** que el guion no diga algo que no esté en el evento.
7. **Te muestra el guion antes de generar la voz**, porque es lo único que cuesta y
   cambiar una palabra después obliga a generarla de nuevo. Si prefieres no verlo, díselo.
8. **Genera los videos.**

El resultado queda en `out/<año>-W<semana>/`:

```
out/2026-W39/
  semana.mp4                 el video semanal completo
  events.json                los datos de la semana
  lectura.json               lo que Claude entendió de los títulos y de church-info.md
  guion.md                   lo que dice la voz, de principio a fin
  voz.mp3                    la locución de toda la semana
  imagenes/                  el lienzo de Claude Design de la semana, tal como se descargó
  charla-familias/
    ad.png                   la imagen del anuncio, hecha en Claude Design
    fotograma.png            un cuadro del video, solo para revisar el video
    clip.mp4                 el clip de ese evento, con su parte de la voz
```

La **imagen de cada evento** (`ad.png`) sale de un **lienzo de Claude Design** que Claude
arma para la semana, con **un color por tipo de evento** (jóvenes, damas, evangelismo,
enseñanza, ayuno y uno general; están en `brand/paletas-imagen.md`) y una composición
distinta para cada uno. Antes de guardarlas, la herramienta revisa que cada imagen solo
diga el título, el ministerio, la fecha, la hora, el lugar (si no es el de siempre) y el
llamado a la acción de su evento; si aparece algo más, no guarda ninguna hasta que se
corrija. El **video** se sigue haciendo con los diseños de siempre y con los colores de la
organización, así que la imagen y el video no se ven idénticos. El `fotograma.png` es solo
un cuadro del video para revisarlo: la imagen del evento es el `ad.png`.

`out/` es desechable: si algo no te gusta, cambia el origen (el guion, un dato, una
corrección) y vuelve a generar. Nunca edites esos archivos a mano.

## Cómo se decide la hora de un evento, y los cultos de siempre

Para un evento que sí tiene tarjeta en el calendario, Claude se queda con la primera fuente
que dé la hora:

1. La hora de la tarjeta del evento en el calendario.
2. Una hora escrita en el título (por ejemplo, `2pm ...`).
3. Si ninguna de las dos dice nada, **no hay hora**: el anuncio sale solo con la fecha.

Lo mismo vale para el lugar (el de la tarjeta, el que diga el título, o el lugar de
siempre) y para el ministerio.

**Los cultos de siempre son distintos: se anuncian aunque no tengan tarjeta propia**, con
la hora y el lugar que digas en `church-info.md`, porque no siempre se crea un evento para
ellos en el calendario — se da por sabido, pero igual pasa cada semana. Cuando sí hay una
tarjeta ese día, Claude decide si es el mismo culto o si son dos cosas distintas:

- Si la tarjeta tiene claramente el mismo horario, o su título es solo el nombre del
  culto, es el mismo: se anuncia con lo que diga la tarjeta, y el culto de siempre no se
  repite.
- Si hay duda (la tarjeta no tiene hora, tiene otra hora, o su título nombra a otro grupo,
  como «Culto de caballeros» un día cuyo culto de siempre no es de un grupo en particular),
  Claude no decide por su cuenta: te pregunta. Es que a veces sí hay dos cultos a la misma
  hora, en salones distintos (por ejemplo, uno de damas y otro de caballeros), así que
  adivinar podría borrar un culto real o inventar uno de más.

Nada se da por bueno sin que lo veas: antes de hacer los anuncios, Claude te muestra cada
evento con su hora y su lugar, agrupado por día, y ahí corriges lo que esté mal.

## Claude lee tus datos: por qué la lista del primer mensaje importa

Ni `church-info.md` ni los títulos del calendario tienen un formato fijo: Claude los lee
como los leería una persona. Eso te da libertad (escribe como quieras, con frases, con
errores de tipeo, sin ordenar nada), y a cambio hay algo que debes saber: Claude puede
entender algo distinto de lo que querías, y ningún programa compara lo que entendió con el
archivo. **La revisión de verdad eres tú**, con la lista del primer mensaje (cada evento
con su hora, su lugar y de dónde salió, agrupados por día). Léela con calma: es la única
comparación entre lo que Claude entendió y la realidad.

- **Si algo está mal**, dilo con tus palabras («esa es a las 7 p. m.», «sin lugar»). Claude
  lo corrige y no te lo vuelve a preguntar esa semana.
- **Si el error es de fondo** (falta un servicio, el lugar de siempre cambió), corrígelo en
  `church-info.md` y pídele a Claude que actualice la semana. Claude vuelve a leer el
  archivo cada vez, así que un cambio ahí siempre se aplica.
- **Si no sabe, no adivina**: te pregunta, o deja el evento solo con la fecha.

Lo que aprendimos para que te entienda mejor:

- De cada servicio fijo escribe el **día y la hora de inicio**. Si hay dos el mismo día
  (por ejemplo, el culto y el ayuno del sábado), ponles **nombre**: así Claude sabe a cuál
  se refiere un evento.
- En el título de un evento escribe la hora con **a. m. o p. m.** («2pm», «7 de la
  noche»). «A las 7» no dice si es de la mañana o de la tarde, y Claude te lo preguntará.
- Un evento que quizá es en otro lugar (de distrito, de zona, una convención) se anuncia
  **sin lugar** salvo que tú digas cuál es: un lugar equivocado manda a la gente a otra
  puerta.
- Un error de tipeo en `church-info.md` no lo rompe. Pero un dato que falta sí se nota:
  lo que no esté escrito ahí no aparece en los anuncios.
- Si un evento del calendario es en realidad el culto de siempre, con otro nombre o sin
  hora, dilo en la respuesta numerada («2 es el mismo») en vez de dejarla sin contestar:
  así Claude no anuncia el culto dos veces.

> Para quien administra: la lectura de Claude queda en `out/<semana>/lectura.json`. Se
> rehace cada vez a partir del `church-info.md` de ese momento; no la edites. Lo que tú
> respondes, en cambio, se guarda en `overrides/` y se conserva. Si falta ese archivo, la
> validación se detiene: no dejará hacer los videos sin el nombre de la iglesia.

## Corregir una hora, un lugar o el diseño

Lo normal es decírselo a Claude, con tus palabras: «el retiro es a las 8 a. m.», «ese
evento solo con la fecha», «omite la reunión interna». Claude guarda tu respuesta y no te
la vuelve a preguntar.

Para quien administra: esas respuestas quedan en `overrides/<semana>.json` (por ejemplo,
`overrides/2026-W39.json`), y también se puede editar a mano. Cada evento se identifica por
su nombre corto (su *slug*: minúsculas, sin tildes y con guiones, como `charla-familias`):

```json
{
  "charla-familias": { "hora": "19:00", "lugar": "Templo" },
  "retiro-jovenes": { "hora": null },
  "reunion-interna": { "omitir": true },
  "servicio-sabado-1845": { "omitir": true }
}
```

El último ejemplo omite un culto de siempre: su nombre corto sale del día y la hora del
horario fijo (`servicio-<día>-<hora>`), no del título, para que siga siendo el mismo de una
semana a otra.

| Clave | Valor | Efecto |
|---|---|---|
| `hora` | `"HH:MM"` en 24 horas, o `null` | `"HH:MM"` pone la hora (queda registrado que la dio una persona); `null` anuncia el evento **sin hora**, aunque el calendario, el título o el horario del culto tengan una |
| `lugar` | texto, o `null` | el texto pone el lugar; `null` anuncia el evento **sin lugar**, incluso el habitual |
| `modalidad` | `presencial` o `virtual` | si eliges `virtual`, pon también `plantilla: "virtual"` |
| `plantilla` | `estandar`, `destacado` o `virtual` | `destacado` solo se usa por esta vía |
| `omitir` | `true` | saca el evento de la semana |

Si editas el archivo a mano, vuelve a pedirle a Claude que actualice la semana. Como la
hora quedó en el registro, el guion, los diseños y la imagen se rehacen con ella.

## Dónde aparece el nombre de la iglesia

- **En la voz:** una sola vez, en la bienvenida del video semanal ("Bienvenidos a ..."),
  tal como está en `Nombre` de `church-info.md`. Las líneas de cada evento y el cierre no
  lo mencionan, así que el clip de un solo evento no dice el nombre en voz alta.
- **En pantalla:** solo dentro del logo. Ningún diseño escribe el nombre por su cuenta, y
  la validación lo rechaza si alguno lo hace.

## Usarlo en otra congregación de la IPUC

Copia el proyecto y llena `church-info.md` con los datos de esa congregación, a partir de
`church-info.example.md` (en el formato que quieras). No hay nada que cambiar en `scripts/` ni en `video/src/`: el
nombre y los datos de la iglesia nunca están escritos en el código.

## Antes de publicar, revisa siempre

- **Las horas y las fechas** de cada `ad.png` (la imagen de cada evento, hecha en Claude
  Design) y del `guion.md`. Es lo más importante.
- **Escucha la voz completa.** Si un nombre suena raro (por ejemplo, una sigla), avísale a
  Claude: el guion respeta los nombres tal como están en el calendario.
- **Los títulos** salen tal cual los escribió el calendario, con o sin tildes. Si en el
  calendario dice "Oracion virtual", el anuncio dirá "Oracion virtual".

## Costos

ElevenLabs cobra por caracteres del guion, y la voz de toda la semana se genera de una
sola vez. Si el texto del guion no cambia, la herramienta reutiliza la locución que ya
tiene y **no vuelve a cobrar**; cambiar una sola palabra sí genera un cobro nuevo, porque
se vuelve a leer la semana completa. Por eso Claude te muestra el guion y espera tu visto
bueno antes de generar la voz.

Las imágenes de fondo de los anuncios también tienen un costo, pero solo si tú pides unas
nuevas: lo normal es reutilizar las que ya están guardadas y revisadas, sin ningún cobro.
Por eso Claude te pregunta cada semana en vez de generarlas por su cuenta.

## Problemas frecuentes

| Qué ves | Qué significa |
|---|---|
| `[sin-hora]` ("has no time") | No se encontró hora. El anuncio sale con la fecha solamente. No es un error: Claude ya te lo dijo en su primer mensaje y puedes darle la hora en tu respuesta. |
| "voiceover unavailable" | No se pudo generar la voz (sin conexión o un problema con la cuenta). La semana sale **sin audio** y se avisa al final; la voz se puede volver a intentar después. |
| Un `ERROR` al validar | Un guion o un diseño dice algo que el evento no respalda. Se corrige y se vuelve a validar; hasta entonces no se genera nada. |
| La voz no dice el nombre de la iglesia, o el video sale sin la frase final | Faltan esas líneas en `church-info.md`. |

## Cambiar solo un evento

```bash
node scripts/render.mjs 2026-W39 charla-familias         # su clip
node scripts/render.mjs 2026-W39                         # toda la semana y el video semanal
node scripts/export-stills.mjs 2026-W39 charla-familias  # su imagen, del lienzo de Claude Design
```

La imagen no se dibuja de nuevo: se vuelve a tomar la de ese evento del lienzo de Claude
Design de la semana, así que, si la imagen tiene que cambiar, Claude corrige primero el
lienzo. Aunque indiques un solo evento, se revisa el lienzo completo: un error en la
imagen de cualquier evento detiene todas.

Al indicar un evento, no se rehace el video semanal: hace falta generar la semana
completa. La voz es una sola para toda la semana: si cambias algo del guion, se vuelve a
generar completa con `node scripts/tts.mjs --week 2026-W39`.

## Dónde está cada cosa

| Ruta | Qué contiene |
|---|---|
| `church-info.md` | Los datos de tu iglesia |
| `overrides/` | Correcciones de una persona, por semana |
| `brand/` | Logo y fuentes |
| `video/public/motifs/` | Imágenes de fondo de los anuncios, una por tema, ya generadas y revisadas |
| `video/src/brand/tokens.ts` | Colores, tipografía y tamaños del video: el único sitio donde cambia el diseño de marca |
| `brand/paletas-imagen.md` | Los colores de las imágenes de los eventos, uno por tipo de evento (texto libre, se edita con palabras) |
| `video/src/ads/` | Un archivo de diseño por evento |
| `scripts/` | Los pasos que Claude ejecuta |
| `out/` | Lo que se genera cada semana |
| `CLAUDE.md`, `PLAN.md` | Las reglas del proyecto y el plan de construcción (en inglés) |
| `.claude/skills/church-ads/` | La guía de trabajo: flujo semanal, diseño y redacción de guiones |
