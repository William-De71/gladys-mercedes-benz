# Mercedes-Benz

## Presentación

Esta integración lleva a Gladys los coches Mercedes-Benz de su cuenta **Mercedes me**, a través de los servidores de la app Mercedes me, como la integración de Home Assistant mbapi2020:

- un dispositivo por coche: batería o combustible, autonomía, kilometraje, cierre, alarma antirrobo, puertas, maletero, ventanillas, techo solar, carga, preclimatización, presión de los neumáticos, mantenimiento, alertas y distancia de casa;
- órdenes cuando el coche las acepta: cerrar, abrir, preclimatización, límite de carga, destellar las luces, claxon, cerrar las ventanillas;
- disparadores y acciones de escena, y un widget de panel por coche.

Mercedes envía cada cambio del coche: los valores llegan en uno o dos minutos. Todo pasa por la nube de Mercedes (transporte cloud): el coche nunca se alcanza en su red. Es una integración comunitaria, sin vínculo con Mercedes-Benz; los servidores de Mercedes me no tienen documentación pública y pueden cambiar.

## Requisitos

- Gladys Assistant 5.3.0 o posterior.
- Un coche conectado a Mercedes me (Mercedes me connect en Norteamérica), y el correo y la contraseña de la cuenta, con la sesión iniciada una vez en la app oficial.
- **Sin doble autenticación** en esta cuenta: Gladys debe volver a iniciar sesión sola cada 18 horas aproximadamente. Lo mejor: crear una segunda cuenta Mercedes me, pedir al usuario principal que la invite al coche (hasta seis usuarios por coche) y usarla solo en Gladys.
- El PIN de seguridad de la app, solo para abrir el coche desde Gladys.

## Configuración

| Campo                   | Qué indicar                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------- |
| Correo / Contraseña     | La cuenta Mercedes me                                                                  |
| Región                  | Europa (también India, Tailandia), Norteamérica, Asia-Pacífico (también Latinoamérica) |
| PIN de seguridad        | Opcional: solo hace falta para abrir                                                   |
| Pausa entre lecturas    | 1 minuto por defecto; más largo = menos conexiones a Mercedes                          |
| Radio de la vivienda    | 200 m por defecto, para la distancia de casa y las escenas de llegada/salida           |
| Idioma de los textos    | Automático: el idioma de su panel                                                      |
| Versión de la app / SDK | Avanzado, déjelo vacío salvo si Mercedes rechaza la app (error 418)                    |

Haga clic en **Guardar** y luego en **Probar la conexión**: lista sus coches y el número de órdenes que acepta cada uno. Las viviendas de Gladys necesitan una posición en el mapa para la distancia de casa.

## Uso

### Dispositivos

Abra **Descubrir** y añada sus coches. Una función aparece en cuanto el coche ha enviado su valor: si falta alguna (combustible, techo solar…), vuelva a descubrir más tarde. Cierre, preclimatización y límite de carga se pueden cambiar desde el panel cuando el coche acepta esas órdenes. Una orden tarda de unos segundos a un minuto: el coche se despierta, la ejecuta y luego Mercedes envía el nuevo estado.

### Widget de panel

![El widget Coche Mercedes-Benz para dos coches (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-mercedes-benz/main/docs/assets/widgets.es.png)

El widget **Coche Mercedes-Benz** muestra la batería o el combustible, la autonomía, el kilometraje, una lista de estados (cierre, aperturas, carga, climatización, motor, posición, alarma, alertas) y botones: cerrar o abrir (abrir pide confirmación y el PIN), preclimatizar, destellar las luces y la posición en un mapa. Elija el coche en sus ajustes, o déjelo vacío para el primer coche.

### Escenas

Disparadores: cerrado o abierto, cerrado pero abierto, alarma antirrobo, motor arrancado o apagado, estado de carga cambiado, cable enchufado o no, llegada o salida, nueva alerta, problema de cuenta. Acciones: enviar una orden (y esperar la respuesta del coche), leer el estado de un coche (con una frase lista para un mensaje).

Ejemplos:

- Cuando el coche está cerrado pero abierto → enviarme un mensaje con el resumen.
- Cuando la carga pasa a «Cargado» → avisar y apagar el enchufe de carga.
- Cada día laborable a las 7:30 en invierno → enviar la orden «Iniciar la preclimatización».

### Transporte

La insignia de un coche indica **cloud**. Pasa a **inaccesible** cuando Mercedes rechaza la cuenta, y muestra un punto naranja mientras Mercedes bloquea la conexión en directo: los valores llegan entonces cada 10 minutos.

## Solución de problemas

- **Correo o contraseña rechazados**: compruébelos primero en la app oficial. La cuenta no debe pedir un código (doble autenticación).
- **Cuenta bloqueada (429)**: Mercedes limita el tiempo que una cuenta está conectada cada día; el bloqueo suele terminar a medianoche GMT. Use una segunda cuenta dedicada a Gladys y una pausa más larga entre lecturas.
- **Versión de la app rechazada (418)**: Mercedes exige una app más reciente. Actualice la integración; mientras tanto, indique las versiones actuales de la app y del SDK en los ajustes avanzados (vea el proyecto mbapi2020).
- **Falta un valor o una orden**: no todos los coches envían todo, y algunas órdenes dependen de los servicios de su coche. Haga clic en **Diagnóstico** y copie las líneas de la pestaña Registros en una issue de GitHub: contienen lo que envía el coche, sin VIN, matrícula ni posición.
- **Apertura rechazada**: indique el PIN de seguridad definido en la app Mercedes me.
