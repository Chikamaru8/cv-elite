import http from 'k6/http';
import { sleep, check } from 'k6';

// Configuración de la prueba de carga
export const options = {
  stages: [
    { duration: '20s', target: 5 },  // Sube gradualmente a 5 usuarios virtuales en 20 segundos
    { duration: '30s', target: 5 },  // Mantiene esos 5 usuarios durante 30 segundos
    { duration: '10s', target: 0 },  // Reduce a 0 usuarios al finalizar
  ],
};

export default function () {
  // Apuntamos a tu página en Cloudflare
  const respuesta = http.get('https://cv-elite-git.changova.workers.dev/');
  
  // Verificamos que la página responda correctamente (Código 200)
  check(respuesta, {
    'estado es 200 (OK)': (r) => r.status === 200,
    'tiempo de respuesta menor a 1s': (r) => r.timings.duration < 1000,
  });

  sleep(1);
}