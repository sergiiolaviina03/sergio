// Biblioteca de plantillas de RR. HH. (España). Textos orientativos para adaptar con la asesoría.
import type { DocCategory } from '../types'

export const TEMPLATES: { id: string; title: string; category: DocCategory; body: string }[] = [
  {
    id: 'vehiculos',
    title: 'Política de uso de vehículos de empresa',
    category: 'politica',
    body: `## 1. Objeto
Esta política regula el uso de los vehículos que la empresa pone a disposición de la plantilla.

## 2. Uso permitido
El vehículo se usa para desplazamientos profesionales. El uso personal solo está permitido si se ha pactado por escrito y tributa como retribución en especie.

## 3. Obligaciones
- Conducir con permiso en vigor y respetando el Código de Circulación.
- Comunicar cualquier incidencia o daño en 24 horas.
- Las sanciones de tráfico son responsabilidad de quien conduce.

## 4. Kilometraje
Los desplazamientos con vehículo propio se compensan a 0,26 €/km, importe exento de IRPF.

## Aceptación
Con tu firma confirmas que conoces y aceptas esta política.`,
  },
  {
    id: 'datos',
    title: 'Compromiso de confidencialidad y protección de datos',
    category: 'politica',
    body: `## 1. Deber de secreto
Te comprometes a no divulgar información confidencial de la empresa, de sus clientes ni de la plantilla, durante y después de la relación laboral.

## 2. Protección de datos
Tratarás los datos personales solo para las tareas de tu puesto, conforme al RGPD y la LOPDGDD, y aplicarás las medidas de seguridad de la empresa.

## 3. Incidentes
Comunicarás de inmediato cualquier pérdida de equipos o acceso indebido a datos para que la empresa pueda notificarlo en 72 horas si procede.

## Aceptación
Con tu firma confirmas que asumes estas obligaciones.`,
  },
  {
    id: 'prl',
    title: 'Información de prevención de riesgos laborales',
    category: 'politica',
    body: `## 1. Información recibida
Conforme al artículo 18 de la Ley 31/1995, recibes la evaluación de riesgos de tu puesto y las medidas preventivas.

## 2. Puesto con pantallas
Ajusta la altura de la pantalla a la de los ojos, haz pausas visuales cada hora y mantén una postura neutra.

## 3. Emergencias
Consulta el plan de evacuación de tu centro y el punto de encuentro. Teléfono de emergencias: 112.

## Aceptación
Con tu firma confirmas que has recibido esta información.`,
  },
  {
    id: 'conducta',
    title: 'Código de conducta',
    category: 'politica',
    body: `## 1. Respeto
No se tolera ningún tipo de acoso, discriminación o trato degradante. Existe un canal de denuncias confidencial (Ley 2/2023).

## 2. Conflictos de interés
Comunica cualquier situación en la que tu interés personal pueda chocar con el de la empresa.

## 3. Regalos
No aceptes regalos de clientes o proveedores por valor superior a 50 €.

## Aceptación
Con tu firma te comprometes a cumplir este código.`,
  },
  {
    id: 'teletrabajo',
    title: 'Acuerdo de trabajo a distancia',
    category: 'anexo',
    body: `## 1. Régimen
Conforme a la Ley 10/2021, acordamos el trabajo a distancia los días que figuran en tu ficha. Es voluntario y reversible.

## 2. Medios y gastos
La empresa facilita los equipos necesarios y compensa los gastos de conexión y suministros.

## 3. Horario y registro
El horario y el registro de jornada son los mismos que en la oficina; fichas desde la app indicando teletrabajo.

## Aceptación
Con tu firma aceptas este acuerdo.`,
  },
]

/** Resumen extractivo local: títulos y la frase clave de cada sección. */
export function summarizeDoc(body: string) {
  const sections = body.split(/\n(?=## )/).map((s) => s.trim()).filter(Boolean)
  const key = /plazo|d[ií]as|horas|obligat|derecho|conserva|prohib|permitid|responsab|firma|€|%|\d/i
  const bullets = sections
    .filter((s) => !/^## aceptaci/i.test(s))
    .map((s) => {
      const [head, ...rest] = s.split('\n')
      const text = rest.join(' ').replace(/^- /gm, '').replace(/\s+/g, ' ')
      const sentences = text.split(/(?<=[.;])\s+/)
      const best = sentences.find((x) => key.test(x)) ?? sentences[0] ?? ''
      return `• ${head.replace(/^## (\d+\.\s*)?/, '')}: ${best.length > 150 ? best.slice(0, 147) + '…' : best}`
    })
    .slice(0, 4)
  return bullets.join('\n')
}
