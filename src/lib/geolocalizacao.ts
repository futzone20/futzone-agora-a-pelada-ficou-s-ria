// Geolocalização — usado tanto no perfil (pra salvar cidade/estado/lat/lng
// automaticamente) quanto na busca de goleiros (pra ordenar por proximidade).
//
// A geocodificação reversa usa o Nominatim (OpenStreetMap), que é gratuito
// e não exige chave de API — ótimo pra uso pontual (clique do usuário), mas
// tem limite de 1 requisição/segundo e não deve ser usado em lote. Se o uso
// crescer muito, vale trocar por Google Geocoding API ou Mapbox (pagos, com
// chave), mantendo a mesma assinatura de função.

export type Coordenadas = { latitude: number; longitude: number };
export type LocalizacaoCompleta = Coordenadas & { cidade: string; estado: string };

export function obterLocalizacaoAtual(): Promise<Coordenadas> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Seu navegador não suporta localização automática."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error("Permissão de localização negada. Você pode preencher manualmente."));
        } else {
          reject(new Error("Não foi possível obter sua localização. Tente novamente."));
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

const SIGLAS_ESTADOS: Record<string, string> = {
  "acre": "AC", "alagoas": "AL", "amapá": "AP", "amapa": "AP", "amazonas": "AM", "bahia": "BA",
  "ceará": "CE", "ceara": "CE", "distrito federal": "DF", "espírito santo": "ES", "espirito santo": "ES",
  "goiás": "GO", "goias": "GO", "maranhão": "MA", "maranhao": "MA", "mato grosso": "MT",
  "mato grosso do sul": "MS", "minas gerais": "MG", "pará": "PA", "para": "PA", "paraíba": "PB",
  "paraiba": "PB", "paraná": "PR", "parana": "PR", "pernambuco": "PE", "piauí": "PI", "piaui": "PI",
  "rio de janeiro": "RJ", "rio grande do norte": "RN", "rio grande do sul": "RS", "rondônia": "RO",
  "rondonia": "RO", "roraima": "RR", "santa catarina": "SC", "são paulo": "SP", "sao paulo": "SP",
  "sergipe": "SE", "tocantins": "TO",
};

export async function reverseGeocode(coords: Coordenadas): Promise<{ cidade: string; estado: string }> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&addressdetails=1&accept-language=pt-BR`;
  const resp = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!resp.ok) throw new Error("Não foi possível identificar sua cidade.");
  const data = await resp.json();
  const addr = data?.address || {};
  const cidade: string = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || "";
  const estadoNome: string = (addr.state || "").toLowerCase();
  const estado = SIGLAS_ESTADOS[estadoNome] || "";
  if (!cidade) throw new Error("Não conseguimos identificar sua cidade a partir da localização.");
  return { cidade, estado };
}

export async function obterLocalizacaoCompleta(): Promise<LocalizacaoCompleta> {
  const coords = await obterLocalizacaoAtual();
  const { cidade, estado } = await reverseGeocode(coords);
  return { ...coords, cidade, estado };
}

/** Distância em km entre duas coordenadas (fórmula de Haversine). */
export function distanciaKm(a: Coordenadas, b: Coordenadas): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
